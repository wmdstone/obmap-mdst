/**
 * IndexedDbVaultDriver - Storage driver untuk Cloud & In-Memory Vaults
 *
 * Mengelola persistensi catatan, struktur graph, riwayat (history),
 * dan konfigurasi ke dalam IndexedDB via VaultStorage.
 */

import { GraphService } from '@/domains/graph/services/GraphService';
import { VaultStorage } from '../services/VaultStorage';
import { VaultHistory } from '../services/VaultHistory';
import {
  Vault,
  VaultData,
  VaultLocation,
  VaultMetadata,
  migrateLegacyStrategy,
} from '../types';
import type { IVaultStorageDriver } from './IVaultStorageDriver';

export class IndexedDbVaultDriver implements IVaultStorageDriver {
  readonly location: VaultLocation = 'cloud';
  private storage: VaultStorage;

  constructor(storage?: VaultStorage) {
    this.storage = storage || new VaultStorage();
  }

  getStorage(): VaultStorage {
    return this.storage;
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async getAllMetadata(): Promise<VaultMetadata[]> {
    return this.storage.getAllVaults();
  }

  async restoreVault(metadata: VaultMetadata): Promise<Vault | null> {
    const vaultData = await this.storage.getVault(metadata.id);
    if (!vaultData) return null;

    const graphService = new GraphService();
    graphService.initialize();

    (vaultData.graphData?.nodes ?? []).forEach((node: any) =>
      graphService.setNode(node),
    );
    graphService.setLinks(vaultData.graphData?.links || []);

    const history = new VaultHistory();
    history.setState(vaultData.history);

    const legacy = migrateLegacyStrategy(
      (vaultData.metadata as any).storageStrategy,
      (vaultData.metadata as any).type,
    );
    const location: VaultLocation =
      vaultData.metadata.location ?? legacy.location;
    const cloudSync: boolean = vaultData.metadata.cloudSync ?? legacy.cloudSync;

    return {
      id: vaultData.metadata.id,
      name: vaultData.metadata.name,
      location,
      cloudSync,
      type: location === 'folder' ? 'local-folder' : 'in-memory',
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

  async persistVault(vault: Vault): Promise<void> {
    const graphData = vault.graphService.getGraphData();
    const isFolder = vault.location === 'folder';

    const vaultData: VaultData = {
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
      // Folder vaults menyimpan catatan di disk; IndexedDB hanya menyimpan metadata cache
      graphData: isFolder ? { nodes: [], links: [] } : graphData,
      history: isFolder ? { past: [], future: [] } : vault.history.getState(),
      graphConfig: vault.graphConfig || undefined,
      backupConfig: vault.backupConfig || undefined,
      settings: vault.settings || undefined,
      workspaceLayout: vault.workspaceLayout || undefined,
    };

    await this.storage.saveVault(vaultData);
  }

  async deleteVault(vaultId: string): Promise<void> {
    await this.storage.deleteVaultBackups(vaultId);
    await this.storage.deleteVault(vaultId);
  }
}