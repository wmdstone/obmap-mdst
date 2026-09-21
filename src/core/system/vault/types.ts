/**
 * Vault Types - Shared type definitions for vault system
 *
 * A vault has two independent settings:
 * - location: where the notes physically live ('folder' on disk, or 'cloud')
 * - cloudSync: whether the vault is mirrored to the user's cloud account
 *
 * So a folder vault can sync to the cloud, and a cloud vault can be attached
 * to a folder on disk.
 */

export type VaultLocation = 'folder' | 'cloud';

export interface VaultMetadata {
  id: string;
  name: string;
  location: VaultLocation;
  cloudSync: boolean;
  createdAt: number;
  lastModified: number;
  nodeCount: number;
  linkCount: number;
  cloudId?: string; // UUID from Supabase when synced to cloud
}

export interface BackupConfig {
  timeIntervalMinutes: number;
  changeThreshold: number;
  maxSnapshots: number;
}

export interface VaultGraphConfig {
  nodes?: any;
  links?: any;
  topology?: any;
  forces?: any;
  schema?: any;
  [key: string]: any;
}

/** Vault identity inside the derived `.vault-config.json` export. */
export interface VaultConfigIdentity {
  id: string;
  name: string;
  createdAt: number;
  cloudSync: boolean;
  cloudId?: string;
}

/** Derived, read-never config snapshot for one vault. */
export interface VaultConfigSnapshot {
  vault: VaultConfigIdentity;
  settings: Record<string, any>;
  graph: VaultGraphConfig | null;
  workspace: any | null;
  backup?: BackupConfig | null;
}

export interface VaultData {
  metadata: VaultMetadata;
  graphData: {
    nodes: any[];
    links: any[];
  };
  history: {
    past: any[];
    future: any[];
  };
  graphConfig?: VaultGraphConfig;
  backupConfig?: BackupConfig;
  settings?: Record<string, any>;
  workspaceLayout?: any;
}

export const VAULT_LOCATION_LABELS: Record<VaultLocation, string> = {
  folder: 'Folder on this computer',
  cloud: 'Cloud vault',
};

export const VAULT_LOCATION_DESCRIPTIONS: Record<VaultLocation, string> = {
  folder: 'Notes are Markdown files inside a folder you choose',
  cloud: 'Notes live in your account and follow you across devices',
};

/** Legacy storage strategy values, migrated on load. */
export type LegacyStorageStrategy = 'memory' | 'cloud' | 'filesystem';

export function migrateLegacyStrategy(
  strategy: LegacyStorageStrategy | undefined,
  legacyType: string | undefined
): { location: VaultLocation; cloudSync: boolean } {
  if (strategy === 'filesystem' || legacyType === 'local-folder') {
    return { location: 'folder', cloudSync: false };
  }
  if (strategy === 'cloud') {
    return { location: 'cloud', cloudSync: true };
  }
  // Browser-memory vaults become cloud-backed vaults; content is preserved.
  return { location: 'cloud', cloudSync: true };
}
