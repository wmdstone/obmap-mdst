/**
 * Vault Feature Module
 * 
 * Self-contained module for vault management functionality
 */

import type { Feature } from '../plugin-registry';

export const vaultFeature: Feature = {
  id: 'vault',
  name: 'Vault Management',
  version: '1.0.0',
  dependencies: ['core'],
  services: [
    {
      name: 'VaultManager',
      factory: async () => {
        const { getVaultManager } = await import('../../vault/VaultManagerSingleton');
        return getVaultManager();
      },
      singleton: true,
    },
    {
      name: 'VaultStorage',
      factory: async () => {
        const { VaultStorage } = await import('../../vault/VaultStorage');
        return new VaultStorage();
      },
      singleton: true,
    },
    {
      name: 'VaultSyncService',
      factory: async () => {
        const { VaultSyncService } = await import('../../vault/VaultSyncService');
        return new VaultSyncService();
      },
      singleton: true,
    },
    {
      name: 'VaultBackupService',
      factory: async () => {
        const { VaultBackupService } = await import('../../vault/VaultBackupService');
        return new VaultBackupService();
      },
      singleton: true,
    },
  ],
  components: {
    VaultDashboard: () => import('@/pages/VaultDashboard'),
    VaultCard: () => import('@/components/vault/VaultCard'),
    VaultBackupPanel: () => import('@/components/vault/VaultBackupPanel'),
    VaultBackupSettings: () => import('@/components/vault/VaultBackupSettings'),
    VaultComparisonView: () => import('@/components/vault/VaultComparisonView'),
    VaultModeSelector: () => import('@/components/vault/VaultModeSelector'),
    VaultRequiredGate: () => import('@/components/vault/VaultRequiredGate'),
    StorageStrategySelector: () => import('@/components/vault/StorageStrategySelector'),
    ExportToFileSystem: () => import('@/components/vault/ExportToFileSystem'),
  },
  routes: [
    { 
      path: '/vaults', 
      component: 'VaultDashboard',
      protected: true,
    },
  ],
  hooks: {
    useVault: () => import('@/components/vault/hooks/useVault'),
    useVaultSync: () => import('@/components/vault/hooks/useVaultSync'),
    useVaultEvents: () => import('@/components/vault/hooks/useVaultEvents'),
  },
  initialize: async () => {
    console.log('[VaultFeature] Initializing vault feature...');
    // Vault manager is initialized on-demand via singleton
  },
  cleanup: async () => {
    console.log('[VaultFeature] Cleaning up vault feature...');
  },
};
