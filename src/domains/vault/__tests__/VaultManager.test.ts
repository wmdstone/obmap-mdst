import { describe, expect, it, beforeEach, vi } from 'vitest';
import { VaultManager } from '@/domains/vault/services/VaultManager';
import type { GraphNode, GraphLink } from '@/domains/graph/shared/api/RelationshipMapper';

describe('VaultManager Characterization Tests', () => {
  let vaultManager: VaultManager;
  let mockStorageStore: Map<string, any>;

  beforeEach(() => {
    mockStorageStore = new Map();

    // Mock localStorage untuk isolasi test suite
    const localStore = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, val: string) => localStore.set(key, val),
      removeItem: (key: string) => localStore.delete(key),
      clear: () => localStore.clear(),
    });

    vaultManager = new VaultManager();

    // Mock storage layer ke dalam memori agar tes berjalan deterministik dan instan
    (vaultManager as any).storage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAllVaults: vi.fn().mockImplementation(async () =>
        Array.from(mockStorageStore.values()).map((v) => v.metadata)
      ),
      getVault: vi.fn().mockImplementation(async (id: string) => mockStorageStore.get(id)),
      saveVault: vi.fn().mockImplementation(async (data: any) => {
        mockStorageStore.set(data.metadata.id, data);
      }),
      deleteVault: vi.fn().mockImplementation(async (id: string) => {
        mockStorageStore.delete(id);
      }),
      deleteVaultBackups: vi.fn().mockResolvedValue(undefined),
    };

    // Mock backup service
    (vaultManager as any).backupService = {
      stopAutoBackup: vi.fn(),
    };
  });

  it('creates a cloud vault and sets it as active', async () => {
    const vaultId = await vaultManager.createCloudVault('Research Hub', false);

    expect(vaultId).toBeTruthy();
    const activeVault = vaultManager.getActiveVault();
    expect(activeVault).not.toBeNull();
    expect(activeVault?.id).toBe(vaultId);
    expect(activeVault?.name).toBe('Research Hub');
    expect(activeVault?.location).toBe('cloud');
    expect(activeVault?.type).toBe('in-memory');
  });

  it('adds, reads, and retrieves notes in the vault graphService', async () => {
    const vaultId = await vaultManager.createCloudVault('Note Vault', false);
    const vault = vaultManager.getVault(vaultId)!;

    const sampleNode: GraphNode = {
      id: 'note-1',
      name: 'Architecture Plan',
      content: '# Architecture\nClean and modular',
      type: 'file',
      parentId: null,
      depth: 0,
      tags: ['plan', 'architecture'],
    };

    vault.graphService.setNode(sampleNode);

    const graphData = vault.graphService.getGraphData();
    const retrieved = graphData.nodes.find((n) => n.id === 'note-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Architecture Plan');
    expect(retrieved?.tags).toContain('architecture');
    expect(graphData.nodes.length).toBe(1);
  });

  it('manages links between notes in the vault graphService', async () => {
    const vaultId = await vaultManager.createCloudVault('Link Vault', false);
    const vault = vaultManager.getVault(vaultId)!;

    const link: GraphLink = {
      source: 'note-1',
      target: 'note-2',
      type: 'hierarchy',
    };

    vault.graphService.setLinks([link]);

    const graphData = vault.graphService.getGraphData();
    expect(graphData.links.length).toBe(1);
    expect(graphData.links[0].source).toBe('note-1');
    expect(graphData.links[0].target).toBe('note-2');
  });

  it('persists vault graph data to storage on saveCurrentVault', async () => {
    const vaultId = await vaultManager.createCloudVault('Persist Vault', false);
    const vault = vaultManager.getVault(vaultId)!;

    vault.graphService.setNode({
      id: 'doc-1',
      name: 'Doc 1',
      content: 'Important info',
      type: 'file',
      parentId: null,
      depth: 0,
      tags: [],
    });

    await vaultManager.saveCurrentVault();

    const storedData = mockStorageStore.get(vaultId);
    expect(storedData).toBeDefined();
    expect(storedData.metadata.name).toBe('Persist Vault');
    expect(storedData.graphData.nodes.length).toBe(1);
    expect(storedData.graphData.nodes[0].id).toBe('doc-1');
  });

  it('switches between multiple vaults cleanly', async () => {
    const vault1Id = await vaultManager.createCloudVault('Vault Alpha', false);
    const vault2Id = await vaultManager.createCloudVault('Vault Beta', false);

    expect(vaultManager.getActiveVault()?.id).toBe(vault2Id);

    const switched = await vaultManager.switchVault(vault1Id);
    expect(switched).toBe(true);
    expect(vaultManager.getActiveVault()?.id).toBe(vault1Id);

    const allVaults = vaultManager.getAllVaults();
    expect(allVaults.length).toBe(2);
  });

  it('renames an existing vault', async () => {
    const vaultId = await vaultManager.createCloudVault('Old Name', false);
    const success = await vaultManager.renameVault(vaultId, 'New Shiny Name');

    expect(success).toBe(true);
    expect(vaultManager.getVault(vaultId)?.name).toBe('New Shiny Name');
  });

  it('deletes a vault and updates active vault pointer', async () => {
    const v1 = await vaultManager.createCloudVault('Vault A', false);
    const v2 = await vaultManager.createCloudVault('Vault B', false);

    expect(vaultManager.getAllVaults().length).toBe(2);
    expect(vaultManager.getActiveVault()?.id).toBe(v2);

    const result = await vaultManager.deleteVault(v2);
    expect(result.wasCloudVault).toBe(false);
    expect(vaultManager.getVault(v2)).toBeNull();
    expect(vaultManager.getAllVaults().length).toBe(1);
    expect(vaultManager.getActiveVault()?.id).toBe(v1);
  });
});