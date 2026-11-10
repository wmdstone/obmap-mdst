/**
 * Pengelola Micro-Revision Lokal (IndexedDB - P1 & P6).
 * - Menyimpan snapshot otomatis saat pengguna mengetik.
 * - Garbage Collection: Menghapus revisi lebih lama dari 6 hari.
 * - Squash: Membersihkan micro-revision setelah Explicit Named Commit berhasil.
 */

import { openVcsDb, VCS_STORES, withVcsTx } from '@/domains/vcs/storage/vcsIndexedDb';
import { LocalMicroRevision } from '@/domains/vcs/types/vcs';

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export class VcsMicroRevisionService {
  /**
   * Menyimpan micro-revision lokal baru dengan masa retensi otomatis (TTL 6 hari).
   */
  static async saveRevision(params: {
    vaultId: string;
    branchId: string;
    noteId: string;
    path: string;
    title: string;
    content: string;
  }): Promise<LocalMicroRevision> {
    const now = Date.now();
    const revision: LocalMicroRevision = {
      id: `rev_${params.noteId}_${now}_${Math.random().toString(36).substring(2, 7)}`,
      vaultId: params.vaultId,
      branchId: params.branchId,
      noteId: params.noteId,
      path: params.path,
      title: params.title,
      content: params.content,
      timestamp: now,
      expiresAt: now + SIX_DAYS_MS,
    };

    await withVcsTx(VCS_STORES.MICRO_REVISIONS, 'readwrite', (store) => {
      store.put(revision);
    });

    return revision;
  }

  /**
   * Mengambil riwayat micro-revisi sebuah catatan secara kronologis terbalik (terbaru dulu).
   */
  static async getNoteRevisions(vaultId: string, noteId: string): Promise<LocalMicroRevision[]> {
    const db = await openVcsDb();
    return new Promise<LocalMicroRevision[]>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.MICRO_REVISIONS, 'readonly');
      const store = tx.objectStore(VCS_STORES.MICRO_REVISIONS);
      const index = store.index('by_note');
      const range = IDBKeyRange.only([vaultId, noteId]);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const results = (request.result as LocalMicroRevision[]) || [];
        // Urutkan dari yang terbaru
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Menjalankan Garbage Collection (GC): Menghapus seluruh revisi yang telah kedaluwarsa (> 6 hari).
   */
  static async pruneExpiredRevisions(): Promise<number> {
    const db = await openVcsDb();
    const now = Date.now();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.MICRO_REVISIONS, 'readwrite');
      const store = tx.objectStore(VCS_STORES.MICRO_REVISIONS);
      const index = store.index('by_expires');
      // Cari semua yang expiresAt <= now
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Squash/Prune: Membersihkan semua micro-revision untuk dokumen tertentu setelah
   * berhasil di-commit secara explicit ke dalam Git history.
   */
  static async squashRevisionsForNote(vaultId: string, noteId: string): Promise<number> {
    const db = await openVcsDb();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.MICRO_REVISIONS, 'readwrite');
      const store = tx.objectStore(VCS_STORES.MICRO_REVISIONS);
      const index = store.index('by_note');
      const range = IDBKeyRange.only([vaultId, noteId]);
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}