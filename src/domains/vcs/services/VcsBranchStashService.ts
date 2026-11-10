/**
 * Smart Auto-Stash Manager (P10).
 * Mengamankan perubahan lokal yang belum di-commit saat pengguna berpindah branch,
 * dan mengembalikannya secara otomatis saat pengguna berpindah kembali ke branch asal.
 */

import { openVcsDb, VCS_STORES, withVcsTx } from '@/domains/vcs/storage/vcsIndexedDb';
import { LocalBranchStash } from '@/domains/vcs/types/vcs';

export class VcsBranchStashService {
  /**
   * Menyimpan stash untuk branch tertentu.
   */
  static async stashBranchChanges(stash: LocalBranchStash): Promise<void> {
    if (!stash.items || stash.items.length === 0) {
      // Jika tidak ada item yang berubah, hapus stash lama jika ada
      await this.clearBranchStash(stash.vaultId, stash.branchId);
      return;
    }

    await withVcsTx(VCS_STORES.BRANCH_STASHES, 'readwrite', (store) => {
      store.put(stash);
    });
  }

  /**
   * Mengambil dan menghapus (pop) stash untuk branch tertentu saat branch kembali dibuka.
   */
  static async popBranchStash(vaultId: string, branchId: string): Promise<LocalBranchStash | null> {
    const db = await openVcsDb();

    return new Promise<LocalBranchStash | null>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.BRANCH_STASHES, 'readwrite');
      const store = tx.objectStore(VCS_STORES.BRANCH_STASHES);
      const request = store.get([vaultId, branchId]);

      request.onsuccess = () => {
        const result = (request.result as LocalBranchStash) || null;
        if (result) {
          // Hapus setelah di-pop agar tidak terduplikasi
          store.delete([vaultId, branchId]);
        }
        resolve(result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mengintip (peek) apakah ada stash yang tersimpan di suatu branch tanpa menghapusnya.
   */
  static async peekBranchStash(vaultId: string, branchId: string): Promise<LocalBranchStash | null> {
    const db = await openVcsDb();

    return new Promise<LocalBranchStash | null>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.BRANCH_STASHES, 'readonly');
      const store = tx.objectStore(VCS_STORES.BRANCH_STASHES);
      const request = store.get([vaultId, branchId]);

      request.onsuccess = () => {
        resolve((request.result as LocalBranchStash) || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Membersihkan stash branch.
   */
  static async clearBranchStash(vaultId: string, branchId: string): Promise<void> {
    await withVcsTx(VCS_STORES.BRANCH_STASHES, 'readwrite', (store) => {
      store.delete([vaultId, branchId]);
    });
  }
}