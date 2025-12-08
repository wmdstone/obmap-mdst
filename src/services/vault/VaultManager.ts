/**
 * VaultManager - Multi-Vault Orchestrator
 * 
 * Manages multiple vaults (in-memory and local folder), handles switching,
 * and coordinates with VaultStorage for persistence
 */

import { GraphService } from '../graph/GraphService';
import { VaultStorage } from './VaultStorage';
import { VaultHistory } from './VaultHistory';
import { VaultBackupService } from './VaultBackupService';
import { DatabaseSyncService } from '../database/DatabaseSyncService';
import { FileSystemService } from '../persistence/FileSystemService';

interface BackupConfig {
  timeIntervalMinutes: number;
  changeThreshold: number;
  maxSnapshots: number;
}

interface Vault {
  id: string;
  name: string;
  type: 'in-memory' | 'local-folder';
  graphService: GraphService;
  history: VaultHistory;
  persistenceService?: FileSystemService;
  directoryHandle?: FileSystemDirectoryHandle;
  createdAt: number;
  lastModified: number;
  graphConfig?: any; // Per-vault graph configuration
  backupConfig?: BackupConfig; // Per-vault backup configuration
}

export class VaultManager {
  private vaults: Map<string, Vault> = new Map();
  private activeVaultId: string | null = null;
  private storage: VaultStorage;
  private backupService: VaultBackupService;
  private syncService: DatabaseSyncService;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.storage = new VaultStorage();
    this.backupService = new VaultBackupService();
    this.syncService = new DatabaseSyncService();
  }

  async initialize(): Promise<void> {
    // Make initialization idempotent - only run once
    if (this.initialized) {
      console.log("VaultManager: Already initialized, skipping");
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log("VaultManager: Initialization in progress, waiting");
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log("VaultManager: Starting initialization");
      await this.storage.initialize();
      console.log("VaultManager: Storage initialized");
      await this.loadVaultsFromStorage();
      console.log("VaultManager: Vaults loaded from storage");
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
      if (metadata.type === 'in-memory') {
        const vaultData = await this.storage.getVault(metadata.id);
        if (vaultData) {
          const vault = await this.restoreVault(vaultData);
          this.vaults.set(vault.id, vault);
        }
      }
      // Local folder vaults need to be reopened by user
    }
  }

  private async restoreVault(vaultData: any): Promise<Vault> {
    const graphService = new GraphService();
    graphService.initialize();
    
    // Restore graph data using proper methods
    vaultData.graphData.nodes.forEach((node: any) => {
      graphService.setNode(node);
    });
    graphService.setLinks(vaultData.graphData.links || []);

    const history = new VaultHistory();
    history.setState(vaultData.history);

    return {
      id: vaultData.metadata.id,
      name: vaultData.metadata.name,
      type: vaultData.metadata.type,
      graphService,
      history,
      graphConfig: vaultData.graphConfig || null,
      backupConfig: vaultData.backupConfig || null,
      createdAt: vaultData.metadata.createdAt,
      lastModified: vaultData.metadata.lastModified,
    };
  }

  async createInMemoryVault(name: string): Promise<string> {
    try {
      console.log("VaultManager: Creating vault", name);
      const vaultId = `vault-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const graphService = new GraphService();
      graphService.initialize();

      const vault: Vault = {
        id: vaultId,
        name,
        type: 'in-memory',
        graphService,
        history: new VaultHistory(),
        createdAt: Date.now(),
        lastModified: Date.now(),
      };

      this.vaults.set(vaultId, vault);
      console.log("VaultManager: Persisting vault");
      await this.persistVault(vault);
      console.log("VaultManager: Vault persisted successfully");

      return vaultId;
    } catch (error) {
      console.error("VaultManager: Error creating vault:", error);
      throw error;
    }
  }

  async openLocalFolderVault(): Promise<string | null> {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      
      const vaultId = `vault-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const graphService = new GraphService();
      graphService.initialize();
      
      const persistenceService = new FileSystemService();
      const result = await persistenceService.openVault();
      
      if (!result) return null;

      // Read vault structure
      await persistenceService.readVaultStructure(result.handle);
      graphService.finalizeGraph();

      // Read embedded vault config from .vault-config.json
      const embeddedConfig = await persistenceService.readVaultConfig();

      const vault: Vault = {
        id: vaultId,
        name: result.vaultName,
        type: 'local-folder',
        graphService,
        history: new VaultHistory(),
        persistenceService,
        directoryHandle: result.handle,
        createdAt: Date.now(),
        lastModified: Date.now(),
        graphConfig: embeddedConfig?.graphConfig || null,
        backupConfig: embeddedConfig?.backupConfig || null,
      };

      this.vaults.set(vaultId, vault);
      
      // Store metadata only for local folder vaults
      await this.storage.saveVault({
        metadata: {
          id: vault.id,
          name: vault.name,
          type: vault.type,
          createdAt: vault.createdAt,
          lastModified: vault.lastModified,
          nodeCount: graphService.getGraphData().nodes.length,
          linkCount: graphService.getGraphData().links.length,
        },
        graphData: { nodes: [], links: [] },
        history: { past: [], future: [] },
      });

      return vaultId;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
      return null;
    }
  }

  async switchVault(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    // Save current vault state if active
    if (this.activeVaultId) {
      const currentVault = this.vaults.get(this.activeVaultId);
      if (currentVault && currentVault.type === 'in-memory') {
        await this.persistVault(currentVault);
      }
    }

    this.activeVaultId = vaultId;
    vault.lastModified = Date.now();
    
    return true;
  }

  async deleteVault(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;

    if (vault.persistenceService) {
      vault.persistenceService.closeVault();
    }
    vault.graphService.cleanup();

    this.backupService.stopAutoBackup(vaultId);
    await this.storage.deleteVaultBackups(vaultId);

    this.vaults.delete(vaultId);
    await this.storage.deleteVault(vaultId);

    if (this.activeVaultId === vaultId) {
      this.activeVaultId = null;
    }
  }

  getActiveVault(): Vault | null {
    if (!this.activeVaultId) return null;
    return this.vaults.get(this.activeVaultId) || null;
  }

  getAllVaults(): Vault[] {
    return Array.from(this.vaults.values());
  }

  getVaultStats(vaultId: string) {
    const vault = this.vaults.get(vaultId);
    if (!vault) return null;

    const graphData = vault.graphService.getGraphData();
    const files = graphData.nodes.filter(n => n.type === 'file');
    const folders = graphData.nodes.filter(n => n.type === 'folder');
    
    // Calculate unique tags
    const allTags = new Set<string>();
    graphData.nodes.forEach(node => {
      node.tags?.forEach(tag => allTags.add(tag));
    });

    // Calculate orphaned nodes (nodes with no links)
    const connectedNodes = new Set<string>();
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      connectedNodes.add(sourceId);
      connectedNodes.add(targetId);
    });
    const orphanedNodes = graphData.nodes.filter(n => !connectedNodes.has(n.id) && n.type === 'file').length;

    // Calculate average connections per node
    const avgConnections = graphData.nodes.length > 0 
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
    const vault = this.vaults.get(vaultId);
    return vault ? vault.history.canUndo() : false;
  }

  canRedo(vaultId: string): boolean {
    const vault = this.vaults.get(vaultId);
    return vault ? vault.history.canRedo() : false;
  }

  async undo(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    const previousState = vault.history.undo();
    if (!previousState) return false;

    // Restore graph state using proper methods
    vault.graphService.clearGraph();
    
    previousState.nodes.forEach(node => {
      vault.graphService.setNode(node);
    });
    vault.graphService.setLinks(previousState.links);

    await this.persistVault(vault);
    return true;
  }

  async redo(vaultId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    const nextState = vault.history.redo();
    if (!nextState) return false;

    // Restore graph state using proper methods
    vault.graphService.clearGraph();
    
    nextState.nodes.forEach(node => {
      vault.graphService.setNode(node);
    });
    vault.graphService.setLinks(nextState.links);

    await this.persistVault(vault);
    return true;
  }

  getVault(vaultId: string): Vault | null {
    return this.vaults.get(vaultId) || null;
  }

  private async persistVault(vault: Vault): Promise<void> {
    if (vault.type !== 'in-memory') return;

    const graphData = vault.graphService.getGraphData();
    
    await this.storage.saveVault({
      metadata: {
        id: vault.id,
        name: vault.name,
        type: vault.type,
        createdAt: vault.createdAt,
        lastModified: vault.lastModified,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
      },
      graphData,
      history: vault.history.getState(),
      graphConfig: vault.graphConfig || undefined,
      backupConfig: vault.backupConfig || undefined,
    });
  }

  // Graph config management
  getGraphConfig(vaultId: string): any | null {
    const vault = this.vaults.get(vaultId);
    return vault?.graphConfig || null;
  }

  async setGraphConfig(vaultId: string, config: any): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;
    
    vault.graphConfig = config;
    vault.lastModified = Date.now();

    // For local-folder vaults, write to .vault-config.json in the vault directory
    if (vault.type === 'local-folder' && vault.persistenceService) {
      await vault.persistenceService.writeVaultConfig({
        graphConfig: config,
        backupConfig: vault.backupConfig || undefined,
      });
    } else {
      // For in-memory vaults, persist to IndexedDB
      await this.persistVault(vault);
    }
  }

  async saveCurrentVault(): Promise<void> {
    if (!this.activeVaultId) return;
    
    const vault = this.vaults.get(this.activeVaultId);
    if (vault && vault.type === 'in-memory') {
      await this.persistVault(vault);
    }
  }

  // Backup Management
  async createBackup(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault || vault.type !== 'in-memory') return;

    const graphData = vault.graphService.getGraphData();
    const config = this.backupService.getConfig(vaultId);
    const snapshot = this.backupService.createSnapshot(vaultId, graphData.nodes, graphData.links);

    await this.storage.saveBackup(snapshot);
    await this.storage.pruneOldBackups(vaultId, config.maxSnapshots);
  }

  async getBackups(vaultId: string): Promise<any[]> {
    const config = this.backupService.getConfig(vaultId);
    return await this.storage.getBackups(vaultId, config.maxSnapshots);
  }

  async restoreBackup(vaultId: string, backupId: string): Promise<boolean> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return false;

    const backups = await this.storage.getBackups(vaultId, 1000);
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) return false;

    // Restore graph state using proper methods
    vault.graphService.clearGraph();
    
    backup.nodes.forEach((node: any) => {
      vault.graphService.setNode(node);
    });
    vault.graphService.setLinks(backup.links || []);

    // Clear and set history
    vault.history.clear();
    vault.history.addState(backup.nodes, backup.links);

    await this.persistVault(vault);
    return true;
  }

  async deleteBackup(backupId: string): Promise<void> {
    await this.storage.deleteBackup(backupId);
  }

  getBackupConfig(vaultId: string) {
    const vault = this.vaults.get(vaultId);
    // Return per-vault config if available, otherwise get from backup service
    if (vault?.backupConfig) {
      return vault.backupConfig;
    }
    return this.backupService.getConfig(vaultId);
  }

  async setBackupConfig(vaultId: string, config: any): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) return;

    // Store config in vault for persistence
    vault.backupConfig = config;
    vault.lastModified = Date.now();
    
    // Update backup service
    this.backupService.setConfig(vaultId, config);
    
    // Persist to storage
    await this.persistVault(vault);
    
    // Restart auto backup with new config
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

  // Database Sync Management
  getSyncService(): DatabaseSyncService {
    return this.syncService;
  }

  async syncVaultToCloud(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault || vault.type !== 'in-memory') return;

    const graphData = vault.graphService.getGraphData();
    await this.syncService.syncVault({
      vaultId: vault.id,
      name: vault.name,
      type: vault.type,
      nodes: graphData.nodes,
      links: graphData.links,
      lastModified: vault.lastModified,
    });
  }

  async pullVaultsFromCloud(userId?: string): Promise<void> {
    const cloudVaults = await this.syncService.pullVaults(userId);
    
    for (const cloudVault of cloudVaults) {
      // Check if vault already exists locally
      const existingVault = this.vaults.get(cloudVault.vaultId);
      
      if (!existingVault) {
        // Create new vault from cloud data
        const graphService = new GraphService();
        graphService.initialize();
        
        cloudVault.nodes.forEach(node => {
          graphService.setNode(node);
        });
        graphService.setLinks(cloudVault.links || []);

        const vault: Vault = {
          id: cloudVault.vaultId,
          name: cloudVault.name,
          type: 'in-memory',
          graphService,
          history: new VaultHistory(),
          createdAt: Date.now(),
          lastModified: cloudVault.lastModified,
        };

        this.vaults.set(vault.id, vault);
        await this.persistVault(vault);
      }
    }
  }
}
