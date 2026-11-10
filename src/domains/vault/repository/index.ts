/**
 * Repository registry — the single entry point for vault storage.
 */

import type { VaultLocation } from "@/domains/vault/types";
import type { VaultRepository, VaultRepositoryKind } from "@/domains/vault/repository/types";
import {
  CloudVaultRepository,
  FileSystemVaultRepository,
  IndexedDbVaultRepository,
  MemoryVaultRepository,
} from "@/domains/vault/repository/adapters";

export * from "@/domains/vault/repository/types";
export * from "@/domains/vault/repository/capabilities";

const repositories: Record<VaultRepositoryKind, VaultRepository> = {
  memory: new MemoryVaultRepository(),
  indexeddb: new IndexedDbVaultRepository(),
  filesystem: new FileSystemVaultRepository(),
  cloud: new CloudVaultRepository(),
};

export function getVaultRepository(kind: VaultRepositoryKind): VaultRepository {
  return repositories[kind];
}

/** Which adapter owns the notes of a vault at this location. */
export function repositoryForLocation(location: VaultLocation): VaultRepository {
  return location === "folder"
    ? repositories.filesystem
    : repositories.indexeddb;
}

/** What the UI is allowed to offer for a vault at this location. */
export function capabilitiesForLocation(location: VaultLocation) {
  return repositoryForLocation(location).capabilities;
}
