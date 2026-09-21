/**
 * VaultSyncService - Thin facade over the SyncEngine.
 *
 * Every push goes through SyncEngine (dirty tracking, base-version guard,
 * conflict copies, offline queue). This file only adds the multi-vault
 * orchestration and the pull direction on top of it.
 *
 * IMPORTANT: Only vaults with cloud sync enabled are synced.
 */

import type { BackupConfig } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { cloudVaultService, CloudVault } from "./CloudVaultService";
import { VaultManager } from "./VaultManager";
import { syncEngine } from "@/core/system/sync/SyncEngine";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface SyncResult {
  success: boolean;
  error?: string;
  syncedVaults?: number;
  conflicts?: string[];
}

interface SyncProgress {
  total: number;
  current: number;
  message: string;
}

export class VaultSyncService {
  private syncStatus: SyncStatus = "idle";
  private lastSyncTime: Date | null = null;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private progressListeners: Set<(progress: SyncProgress | null) => void> =
    new Set();
  private currentProgress: SyncProgress | null = null;
  private syncDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  getStatus(): SyncStatus {
    return this.syncStatus;
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  getProgress(): SyncProgress | null {
    return this.currentProgress;
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  onProgressChange(
    callback: (progress: SyncProgress | null) => void,
  ): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  private setStatus(status: SyncStatus) {
    this.syncStatus = status;
    this.syncListeners.forEach((cb) => cb(status));
  }

  private setProgress(progress: SyncProgress | null) {
    this.currentProgress = progress;
    this.progressListeners.forEach((cb) => cb(progress));
  }

  async isAuthenticated(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  }

  /** Push every cloud-sync vault through the engine. */
  async syncToCloud(vaultManager: VaultManager): Promise<SyncResult> {
    if (!navigator.onLine) {
      this.setStatus("offline");
      return { success: false, error: "No internet connection" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    this.setStatus("syncing");

    const vaults = vaultManager.getCloudVaults();
    let syncedCount = 0;
    const conflicts: string[] = [];
    let lastError: string | undefined;

    for (let i = 0; i < vaults.length; i++) {
      const vault = vaults[i];
      this.setProgress({
        total: vaults.length,
        current: i + 1,
        message: `Syncing ${vault.name}`,
      });

      const outcome = await syncEngine.syncVault(vaultManager, vault.id);
      if (outcome.success) {
        syncedCount++;
        if (outcome.conflicts?.length) conflicts.push(...outcome.conflicts);
      } else {
        lastError = outcome.error;
      }
    }

    this.setProgress(null);

    if (syncedCount === 0 && lastError) {
      this.setStatus("error");
      return { success: false, error: lastError };
    }

    this.lastSyncTime = new Date();
    this.setStatus("synced");
    return { success: true, syncedVaults: syncedCount, conflicts };
  }

  /**
   * Pull vaults from cloud. Local notes edited since the last sync are never
   * silently overwritten — the engine keeps them as conflict copies.
   */
  async syncFromCloud(vaultManager: VaultManager): Promise<SyncResult> {
    if (!navigator.onLine) {
      this.setStatus("offline");
      return { success: false, error: "No internet connection" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    this.setStatus("syncing");

    try {
      const { data: cloudVaults, error } = await cloudVaultService.getVaults();

      if (error || !cloudVaults) {
        this.setStatus("error");
        return {
          success: false,
          error: error?.message || "Failed to fetch cloud vaults",
        };
      }

      let syncedCount = 0;
      const conflicts: string[] = [];

      for (const cloudVault of cloudVaults) {
        // Match by the shared vault identity: the local id IS the cloud id
        // for new vaults; older vaults still match through cloudId.
        const localVault = vaultManager
          .getCloudVaults()
          .find((v) => v.id === cloudVault.id || v.cloudId === cloudVault.id);

        if (localVault) {
          const cloudUpdated = new Date(cloudVault.updated_at).getTime();
          const hasLocalEdits =
            syncEngine.getDirty(localVault.id).length > 0;

          if (cloudUpdated > localVault.lastModified || hasLocalEdits) {
            const remote = (cloudVault.graph_data || {
              nodes: [],
              links: [],
            }) as { nodes: never[]; links: never[] };

            const merged = syncEngine.applyRemoteSnapshot(
              vaultManager,
              localVault.id,
              remote,
              {
                cloudId: cloudVault.id,
                remoteUpdatedAt: cloudVault.updated_at,
              },
            );
            conflicts.push(...merged);
            localVault.lastModified = Math.max(
              cloudUpdated,
              localVault.lastModified,
            );
            syncedCount++;
          }
          continue;
        }

        await this.importCloudVault(vaultManager, cloudVault);
        syncedCount++;
      }

      this.lastSyncTime = new Date();
      this.setStatus("synced");

      return { success: true, syncedVaults: syncedCount, conflicts };
    } catch (error) {
      console.error("Sync from cloud failed:", error);
      this.setStatus("error");
      return { success: false, error: String(error) };
    }
  }

  /** Import a cloud vault that has no local counterpart yet. */
  private async importCloudVault(
    vaultManager: VaultManager,
    cloudVault: CloudVault,
  ): Promise<void> {
    // A local vault with the same identity is linked, never duplicated.
    const existing = vaultManager.getVault(cloudVault.id);
    if (existing) {
      await vaultManager.setCloudId(existing.id, cloudVault.id);
      return;
    }

    // The local vault adopts the cloud id as its own, so a second device
    // importing the same vault lands on the same identity instead of a copy.
    const vaultId = await vaultManager.createCloudVault(
      cloudVault.name,
      true,
      cloudVault.id,
    );
    const vault = vaultManager.getVault(vaultId);
    if (!vault) return;

    await vaultManager.setCloudId(vaultId, cloudVault.id);

    const graphData = (cloudVault.graph_data || { nodes: [], links: [] }) as {
      nodes: never[];
      links: never[];
    };
    syncEngine.applyRemoteSnapshot(vaultManager, vaultId, graphData, {
      cloudId: cloudVault.id,
      remoteUpdatedAt: cloudVault.updated_at,
    });

    if (cloudVault.graph_config) {
      await vaultManager.setGraphConfig(vaultId, cloudVault.graph_config);
    }
    if (cloudVault.backup_config) {
      await vaultManager.setBackupConfig(
        vaultId,
        cloudVault.backup_config as BackupConfig,
      );
    }
  }

  /** Pull first, then push. */
  async fullSync(vaultManager: VaultManager): Promise<SyncResult> {
    const pullResult = await this.syncFromCloud(vaultManager);
    if (!pullResult.success) return pullResult;
    return this.syncToCloud(vaultManager);
  }

  /** Push a single vault through the engine. */
  async syncVaultToCloud(
    vaultManager: VaultManager,
    vaultId: string,
  ): Promise<SyncResult> {
    const outcome = await syncEngine.syncVault(vaultManager, vaultId);
    if (outcome.success) {
      this.lastSyncTime = new Date();
      this.setStatus("synced");
      return { success: true, syncedVaults: 1, conflicts: outcome.conflicts };
    }
    if (outcome.queued) this.setStatus("offline");
    return { success: false, error: outcome.error };
  }

  async deleteCloudVault(cloudId: string): Promise<SyncResult> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { error } = await cloudVaultService.deleteVault(cloudId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /** Debounced push for a vault after local changes. */
  debouncedSyncVault(
    vaultManager: VaultManager,
    vaultId: string,
    delayMs: number = 2000,
  ): void {
    const existingTimer = this.syncDebounceTimers.get(vaultId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      this.syncDebounceTimers.delete(vaultId);
      const result = await this.syncVaultToCloud(vaultManager, vaultId);
      if (!result.success && result.error) {
        console.warn(`Auto-sync failed for vault ${vaultId}:`, result.error);
      }
    }, delayMs);

    this.syncDebounceTimers.set(vaultId, timer);
  }

  /**
   * Clear sync state for logout WITHOUT destroying local vaults.
   * Local-only vaults survive logout so the user doesn't lose their notes
   * just because they signed out. Only sync timers, the offline queue,
   * and the base-version cache are cleared.
   */
  async clearLocalData(): Promise<void> {
    this.syncDebounceTimers.forEach((timer) => clearTimeout(timer));
    this.syncDebounceTimers.clear();
    await syncEngine.clearQueue();
    this.lastSyncTime = null;
    this.setStatus("idle");

    // Clear the base-version cache so stale timestamps don't cause false
    // conflicts on the next login.
    try {
      localStorage.removeItem("vault_sync_base_versions");
    } catch {
      /* ignore */
    }
  }
}

export const vaultSyncService = new VaultSyncService();
