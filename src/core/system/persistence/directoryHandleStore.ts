/**
 * Directory handle store — remembers the folder each folder-vault points at,
 * so a local vault reopens after a page reload (with a permission prompt)
 * instead of disappearing from the vault list.
 */

const DB_NAME = "VaultHandlesDB";
const DB_VERSION = 1;
const STORE = "handles";

interface HandleRecord {
  vaultId: string;
  handle: FileSystemDirectoryHandle;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "vaultId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const directoryHandleStore = {
  async put(vaultId: string, handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      await tx("readwrite", (s) =>
        s.put({ vaultId, handle } satisfies HandleRecord) as IDBRequest<IDBValidKey>,
      );
    } catch (error) {
      console.warn("directoryHandleStore: could not remember folder", error);
    }
  },

  async get(vaultId: string): Promise<FileSystemDirectoryHandle | null> {
    try {
      const row = await tx<HandleRecord | undefined>("readonly", (s) =>
        s.get(vaultId) as IDBRequest<HandleRecord | undefined>,
      );
      return row?.handle ?? null;
    } catch {
      return null;
    }
  },

  async remove(vaultId: string): Promise<void> {
    try {
      await tx("readwrite", (s) => s.delete(vaultId) as IDBRequest<undefined>);
    } catch {
      /* nothing to forget */
    }
  },
};
