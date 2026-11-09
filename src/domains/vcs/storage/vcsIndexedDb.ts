/**
 * Engine IndexedDB lokal untuk Version Control System: VaultVcsDB.
 * Mengelola 4 store: micro_revisions, branch_stashes, sync_queue, dan local_commits.
 */

const DB_NAME = 'VaultVcsDB';
const DB_VERSION = 1;

export const VCS_STORES = {
  MICRO_REVISIONS: 'micro_revisions',
  BRANCH_STASHES: 'branch_stashes',
  SYNC_QUEUE: 'sync_queue',
  LOCAL_COMMITS: 'local_commits',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function openVcsDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB tidak didukung pada browser ini.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Store Micro-Revisions (Auto history lokal & GC 6 hari)
      if (!db.objectStoreNames.contains(VCS_STORES.MICRO_REVISIONS)) {
        const revStore = db.createObjectStore(VCS_STORES.MICRO_REVISIONS, { keyPath: 'id' });
        revStore.createIndex('by_vault', 'vaultId', { unique: false });
        revStore.createIndex('by_note', ['vaultId', 'noteId'], { unique: false });
        revStore.createIndex('by_expires', 'expiresAt', { unique: false });
        revStore.createIndex('by_timestamp', 'timestamp', { unique: false });
      }

      // 2. Store Branch Stashes (Smart Auto-Stash P10)
      if (!db.objectStoreNames.contains(VCS_STORES.BRANCH_STASHES)) {
        // Key path gabungan: [vaultId, branchId]
        db.createObjectStore(VCS_STORES.BRANCH_STASHES, { keyPath: ['vaultId', 'branchId'] });
      }

      // 3. Store Sync Queue (FIFO offline queue)
      if (!db.objectStoreNames.contains(VCS_STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(VCS_STORES.SYNC_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('by_created', 'createdAt', { unique: false });
        queueStore.createIndex('by_vault', 'vaultId', { unique: false });
      }

      // 4. Store Local Commits (Cache commit lokal untuk offline lookup)
      if (!db.objectStoreNames.contains(VCS_STORES.LOCAL_COMMITS)) {
        const commitStore = db.createObjectStore(VCS_STORES.LOCAL_COMMITS, { keyPath: 'commitHash' });
        commitStore.createIndex('by_vault_branch', ['vaultId', 'branchId'], { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Helper eksekusi transaksi IndexedDB generik dengan penanganan Promise yang aman.
 */
export async function withVcsTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openVcsDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let result: T;

    Promise.resolve()
      .then(() => callback(store))
      .then((res) => {
        result = res;
      })
      .catch((err) => {
        tx.abort();
        reject(err);
      });

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaksi dibatalkan'));
  });
}