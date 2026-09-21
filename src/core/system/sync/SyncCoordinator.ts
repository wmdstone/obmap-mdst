/**
 * SyncCoordinator — the single place that decides when a vault sync runs.
 *
 * One auth subscription, one `online` listener, and a mutex + debounce so
 * overlapping requests (login effect, focus, reconnect, …) collapse into a
 * single sync instead of a burst.
 */

import { supabase } from "@/integrations/supabase/client";
import { vaultSyncService } from "@/core/system/vault/VaultSyncService";
import { getVaultManager } from "@/core/system/vault/VaultManagerSingleton";

export type SyncReason = "login" | "online" | "manual";

interface CoordinatorResult {
  success: boolean;
  syncedVaults?: number;
}

const DEBOUNCE_MS = 300;

class SyncCoordinator {
  private started = false;
  private runPromise: Promise<CoordinatorResult | undefined> | null = null;
  private rerun = false;

  /** Wire the global triggers once (called from the app bootstrap). */
  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    supabase.auth.onAuthStateChange((event, session) => {
      // Only a fresh sign-in pulls; token refreshes must not.
      if (event === "SIGNED_IN" && session) void this.requestSync("login");
    });

    window.addEventListener("online", () => void this.requestSync("online"));
  }

  /**
   * Ask for a sync. Concurrent callers share one run; a request that lands
   * while a run is in flight schedules exactly one follow-up run.
   */
  requestSync(reason: SyncReason = "manual"): Promise<CoordinatorResult | undefined> {
    void reason;
    if (this.runPromise) {
      this.rerun = true;
      return this.runPromise;
    }

    this.runPromise = (async () => {
      // Debounce window: absorb bursts of requests fired in the same tick.
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
      let result: CoordinatorResult | undefined;
      do {
        this.rerun = false;
        result = await this.run();
      } while (this.rerun);
      return result;
    })().finally(() => {
      this.runPromise = null;
    });

    return this.runPromise;
  }

  private async run(): Promise<CoordinatorResult | undefined> {
    const manager = getVaultManager();
    await manager.initialize();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return undefined;
    return vaultSyncService.syncFromCloud(manager);
  }
}

export const syncCoordinator = new SyncCoordinator();
