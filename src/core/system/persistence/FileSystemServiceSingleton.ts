/**
 * One FileSystemService for the whole app.
 *
 * Only one vault is active at a time, and each extra instance added another
 * duplicate `NOTE_SYNC_REQUESTED` subscriber (the same note written twice).
 */

import { FileSystemService } from "./FileSystemService";

let instance: FileSystemService | null = null;

export function getFileSystemService(): FileSystemService {
  if (!instance) instance = new FileSystemService();
  return instance;
}
