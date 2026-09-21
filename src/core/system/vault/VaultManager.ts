/**
 * VaultManager - Multi-Vault Orchestrator
 *
 * A vault has two independent settings:
 * - location: 'folder' (Markdown files in a real folder) or 'cloud' (in the account)
 * - cloudSync: whether the vault is mirrored to the user's cloud account
 *
 * Folder vaults get a derived `.vault-config.json` export at their root.
 * Cloud vaults keep the same structure in IndexedDB + the cloud record.
 */

import { GraphService } from "../../graph/GraphService";
import { VaultStorage } from "./VaultStorage";
import { VaultHistory } from "./VaultHistory";
import { VaultBackupService } from "./VaultBackupService";
import type { FileSystemService } from "../persistence/FileSystemService";
import { getFileSystemService } from "../persistence/FileSystemServiceSingleton";
import { directoryHandleStore } from "../persistence/directoryHandleStore";
import { hasGrantedPermission } from "./repository/capabilities";
import { writeVaultConfigFile } from "../config/VaultConfigFile";
import {
  BackupConfig,
  VaultLocation,
  VaultGraphConfig,
  VaultConfigSnapshot,
  migrateLegacyStrategy,
} from "./types";
import {
  emitVaultCreated,
  emitVaultDeleted,
  emitVaultRenamed,
  emitVaultSwitched,
} from "@/shared/events/events";

export interface Vault {
  id: string;
  name: string;
  /** Where the notes physically live. */
  location: VaultLocation;
  /** Mirrored to the user's cloud account. */
  cloudSync: boolean;
  /** Legacy shape kept for older UI props: folder vaults are 'local-folder'. */
  type: "in-memory" | "local-folder";
  cloudId?: string;
  graphService: GraphService;
  history: VaultHistory;
  persistenceService?: FileSystemService;
  directoryHandle?: FileSystemDirectoryHandle;
  createdAt: number;
  lastModified: number;
  graphConfig?: VaultGraphConfig | null;
  backupConfig?: BackupConfig | null;
  settings?: Record<string, any>;
  workspaceLayout?: any;
}

/**
 * A vault id is a UUID that doubles as the primary key of its cloud row
 * (`user_vaults.id`), so one vault is the same identity on every device.
 */
