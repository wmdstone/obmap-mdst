/**
 * FIFO Offline Sync Queue Manager (Penyempurnaan 4).
 * Menampung explicit commit saat pengguna bekerja secara offline,
 * dan mengeksekusinya secara sekuensial (First-In, First-Out) saat koneksi online pulih.
 */

import { openVcsDb, VCS_STORES, withVcsTx } from '../storage/vcsIndexedDb';
import { VcsCommit, VcsCommitItem } from '../types/vcs';

export interface QueuedCommitTask {
  id: string;
  vaultId: string;
  branchId: string;
  commitData: VcsCommit;
  items: VcsCommitItem[];
  blobs: { blobHash: string; contentText: string; mimeType: string; sizeBytes: number }[];
  retries: number;
  createdAt: number;
  lastError?: string;
}

export type SyncQueueListener = (status: {
  isProcessing: boolean;
  pendingCount: number;
  lastSyncedCommitHash?: string;
}) => void;

export class VcsSyncQueueService {
  private static isProcessing = false;
  private static listeners: Set<SyncQueueListener> = new Set();
  private static isListenerAttached = false;

  /**
   * Mengaktifkan pendengar otomatis event browser 'online'.
   */
  static initAutoSync(executeCommitFn: (task: QueuedCommitTask) => Promise<boolean>): void {
    if (this.isListenerAttached || typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.processQueue(executeCommitFn);
    });

    this.isListenerAttached = true;
    // Jalankan pengecekan antrean awal jika aplikasi dibuka dalam keadaan online
    if (navigator.onLine) {
      this.processQueue(executeCommitFn);
    }
  }

  /**
   * Mendaftarkan listener untuk update status antrean sinkronisasi UI.
   */
  static subscribe(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notify(status: {
    isProcessing: boolean;
    pendingCount: number;
    lastSyncedCommitHash?: string;
  }) {
    this.listeners.forEach((l) => l(status));
  }

  /**
   * Menambahkan commit baru ke dalam antrean offline FIFO.
   */
  static async enqueue(task: Omit<QueuedCommitTask, 'id' | 'retries' | 'createdAt'>): Promise<string> {
    const id = `queue_${task.vaultId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullTask: QueuedCommitTask = {
      ...task,
      id,
      retries: 0,
      createdAt: Date.now(),
    };

    await withVcsTx(VCS_STORES.SYNC_QUEUE, 'readwrite', (store) => {
      store.put(fullTask);
    });

    const count = await this.getPendingCount(task.vaultId);
    this.notify({ isProcessing: this.isProcessing, pendingCount: count });

    return id;
  }

  /**
   * Mengambil jumlah tugas yang belum tersinkronisasi.
   */
  static async getPendingCount(vaultId?: string): Promise<number> {
    const db = await openVcsDb();
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(VCS_STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(VCS_STORES.SYNC_QUEUE);

      if (vaultId) {
        const index = store.index('by_vault');
        const countReq = index.count(IDBKeyRange.only(vaultId));
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      } else {
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      }
    });
  }

  /**
   * Memproses antrean secara berurutan (FIFO) satu per satu.
   */
  static async processQueue(
    executeCommitFn: (task: QueuedCommitTask) => Promise<boolean>
  ): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      const db = await openVcsDb();
      let pendingTasks: QueuedCommitTask[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(VCS_STORES.SYNC_QUEUE, 'readonly');
        const store = tx.objectStore(VCS_STORES.SYNC_QUEUE);
        const index = store.index('by_created');
        const req = index.getAll();
        req.onsuccess = () => resolve(req.result as QueuedCommitTask[]);
        req.onerror = () => reject(req.error);
      });

      // Urutkan FIFO strictly berdasarkan createdAt asc
      pendingTasks.sort((a, b) => a.createdAt - b.createdAt);

      this.notify({ isProcessing: true, pendingCount: pendingTasks.length });

      for (const task of pendingTasks) {
        if (!navigator.onLine) break;

        try {
          const success = await executeCommitFn(task);
          if (success) {
            // Hapus dari antrean jika berhasil
            await withVcsTx(VCS_STORES.SYNC_QUEUE, 'readwrite', (store) => {
              store.delete(task.id);
            });
            this.notify({
              isProcessing: true,
              pendingCount: await this.getPendingCount(),
              lastSyncedCommitHash: task.commitData.commitHash,
            });
          } else {
            // Jika gagal tapi bukan fatal, naikkan retry count
            task.retries += 1;
            await withVcsTx(VCS_STORES.SYNC_QUEUE, 'readwrite', (store) => {
              store.put(task);
            });
            break; // Stop FIFO agar urutan commit tidak melompat (preserve commit parent order)
          }
        } catch (err: any) {
          task.retries += 1;
          task.lastError = err?.message || 'Gagal sinkronisasi commit';
          await withVcsTx(VCS_STORES.SYNC_QUEUE, 'readwrite', (store) => {
            store.put(task);
          });
          break; // Stop FIFO jika terjadi kegagalan jaringan
        }
      }
    } finally {
      this.isProcessing = false;
      const remaining = await this.getPendingCount();
      this.notify({ isProcessing: false, pendingCount: remaining });
    }
  }
}