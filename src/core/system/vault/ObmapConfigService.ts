/**
 * ObmapConfigService — reads and writes the portable `.obmap` config folder
 * that lives at the root of every folder vault.
 *
 *   /.obmap
 *     vault.json       identity + cloud sync flag
 *     settings.json    universal app settings for this vault
 *     graph.json       graph display config
 *     workspace.json   saved window / tab layout
 *
 * The folder is created on demand: a vault opened without `.obmap` gets one.
 * Config is isolated per vault — nothing is shared between vaults.
 */

import type { ObmapConfig, ObmapVaultFile, VaultGraphConfig, BackupConfig } from './types';

export const OBMAP_DIR = '.obmap';

const FILES = {
  vault: 'vault.json',
  settings: 'settings.json',
  graph: 'graph.json',
  workspace: 'workspace.json',
  backup: 'backup.json',
} as const;

type ObmapFileKey = keyof typeof FILES;

export function emptyObmapConfig(vault: ObmapVaultFile): ObmapConfig {
  return { vault, settings: {}, graph: null, workspace: null, backup: null };
}

export class ObmapConfigService {
  constructor(private root: FileSystemDirectoryHandle) {}

  setRoot(root: FileSystemDirectoryHandle) {
    this.root = root;
  }

  private async dir(create = true): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await this.root.getDirectoryHandle(OBMAP_DIR, { create });
    } catch {
      return null;
    }
  }

  async exists(): Promise<boolean> {
    return (await this.dir(false)) !== null;
  }

  private async readJson<T>(key: ObmapFileKey): Promise<T | null> {
    const dir = await this.dir(false);
    if (!dir) return null;
    try {
      const handle = await dir.getFileHandle(FILES[key]);
      const file = await handle.getFile();
      const text = await file.text();
      return text.trim() ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  private async writeJson(key: ObmapFileKey, value: unknown): Promise<boolean> {
    const dir = await this.dir(true);
    if (!dir) return false;
    try {
      const handle = await dir.getFileHandle(FILES[key], { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(value, null, 2));
      await writable.close();
      return true;
    } catch (error) {
      console.error(`[ObmapConfigService] Failed to write ${FILES[key]}:`, error);
      return false;
    }
  }

  /** Reads the whole config, creating `.obmap` with defaults when missing. */
  async load(fallback: ObmapVaultFile): Promise<ObmapConfig> {
    const hadDir = await this.exists();

    const vault = (await this.readJson<ObmapVaultFile>('vault')) ?? fallback;
    const settings = (await this.readJson<Record<string, any>>('settings')) ?? {};
    const graph = await this.readJson<VaultGraphConfig>('graph');
    const workspace = await this.readJson<any>('workspace');
    const backup = await this.readJson<BackupConfig>('backup');

    const config: ObmapConfig = { vault, settings, graph, workspace, backup };

    if (!hadDir) {
      // Bootstrap the folder so the vault is self-describing from now on.
      await this.saveAll(config);
    }
    return config;
  }

  async saveAll(config: ObmapConfig): Promise<void> {
    await this.writeJson('vault', config.vault);
    await this.writeJson('settings', config.settings ?? {});
    await this.writeJson('graph', config.graph ?? null);
    await this.writeJson('workspace', config.workspace ?? null);
    await this.writeJson('backup', config.backup ?? null);
  }

  saveVaultFile = (vault: ObmapVaultFile) => this.writeJson('vault', vault);
  saveSettings = (settings: Record<string, any>) => this.writeJson('settings', settings);
  saveGraph = (graph: VaultGraphConfig | null) => this.writeJson('graph', graph);
  saveWorkspace = (workspace: any) => this.writeJson('workspace', workspace);
  saveBackup = (backup: BackupConfig | null) => this.writeJson('backup', backup);
}
