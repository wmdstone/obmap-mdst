/**
 * Backup configuration store — the single source of truth for per-vault
 * backup settings.
 *
 * Previously these lived in `localStorage['vault_backup_configs']`. That key is
 * read once as a migration and then removed; from then on the values belong to
 * the configuration vault (ConfigService section "backup").
 */

import { create } from 'zustand';

export interface BackupConfigValue {
  timeIntervalMinutes: number; // 0 = disabled
  changeThreshold: number; // 0 = disabled
  maxSnapshots: number;
}

export const defaultBackupConfig: BackupConfigValue = {
  timeIntervalMinutes: 5,
  changeThreshold: 10,
  maxSnapshots: 30,
};

const LEGACY_KEY = 'vault_backup_configs';

function migrateLegacy(): Record<string, BackupConfigValue> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BackupConfigValue>;
    localStorage.removeItem(LEGACY_KEY);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

interface BackupConfigState {
  configs: Record<string, BackupConfigValue>;
  getConfig: (vaultId: string) => BackupConfigValue;
  setConfig: (vaultId: string, config: BackupConfigValue) => void;
  loadAll: (configs: Record<string, BackupConfigValue>) => void;
  reset: () => void;
}

export const useBackupConfigStore = create<BackupConfigState>()((set, get) => ({
  configs: typeof window === 'undefined' ? {} : migrateLegacy(),

  getConfig: (vaultId) => get().configs[vaultId] ?? defaultBackupConfig,

  setConfig: (vaultId, config) =>
    set((s) => ({ configs: { ...s.configs, [vaultId]: config } })),

  loadAll: (configs) => set({ configs: { ...configs } }),

  reset: () => set({ configs: {} }),
}));
