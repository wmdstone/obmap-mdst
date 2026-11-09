/**
 * VaultRepository — one interface in front of every place a vault can live.
 *
 * Callers never branch on `vault.type` / `vault.location` any more: they ask
 * the registry for the repository of a location and use the same four calls.
 * Anything an adapter cannot do is declared in `capabilities`, so the UI can
 * disable the feature with an explanation instead of failing silently.
 */

export type VaultRepositoryKind = "memory" | "indexeddb" | "filesystem" | "cloud";

export interface VaultCapabilities {
  /** Can write the derived `.vault-config.json` next to the notes. */
  canWriteFolderConfig: boolean;
  /** Can remember a directory handle across page loads. */
  canPersistHandle: boolean;
  /** Survives a page reload at all. */
  canPersistData: boolean;
  /** Mirrors content to the user's account. */
  canSyncCloud: boolean;
  /** Human-readable reason to show when a capability is missing. */
  unavailableReason?: string;
}

export interface VaultRecord {
  id: string;
  name: string;
  nodes: unknown[];
  links: unknown[];
  updatedAt?: number;
}

export interface VaultSummary {
  id: string;
  name: string;
  updatedAt?: number;
}

export interface VaultRepository {
  readonly kind: VaultRepositoryKind;
  readonly capabilities: VaultCapabilities;
  list(): Promise<VaultSummary[]>;
  load(id: string): Promise<VaultRecord | null>;
  save(record: VaultRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