const newVaultId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `vault-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export class VaultManager {
  private vaults: Map<string, Vault> = new Map();
  private activeVaultId: string | null = null;
  private static readonly ACTIVE_KEY = "obmap.activeVaultId";
  private storage: VaultStorage;
  private backupService: VaultBackupService;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.storage = new VaultStorage();
    this.backupService = new VaultBackupService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      await this.storage.initialize();
      await this.loadVaultsFromStorage();
      this.restoreActiveVault();
      this.initialized = true;
    } catch (error) {
      console.error("VaultManager: Initialization failed", error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private async loadVaultsFromStorage(): Promise<void> {
    const vaultMetadata = await this.storage.getAllVaults();

    for (const metadata of vaultMetadata) {
      const { location } = migrateLegacyStrategy(
        (metadata as any).storageStrategy,
        (metadata as any).type,
      );
      const resolvedLocation: VaultLocation =
        (metadata as any).location ?? location;

      // Folder vaults reopen through their remembered directory handle
      // (with a permission prompt on the next click when access expired).
      if (resolvedLocation === "folder") {
        const restored = await this.tryRestoreFolderVault(metadata);
        if (restored) this.vaults.set(restored.id, restored);
        continue;
      }

      const vaultData = await this.storage.getVault(metadata.id);
      if (vaultData) {
        const vault = await this.restoreVault(vaultData);
        this.vaults.set(vault.id, vault);
      }
    }
  }

  /** Reopen the vault the user was last working in, when it is still available. */
  private restoreActiveVault(): void {
    try {
      const saved = localStorage.getItem(VaultManager.ACTIVE_KEY);
      if (saved && this.vaults.has(saved)) {
        this.activeVaultId = saved;
        return;
      }
    } catch {
      /* private mode — fall back to the first vault */
    }
    const first = this.vaults.keys().next();
    if (!first.done) this.activeVaultId = first.value;
  }

  private rememberActiveVault(): void {
    try {
      if (this.activeVaultId)
        localStorage.setItem(VaultManager.ACTIVE_KEY, this.activeVaultId);
      else localStorage.removeItem(VaultManager.ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }

  private async restoreVault(vaultData: any): Promise<Vault> {
    const graphService = new GraphService();
    graphService.initialize();

    (vaultData.graphData?.nodes ?? []).forEach((node: any) =>
      graphService.setNode(node),
    );
    graphService.setLinks(vaultData.graphData?.links || []);

    const history = new VaultHistory();
    history.setState(vaultData.history);

    const legacy = migrateLegacyStrategy(
      vaultData.metadata.storageStrategy,
      vaultData.metadata.type,
    );
    const location: VaultLocation =
      vaultData.metadata.location ?? legacy.location;
    const cloudSync: boolean = vaultData.metadata.cloudSync ?? legacy.cloudSync;

    return {
      id: vaultData.metadata.id,
      name: vaultData.metadata.name,
      location,
      cloudSync,
      type: location === "folder" ? "local-folder" : "in-memory",
      cloudId: vaultData.metadata.cloudId,
      graphService,
      history,
      graphConfig: vaultData.graphConfig || null,
      backupConfig: vaultData.backupConfig || null,
      settings: vaultData.settings || {},
      workspaceLayout: vaultData.workspaceLayout || null,
      createdAt: vaultData.metadata.createdAt,
      lastModified: vaultData.metadata.lastModified,
    };
  }

  /**
   * Rebuild a folder vault from its remembered directory handle. When the
   * browser still grants read/write access the notes are read immediately;
   * otherwise the vault comes back as a shell and `switchVault` asks for
   * permission again on the user's next click.
   */
  private async tryRestoreFolderVault(metadata: any): Promise<Vault | null> {
    try {
      const handle = await directoryHandleStore.get(metadata.id);
      if (!handle) return null;
      const vaultData = await this.storage.getVault(metadata.id);
      if (!vaultData) return null;

      const graphService = new GraphService();
      graphService.initialize();

      const vault: Vault = {
        id: vaultData.metadata.id,
        name: vaultData.metadata.name,
        location: "folder",
        cloudSync: vaultData.metadata.cloudSync ?? false,
        type: "local-folder",
        cloudId: vaultData.metadata.cloudId,
        graphService,
        history: new VaultHistory(),
        directoryHandle: handle,
        graphConfig: vaultData.graphConfig || null,
        backupConfig: vaultData.backupConfig || null,
        settings: vaultData.settings || {},
        workspaceLayout: vaultData.workspaceLayout || null,
        createdAt: vaultData.metadata.createdAt,
        lastModified: vaultData.metadata.lastModified,
      };

      if (await hasGrantedPermission(handle)) {
        await this.readFolderInto(vault);
      }
      return vault;
    } catch (error) {
      console.warn(
        "VaultManager: could not restore folder vault",
        metadata?.id,
        error,
      );
      return null;
    }
  }

  /**
   * Attach the shared file service to a vault's folder and read its notes.
   * `verifyPermission` prompts when access was not granted yet, so this must
   * only run inside a user gesture (or right after the picker).
   */
  private async readFolderInto(vault: Vault): Promise<boolean> {
    if (!vault.directoryHandle) return false;
    const fs = getFileSystemService();
    if (!(await fs.verifyPermission(vault.directoryHandle))) return false;
    fs.attach(vault.directoryHandle);
    vault.persistenceService = fs;
    await fs.readVaultStructure(vault.directoryHandle);
    vault.graphService.finalizeGraph();
    return true;
  }

  /** Re-ask permission for a folder vault whose notes have not been read. */
  async reconnectFolderVault(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;
    const ok = await this.readFolderInto(vault);
    if (ok) await this.persistVault(vault);
    return ok;
  }

  // ---------------------------------------------------------------- creation

  /** A vault that lives in the user's account (no folder on this computer). */
  async createCloudVault(
    name: string,
    cloudSync = true,
    id?: string,
  ): Promise<string> {
    const vaultId = id ?? newVaultId();
    const graphService = new GraphService();
    graphService.initialize();

    const vault: Vault = {
      id: vaultId,
      name,
      location: "cloud",
      cloudSync,
      type: "in-memory",
      graphService,
      history: new VaultHistory(),
      createdAt: Date.now(),
      lastModified: Date.now(),
      settings: {},
    };

    this.vaults.set(vaultId, vault);
    this.activeVaultId = vaultId;
    this.rememberActiveVault();
    await this.persistVault(vault);
    emitVaultCreated({ vaultId, vaultName: name, storageStrategy: "cloud" });
    return vaultId;
  }

  /**
   * Attach an already-picked folder handle as a vault.
   * `createSubfolder` creates a new folder with that name inside the handle.
   * Exactly one folder prompt happens in the caller — never here.
   */
  async openFolderVault(
    handle: FileSystemDirectoryHandle,
    options: { createSubfolder?: string; cloudSync?: boolean } = {},
  ): Promise<string> {
    let root = handle;
    if (options.createSubfolder) {
      const safe = options.createSubfolder.replace(/[\\/:*?"<>|]/g, "").trim();
      if (!safe) throw new Error("Please choose a valid vault name");
      root = await handle.getDirectoryHandle(safe, { create: true });
    }

    const vaultId = newVaultId();
    const graphService = new GraphService();
    graphService.initialize();

    const persistenceService = getFileSystemService();
    persistenceService.attach(root);

    const granted = await persistenceService.verifyPermission(root);
    if (!granted)
      throw new Error("Permission to write in this folder was denied");

    await persistenceService.readVaultStructure(root);
    graphService.finalizeGraph();

    const vault: Vault = {
      id: vaultId,
      name: root.name,
      location: "folder",
      cloudSync: options.cloudSync ?? false,
      type: "local-folder",
      graphService,
      history: new VaultHistory(),
      persistenceService,
      directoryHandle: root,
      createdAt: Date.now(),
      lastModified: Date.now(),
      // Settings are owned by ConfigService; the file is a derived export.
      graphConfig: null,
      backupConfig: null,
      settings: {},
      workspaceLayout: null,
    };

    this.vaults.set(vaultId, vault);
    this.activeVaultId = vaultId;
    this.rememberActiveVault();
    await this.persistVault(vault);
    await directoryHandleStore.put(vaultId, root);
    emitVaultCreated({
      vaultId,
      vaultName: vault.name,
      storageStrategy: "folder",
    });
    return vaultId;
  }

  /** Attach a folder to an existing cloud vault so its notes are written to disk. */
  async attachFolder(
    vaultId: string,
    handle: FileSystemDirectoryHandle,
  ): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    const persistenceService = getFileSystemService();
    persistenceService.attach(handle);
    if (!(await persistenceService.verifyPermission(handle))) return false;

    vault.persistenceService = persistenceService;
    vault.directoryHandle = handle;
    vault.location = "folder";
    vault.type = "local-folder";
    vault.lastModified = Date.now();

    // Write current notes out to the folder.
    const { nodes } = vault.graphService.getGraphData();
    for (const node of nodes as any[]) {
      if (node.type === "folder" && node.path) {
        await persistenceService.ensureDirectory(node.path);
      }
    }
    for (const node of nodes as any[]) {
      if (node.type === "file" && node.path) {
        await persistenceService.saveFile(node.path, node.content ?? "");
      }
    }

    await this.writeConfigExport(vault);
    await this.persistVault(vault);
    await directoryHandleStore.put(vaultId, handle);
    return true;
  }

  // ------------------------------------------------------------ cloud toggle

  /** Turn cloud sync on or off for a vault, regardless of where its files live. */
  async setCloudSync(
    vaultId: string,
    enabled: boolean,
  ): Promise<{ needsCloudSync: boolean; cloudId?: string }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return { needsCloudSync: false };

    const previousCloudId = vault.cloudId;
    vault.cloudSync = enabled;
    vault.lastModified = Date.now();
    if (!enabled) vault.cloudId = undefined;

    await this.writeConfigExport(vault);
    await this.persistVault(vault);
    return { needsCloudSync: enabled, cloudId: previousCloudId };
  }

  getCloudVaults(): Vault[] {
    return Array.from(this.vaults.values()).filter((v) => v.cloudSync);
  }

  getFolderVaults(): Vault[] {
    return Array.from(this.vaults.values()).filter(
      (v) => v.location === "folder",
    );
  }

  // ------------------------------------------------------------- vault state

  async switchVault(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    if (this.activeVaultId && this.activeVaultId !== vaultId) {
      const current = this.vaults.get(this.activeVaultId);
      if (current) await this.persistVault(current);
    }

    // `.vault-config.json` is a derived export, never a source of truth:
    // settings always come from ConfigService.
    if (vault.directoryHandle) {
      const granted = await vault.persistenceService?.verifyPermission(
        vault.directoryHandle,
      );
      if (granted) await this.writeConfigExport(vault);
    }

    // A folder vault restored from its handle may not have read its notes
    // yet; asking for permission now is fine because the user just clicked.
    if (
      vault.location === "folder" &&
      vault.directoryHandle &&
      !vault.persistenceService
    ) {
      const reconnected = await this.readFolderInto(vault);
      if (reconnected) await this.persistVault(vault);
    }

    this.activeVaultId = vaultId;
    this.rememberActiveVault();
    vault.lastModified = Date.now();
    emitVaultSwitched(vaultId);
    return true;
  }

  async deleteVault(
    vaultId: string,
  ): Promise<{ cloudId?: string; wasCloudVault: boolean }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return { wasCloudVault: false };

    const wasCloudVault = vault.cloudSync;
    const cloudId = vault.cloudId;

    // Remove the cloud copy too, so a vault deleted on one device does not
    // reappear on another. Best-effort: offline deletion is left to the caller.
    if (cloudId && wasCloudVault && navigator.onLine) {
      try {
        const { cloudVaultService } = await import("./CloudVaultService");
        await cloudVaultService.deleteVault(cloudId);
      } catch (error) {
        console.warn("Cloud vault deletion failed:", error);
      }
    }

    vault.persistenceService?.closeVault();
    vault.graphService.cleanup();

    this.backupService.stopAutoBackup(vaultId);
    await this.storage.deleteVaultBackups(vaultId);

    this.vaults.delete(vaultId);
    await this.storage.deleteVault(vaultId);
    await directoryHandleStore.remove(vaultId);

    if (this.activeVaultId === vaultId) {
      this.activeVaultId = this.vaults.keys().next().value ?? null;
      this.rememberActiveVault();
    }

    emitVaultDeleted({ vaultId, wasCloudVault });
    return { cloudId, wasCloudVault };
  }

  getActiveVault(): Vault | null {
    if (!this.activeVaultId) return null;
    return this.vaults.get(this.activeVaultId) || null;
  }

  getAllVaults(): Vault[] {
    return Array.from(this.vaults.values());
  }

  getVault(vaultId: string): Vault | null {
    return this.vaults.get(vaultId) || null;
  }

  getVaultStats(vaultId: string) {
    const vault = this.vaults.get(vaultId);
    if (!vault) return null;

    const graphData = vault.graphService.getGraphData();
    const files = graphData.nodes.filter((n) => n.type === "file");
    const folders = graphData.nodes.filter((n) => n.type === "folder");

    const allTags = new Set<string>();
    graphData.nodes.forEach((node) =>
      node.tags?.forEach((tag) => allTags.add(tag)),
    );

    const connectedNodes = new Set<string>();
    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      connectedNodes.add(sourceId);
      connectedNodes.add(targetId);
    });
    const orphanedNodes = graphData.nodes.filter(
      (n) => !connectedNodes.has(n.id) && n.type === "file",
    ).length;

    const avgConnections =
      graphData.nodes.length > 0
        ? (graphData.links.length * 2) / graphData.nodes.length
        : 0;

    return {
      fileCount: files.length,
      folderCount: folders.length,
      tagCount: allTags.size,
      orphanedNodes,
      avgConnections,
    };
  }

  canUndo(vaultId: string): boolean {
    return this.vaults.get(vaultId)?.history.canUndo() ?? false;
  }

  canRedo(vaultId: string): boolean {
    return this.vaults.get(vaultId)?.history.canRedo() ?? false;
  }

  async undo(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;
    const previousState = vault.history.undo();
    if (!previousState) return false;

    vault.graphService.clearGraph();
    previousState.nodes.forEach((node) => vault.graphService.setNode(node));
    vault.graphService.setLinks(previousState.links);
    await this.persistVault(vault);
    return true;
  }

  async redo(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;
    const nextState = vault.history.redo();
    if (!nextState) return false;

    vault.graphService.clearGraph();
    nextState.nodes.forEach((node) => vault.graphService.setNode(node));
    vault.graphService.setLinks(nextState.links);
    await this.persistVault(vault);
    return true;
  }

  async renameVault(vaultId: string, newName: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault || !newName.trim()) return false;

    const oldName = vault.name;
    vault.name = newName.trim();
    vault.lastModified = Date.now();
    await this.writeConfigExport(vault);
    await this.persistVault(vault);
    emitVaultRenamed({ vaultId, oldName, newName: vault.name });
    return true;
  }

  // ----------------------------------------------------------- persistence

  private async persistVault(vault: Vault): Promise<void> {
    const graphData = vault.graphService.getGraphData();
    const isFolder = vault.location === "folder";

    await this.storage.saveVault({
      metadata: {
        id: vault.id,
        name: vault.name,
        location: vault.location,
        cloudSync: vault.cloudSync,
        cloudId: vault.cloudId,
        createdAt: vault.createdAt,
        lastModified: vault.lastModified,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
      },
      // Folder vaults keep their notes on disk; only metadata is cached.
      graphData: isFolder ? { nodes: [], links: [] } : graphData,
      history: isFolder ? { past: [], future: [] } : vault.history.getState(),
      graphConfig: vault.graphConfig || undefined,
      backupConfig: vault.backupConfig || undefined,
      settings: vault.settings || undefined,
      workspaceLayout: vault.workspaceLayout || undefined,
    });
  }

  /** Write the derived `.vault-config.json` export for folder vaults. */
  private async writeConfigExport(vault: Vault): Promise<void> {
    await writeVaultConfigFile(vault.directoryHandle);
  }

  async setCloudId(vaultId: string, cloudId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.cloudId = cloudId;
    await this.writeConfigExport(vault);
    await this.persistVault(vault);
  }

  /** Full portable config for a vault (used by settings and the workspace). */
  getVaultConfig(vaultId: string): VaultConfigSnapshot | null {
    const vault = this.vaults.get(vaultId);
    if (!vault) return null;
    return {
      vault: {
        id: vault.id,
        name: vault.name,
        createdAt: vault.createdAt,
        cloudSync: vault.cloudSync,
        cloudId: vault.cloudId,
      },
      settings: vault.settings ?? {},
      graph: vault.graphConfig ?? null,
      workspace: vault.workspaceLayout ?? null,
      backup: vault.backupConfig ?? null,
    };
  }

  getGraphConfig(vaultId: string): VaultGraphConfig | null {
    return this.vaults.get(vaultId)?.graphConfig ?? null;
  }

  async setGraphConfig(
    vaultId: string,
    config: VaultGraphConfig,
  ): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.graphConfig = config;
    vault.lastModified = Date.now();
    await this.writeConfigExport(vault);
    await this.persistVault(vault);
  }

  getSettings(vaultId: string): Record<string, any> {
    return this.vaults.get(vaultId)?.settings ?? {};
  }

  async setSettings(
    vaultId: string,
    settings: Record<string, any>,
  ): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.settings = settings;
    vault.lastModified = Date.now();
    await this.writeConfigExport(vault);
    await this.persistVault(vault);
  }

  async setWorkspaceLayout(vaultId: string, layout: any): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.workspaceLayout = layout;
    await this.writeConfigExport(vault);
    await this.persistVault(vault);
  }

  async saveCurrentVault(): Promise<void> {
    if (!this.activeVaultId) return;
    const vault = this.vaults.get(this.activeVaultId);
    if (vault) await this.persistVault(vault);
  }

  // ------------------------------------------------------------- backups

  async createBackup(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;

    const graphData = vault.graphService.getGraphData();
    const config = this.getBackupConfig(vaultId);
    const snapshot = this.backupService.createSnapshot(
      vaultId,
      graphData.nodes,
      graphData.links,
    );

    await this.storage.saveBackup(snapshot);
    await this.storage.pruneOldBackups(vaultId, config.maxSnapshots);
  }

  async getBackups(vaultId: string): Promise<any[]> {
    const config = this.getBackupConfig(vaultId);
    return this.storage.getBackups(vaultId, config.maxSnapshots);
  }

  async restoreBackup(vaultId: string, backupId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    const backups = await this.storage.getBackups(vaultId, 1000);
    const backup = backups.find((b) => b.id === backupId);
    if (!backup) return false;

    vault.graphService.clearGraph();
    backup.nodes.forEach((node: any) => vault.graphService.setNode(node));
    vault.graphService.setLinks(backup.links || []);

    vault.history.clear();
    vault.history.addState(backup.nodes, backup.links);

    await this.persistVault(vault);
    return true;
  }

  async deleteBackup(backupId: string): Promise<void> {
    await this.storage.deleteBackup(backupId);
  }

  getBackupConfig(vaultId: string): BackupConfig {
    const vault = this.vaults.get(vaultId);
    return vault?.backupConfig ?? this.backupService.getConfig(vaultId);
  }

  async setBackupConfig(vaultId: string, config: BackupConfig): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;

    vault.backupConfig = config;
    vault.lastModified = Date.now();
    this.backupService.setConfig(vaultId, config);

    await this.writeConfigExport(vault);
    await this.persistVault(vault);

    this.backupService.stopAutoBackup(vaultId);
    this.backupService.startAutoBackup(vaultId, async () => {
      await this.createBackup(vaultId);
    });
  }

  startAutoBackup(vaultId: string): void {
    this.backupService.startAutoBackup(vaultId, async () => {
      await this.createBackup(vaultId);
    });
  }

  async recordVaultChange(vaultId: string): Promise<void> {
    await this.backupService.recordChange(vaultId, async () => {
      await this.createBackup(vaultId);
    });
  }

  stopAutoBackup(vaultId: string): void {
    this.backupService.stopAutoBackup(vaultId);
  }
}
