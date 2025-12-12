/**
 * Sync Feature Module
 * 
 * Self-contained module for sync and offline functionality
 */

import type { Feature } from '../plugin-registry';

export const syncFeature: Feature = {
  id: 'sync',
  name: 'Sync & Offline',
  version: '1.0.0',
  dependencies: ['core', 'vault'],
  services: [
    {
      name: 'BackgroundSyncService',
      factory: async () => {
        const { BackgroundSyncService } = await import('../../sync/BackgroundSyncService');
        return new BackgroundSyncService();
      },
      singleton: true,
    },
  ],
  components: {
    AutoSaveIndicator: () => import('@/components/sync/AutoSaveIndicator'),
    OfflineIndicator: () => import('@/components/sync/OfflineIndicator'),
    SyncStatusIndicator: () => import('@/components/sync/SyncStatusIndicator'),
  },
  routes: [],
  hooks: {
    usePWA: () => import('@/components/sync/hooks/usePWA'),
  },
  initialize: async () => {
    console.log('[SyncFeature] Initializing sync feature...');
  },
  cleanup: async () => {
    console.log('[SyncFeature] Cleaning up sync feature...');
  },
};
