/**
 * Derived configuration export.
 *
 * The single internal export format is `.vault-config.json`, written at the
 * root of a vault folder whenever a folder handle is available. It is a
 * one-way export: the app never reads it back — ConfigService stays the only
 * source of truth. The manual download (`obmap-config-<date>.json`) uses the
 * exact same serializer.
 */

import { configService } from './ConfigService';

export const VAULT_CONFIG_FILE = '.vault-config.json';

/** The one serializer shared by the folder export and the manual download. */
export function serializeConfigExport(): string {
  return JSON.stringify(configService.exportConfig(), null, 2);
}

export function configExportFileName(): string {
  return `obmap-config-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Write `.vault-config.json` into the vault folder. Best effort. */
export async function writeVaultConfigFile(
  root: FileSystemDirectoryHandle | null | undefined,
): Promise<boolean> {
  if (!root) return false;
  try {
    const handle = await root.getFileHandle(VAULT_CONFIG_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(serializeConfigExport());
    await writable.close();
    return true;
  } catch (error) {
    console.error('[VaultConfigFile] Failed to write .vault-config.json:', error);
    return false;
  }
}
