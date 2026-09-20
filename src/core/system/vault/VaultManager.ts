/**
 * VaultManager - Multi-Vault Orchestrator
 *
 * A vault has two independent settings:
 * - location: 'folder' (Markdown files in a real folder) or 'cloud' (in the account)
 * - cloudSync: whether the vault is mirrored to the user's cloud account
 *
 * Folder vaults keep their portable configuration inside `<vault>/.obmap`.
 * Cloud vaults keep the same structure in IndexedDB + the cloud record.
 */

import { GraphService } from "../../graph/GraphService";
import { VaultStorage } from "./VaultStorage";
import { VaultHistory } from "./VaultHistory";
import { VaultBackupService } from "./VaultBackupService";
import { FileSystemService } from "../persistence/FileSystemService";
import { ObmapConfigService, emptyObmapConfig } from "./ObmapConfigService";
import {
  BackupConfig,
  VaultLocation,
  VaultGraphConfig,
  ObmapConfig,
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
  obmap?: ObmapConfigService;
  createdAt: number;
  lastModified: number;
  graphConfig?: VaultGraphConfig | null;
  backupConfig?: BackupConfig | null;
  settings?: Record<string, any>;
  workspaceLayout?: any;
}

const newVaultId = () =>
  `vault-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

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

      // Folder vaults must be reopened by the user (handles are not portable).
      if (resolvedLocation === "folder") continue;

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

  // ---------------------------------------------------------------- creation

  /** A vault that lives in the user's account (no folder on this computer). */
  async createCloudVault(name: string, cloudSync = true): Promise<string> {
    const vaultId = newVaultId();
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

    const persistenceService = new FileSystemService();
    persistenceService.attach(root);

    const granted = await persistenceService.verifyPermission(root);
    if (!granted)
      throw new Error("Permission to write in this folder was denied");

    await persistenceService.readVaultStructure(root);
    graphService.finalizeGraph();

    // Portable config: create `.obmap` when the folder does not have one yet.
    const obmap = new ObmapConfigService(root);
    const config = await obmap.load({
      id: vaultId,
      name: root.name,
      createdAt: Date.now(),
      cloudSync: options.cloudSync ?? false,
    });

    const vault: Vault = {
      id: vaultId,
      name: config.vault.name || root.name,
      location: "folder",
      cloudSync: options.cloudSync ?? config.vault.cloudSync ?? false,
      type: "local-folder",
      cloudId: config.vault.cloudId,
      graphService,
      history: new VaultHistory(),
      persistenceService,
      directoryHandle: root,
      obmap,
      createdAt: config.vault.createdAt || Date.now(),
      lastModified: Date.now(),
      graphConfig: config.graph,
      backupConfig: config.backup ?? null,
      settings: config.settings ?? {},
      workspaceLayout: config.workspace ?? null,
    };

    this.vaults.set(vaultId, vault);
    this.activeVaultId = vaultId;
    this.rememberActiveVault();
    await this.persistVault(vault);
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

    const persistenceService = new FileSystemService();
    persistenceService.attach(handle);
    if (!(await persistenceService.verifyPermission(handle))) return false;

    vault.persistenceService = persistenceService;
    vault.directoryHandle = handle;
    vault.obmap = new ObmapConfigService(handle);
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

    await this.writeObmap(vault);
    await this.persistVault(vault);
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

    await this.writeObmap(vault);
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

    // Re-read portable config so the session follows this vault only.
    if (vault.obmap) {
      const granted = await vault.persistenceService?.verifyPermission(
        vault.directoryHandle,
      );
      if (granted) {
        const config = await vault.obmap.load({
          id: vault.id,
          name: vault.name,
          createdAt: vault.createdAt,
          cloudSync: vault.cloudSync,
          cloudId: vault.cloudId,
        });
        vault.graphConfig = config.graph;
        vault.backupConfig = config.backup ?? null;
        vault.settings = config.settings ?? {};
        vault.workspaceLayout = config.workspace ?? null;
      }
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

    vault.persistenceService?.closeVault();
    vault.graphService.cleanup();

    this.backupService.stopAutoBackup(vaultId);
    await this.storage.deleteVaultBackups(vaultId);

    this.vaults.delete(vaultId);
    await this.storage.deleteVault(vaultId);

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
    await this.writeObmap(vault);
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

  /** Write the portable `.obmap` config for folder vaults. */
  private async writeObmap(vault: Vault): Promise<void> {
    if (!vault.obmap) return;
    const config: ObmapConfig = {
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
    await vault.obmap.saveAll(config);
  }

  async setCloudId(vaultId: string, cloudId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.cloudId = cloudId;
    await vault.obmap?.saveVaultFile({
      id: vault.id,
      name: vault.name,
      createdAt: vault.createdAt,
      cloudSync: vault.cloudSync,
      cloudId,
    });
    await this.persistVault(vault);
  }

  /** Full portable config for a vault (used by settings and the workspace). */
  getVaultConfig(vaultId: string): ObmapConfig | null {
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
    await vault.obmap?.saveGraph(config);
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
    await vault.obmap?.saveSettings(settings);
    await this.persistVault(vault);
  }

  async setWorkspaceLayout(vaultId: string, layout: any): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    vault.workspaceLayout = layout;
    await vault.obmap?.saveWorkspace(layout);
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

    await vault.obmap?.saveBackup(config);
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

export { emptyObmapConfig };
