/**
 * The four storage adapters behind `VaultRepository`.
 *
 * They all speak the same `VaultRecord` shape, so nothing above this layer has
 * to know whether a vault lives in memory, IndexedDB, a folder on disk, or the
 * user's account.
 */

import type {
  VaultCapabilities,
  VaultRecord,
  VaultRepository,
  VaultSummary,
} from "./types";
import {
  FOLDER_UNSUPPORTED_REASON,
  supportsFolderPicker,
  supportsIndexedDb,
  supportsPersistentHandles,
} from "./capabilities";
import { VaultStorage } from "../VaultStorage";
import { cloudVaultService } from "../CloudVaultService";
import { getFileSystemService } from "@/core/system/persistence/FileSystemServiceSingleton";

// ------------------------------------------------------------------- memory

export class MemoryVaultRepository implements VaultRepository {
  readonly kind = "memory" as const;
  readonly capabilities: VaultCapabilities = {
    canWriteFolderConfig: false,
    canPersistHandle: false,
    canPersistData: false,
    canSyncCloud: false,
    unavailableReason: "This vault is only kept for the current session.",
  };

  private records = new Map<string, VaultRecord>();

  async list(): Promise<VaultSummary[]> {
    return [...this.records.values()].map(({ id, name, updatedAt }) => ({
      id,
      name,
      updatedAt,
    }));
  }

  async load(id: string): Promise<VaultRecord | null> {
    return this.records.get(id) ?? null;
  }

  async save(record: VaultRecord): Promise<void> {
    this.records.set(record.id, { ...record, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

// ---------------------------------------------------------------- indexeddb

export class IndexedDbVaultRepository implements VaultRepository {
  readonly kind = "indexeddb" as const;
  readonly capabilities: VaultCapabilities = {
    canWriteFolderConfig: false,
    canPersistHandle: false,
    canPersistData: supportsIndexedDb(),
    canSyncCloud: true,
    unavailableReason: supportsIndexedDb()
      ? undefined
      : "This browser blocks local storage, so vaults cannot be kept offline.",
  };

  private storage = new VaultStorage();
  private ready: Promise<void> | null = null;

  private init(): Promise<void> {
    if (!this.ready) this.ready = this.storage.initialize();
    return this.ready;
  }

  async list(): Promise<VaultSummary[]> {
    await this.init();
    const all = await this.storage.getAllVaults();
    return all.map((m) => ({ id: m.id, name: m.name, updatedAt: m.lastModified }));
  }

  async load(id: string): Promise<VaultRecord | null> {
    await this.init();
    const data = await this.storage.getVault(id);
    if (!data) return null;
    return {
      id: data.metadata.id,
      name: data.metadata.name,
      nodes: data.graphData?.nodes ?? [],
      links: data.graphData?.links ?? [],
      updatedAt: data.metadata.lastModified,
    };
  }

  async save(record: VaultRecord): Promise<void> {
    await this.init();
    const existing = await this.storage.getVault(record.id);
    await this.storage.saveVault({
      metadata: {
        id: record.id,
        name: record.name,
        location: existing?.metadata.location ?? "cloud",
        cloudSync: existing?.metadata.cloudSync ?? false,
        cloudId: existing?.metadata.cloudId,
        createdAt: existing?.metadata.createdAt ?? Date.now(),
        lastModified: Date.now(),
        nodeCount: record.nodes.length,
        linkCount: record.links.length,
      },
      graphData: { nodes: record.nodes as any[], links: record.links as any[] },
      history: existing?.history ?? { past: [], future: [] },
      graphConfig: existing?.graphConfig,
      backupConfig: existing?.backupConfig,
      settings: existing?.settings,
      workspaceLayout: existing?.workspaceLayout,
    });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    await this.storage.deleteVault(id);
  }
}

// --------------------------------------------------------------- filesystem

/**
 * Notes as real Markdown files. `id` is the note path joined by "/" — a folder
 * vault has one record per vault root and reads/writes files underneath it.
 */
export class FileSystemVaultRepository implements VaultRepository {
  readonly kind = "filesystem" as const;
  readonly capabilities: VaultCapabilities = {
    canWriteFolderConfig: supportsFolderPicker(),
    canPersistHandle: supportsPersistentHandles(),
    canPersistData: supportsFolderPicker(),
    canSyncCloud: true,
    unavailableReason: supportsFolderPicker()
      ? undefined
      : FOLDER_UNSUPPORTED_REASON,
  };

  private get fs() {
    return getFileSystemService();
  }

  async list(): Promise<VaultSummary[]> {
    const handle = this.fs.getHandle();
    return handle ? [{ id: handle.name, name: handle.name }] : [];
  }

  async load(id: string): Promise<VaultRecord | null> {
    const handle = this.fs.getHandle();
    if (!handle) return null;
    const notes = await this.fs.readAllNotes(handle);
    return {
      id,
      name: handle.name,
      nodes: notes,
      links: [],
    };
  }

  async save(record: VaultRecord): Promise<void> {
    if (!this.fs.isOpen()) throw new Error("No folder is open for this vault");
    for (const node of record.nodes as {
      path?: string[];
      type?: string;
      content?: string;
    }[]) {
      if (!node.path) continue;
      if (node.type === "folder") await this.fs.ensureDirectory(node.path);
      else await this.fs.saveFile(node.path, node.content ?? "");
    }
  }

  async delete(): Promise<void> {
    // Deleting a folder vault only detaches it; user files are never removed.
    this.fs.closeVault();
  }
}

// -------------------------------------------------------------------- cloud

export class CloudVaultRepository implements VaultRepository {
  readonly kind = "cloud" as const;
  readonly capabilities: VaultCapabilities = {
    canWriteFolderConfig: false,
    canPersistHandle: false,
    canPersistData: true,
    canSyncCloud: true,
  };

  async list(): Promise<VaultSummary[]> {
    const { data } = await cloudVaultService.getVaults();
    return (data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      updatedAt: new Date(v.updated_at).getTime(),
    }));
  }

  async load(id: string): Promise<VaultRecord | null> {
    const { data } = await cloudVaultService.getVault(id);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      nodes: data.graph_data?.nodes ?? [],
      links: data.graph_data?.links ?? [],
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  async save(record: VaultRecord): Promise<void> {
    const { error } = await cloudVaultService.createVault(
      record.name,
      undefined,
      { nodes: record.nodes as any[], links: record.links as any[] },
      record.id,
    );
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await cloudVaultService.deleteVault(id);
    if (error) throw error;
  }
}
