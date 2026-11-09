/**
 * IVaultStorageDriver - Abstraksi kontrak penyimpanan Vault
 *
 * Mengisolasi detail implementasi persistensi (IndexedDB vs Native File System)
 * dari orchestrator VaultManager.
 */

import type { Vault, VaultLocation, VaultMetadata } from '../types';

export interface IVaultStorageDriver {
  /** Jenis lokasi fisik yang ditangani driver ini ('cloud' | 'folder') */
  readonly location: VaultLocation;

  /** Inisialisasi awal driver (opsional, jika driver membutuhkan koneksi database/filesystem) */
  initialize?(): Promise<void>;

  /** Memulihkan data vault spesifik berdasarkan metadata */
  restoreVault(metadata: VaultMetadata): Promise<Vault | null>;

  /** Menyimpan atau memperbarui data vault ke media penyimpanan */
  persistVault(vault: Vault): Promise<void>;

  /** Menghapus data fisik vault dari media penyimpanan */
  deleteVault(vaultId: string): Promise<void>;
}