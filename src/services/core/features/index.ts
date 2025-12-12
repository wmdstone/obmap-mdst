/**
 * Feature Registry Index
 * 
 * Registers all core features with the plugin registry
 */

import { pluginRegistry } from '../plugin-registry';
import { coreFeature } from './core-feature';
import { authFeature } from './auth-feature';
import { vaultFeature } from './vault-feature';
import { graphFeature } from './graph-feature';
import { syncFeature } from './sync-feature';
import { profileFeature } from './profile-feature';

// All available features
export const allFeatures = [
  coreFeature,
  authFeature,
  vaultFeature,
  graphFeature,
  syncFeature,
  profileFeature,
];

/**
 * Register all core features
 */
export function registerCoreFeatures(): void {
  console.log('[Features] Registering core features...');
  
  for (const feature of allFeatures) {
    pluginRegistry.register(feature);
  }
  
  console.log('[Features] All core features registered');
}

/**
 * Initialize all enabled features
 */
export async function initializeFeatures(): Promise<void> {
  console.log('[Features] Initializing all features...');
  await pluginRegistry.initializeAll();
  console.log('[Features] All features initialized');
}

/**
 * Cleanup all features
 */
export async function cleanupFeatures(): Promise<void> {
  console.log('[Features] Cleaning up all features...');
  await pluginRegistry.cleanupAll();
  console.log('[Features] All features cleaned up');
}

// Re-export individual features
export { coreFeature } from './core-feature';
export { authFeature } from './auth-feature';
export { vaultFeature } from './vault-feature';
export { graphFeature } from './graph-feature';
export { syncFeature } from './sync-feature';
export { profileFeature } from './profile-feature';
