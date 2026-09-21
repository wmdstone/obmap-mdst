/**
 * Feature detection for vault storage.
 *
 * Every folder-related action asks here first, so a browser without the File
 * System Access API shows a disabled control with a reason instead of opening
 * a picker that does not exist.
 */

export function supportsFolderPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

export function supportsIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Directory handles can only be remembered when both APIs exist. */
export function supportsPersistentHandles(): boolean {
  return supportsFolderPicker() && supportsIndexedDb();
}

export const FOLDER_UNSUPPORTED_REASON =
  "This browser cannot open folders on your computer — use Chrome or Edge on desktop.";

/** Ask the user for a vault folder. Returns null when they cancel. */
export async function pickVaultFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFolderPicker()) throw new Error(FOLDER_UNSUPPORTED_REASON);
  try {
    // @ts-expect-error — File System Access API is not in the TS lib yet
    return await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return null;
    throw error;
  }
}

/** Permission check that never prompts (safe outside a user gesture). */
export async function hasGrantedPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    const anyHandle = handle as unknown as {
      queryPermission?: (d: { mode: string }) => Promise<string>;
    };
    return (
      (await anyHandle.queryPermission?.({ mode: "readwrite" })) === "granted"
    );
  } catch {
    return false;
  }
}
