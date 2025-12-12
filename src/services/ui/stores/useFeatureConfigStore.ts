/**
 * Feature Configuration Store
 * 
 * Manages feature enable/disable state with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pluginRegistry, type Feature, type FeatureStatus } from '@/services/core/plugin-registry';

export interface FeatureConfig {
  enabled: boolean;
  lastUpdated: number;
}

export interface FeatureConfigState {
  featureConfigs: Record<string, FeatureConfig>;
  isLoaded: boolean;
  
  // Actions
  setFeatureEnabled: (featureId: string, enabled: boolean) => Promise<void>;
  getFeatureConfig: (featureId: string) => FeatureConfig | undefined;
  getAllFeatureStatuses: () => FeatureStatus[];
  getAllFeatures: () => Feature[];
  getFeatureDependencies: (featureId: string) => string[];
  getFeatureDependents: (featureId: string) => string[];
  resetToDefaults: () => void;
  syncWithRegistry: () => void;
}

export const useFeatureConfigStore = create<FeatureConfigState>()(
  persist(
    (set, get) => ({
      featureConfigs: {},
      isLoaded: false,

      setFeatureEnabled: async (featureId: string, enabled: boolean) => {
        const feature = pluginRegistry.get(featureId);
        if (!feature) {
          console.warn(`[FeatureConfig] Feature ${featureId} not found`);
          return;
        }

        // Check if this is a core feature (cannot be disabled)
        if (featureId === 'core' && !enabled) {
          console.warn('[FeatureConfig] Cannot disable core feature');
          return;
        }

        // If enabling, check if dependencies are enabled
        if (enabled && feature.dependencies) {
          for (const depId of feature.dependencies) {
            const depConfig = get().featureConfigs[depId];
            if (depConfig && !depConfig.enabled) {
              console.warn(`[FeatureConfig] Cannot enable ${featureId}: dependency ${depId} is disabled`);
              return;
            }
          }
        }

        // If disabling, check if any enabled features depend on this
        if (!enabled) {
          const dependents = get().getFeatureDependents(featureId);
          const enabledDependents = dependents.filter(depId => {
            const config = get().featureConfigs[depId];
            return config?.enabled !== false;
          });
          
          if (enabledDependents.length > 0) {
            // Disable dependents first
            for (const depId of enabledDependents) {
              await get().setFeatureEnabled(depId, false);
            }
          }
        }

        // Update the registry
        if (enabled) {
          pluginRegistry.enable(featureId);
        } else {
          await pluginRegistry.disable(featureId);
        }

        // Update store
        set((state) => ({
          featureConfigs: {
            ...state.featureConfigs,
            [featureId]: {
              enabled,
              lastUpdated: Date.now(),
            },
          },
        }));

        console.log(`[FeatureConfig] Feature ${featureId} ${enabled ? 'enabled' : 'disabled'}`);
      },

      getFeatureConfig: (featureId: string) => {
        return get().featureConfigs[featureId];
      },

      getAllFeatureStatuses: () => {
        return pluginRegistry.getAllStatuses();
      },

      getAllFeatures: () => {
        return pluginRegistry.getAll();
      },

      getFeatureDependencies: (featureId: string) => {
        const feature = pluginRegistry.get(featureId);
        return feature?.dependencies || [];
      },

      getFeatureDependents: (featureId: string) => {
        const allFeatures = pluginRegistry.getAll();
        return allFeatures
          .filter(f => f.dependencies?.includes(featureId))
          .map(f => f.id);
      },

      resetToDefaults: () => {
        // Enable all features
        const allFeatures = pluginRegistry.getAll();
        const defaultConfigs: Record<string, FeatureConfig> = {};
        
        for (const feature of allFeatures) {
          pluginRegistry.enable(feature.id);
          defaultConfigs[feature.id] = {
            enabled: true,
            lastUpdated: Date.now(),
          };
        }

        set({ featureConfigs: defaultConfigs });
      },

      syncWithRegistry: () => {
        const allFeatures = pluginRegistry.getAll();
        const allStatuses = pluginRegistry.getAllStatuses();
        const currentConfigs = get().featureConfigs;
        const newConfigs: Record<string, FeatureConfig> = {};

        for (const feature of allFeatures) {
          const status = allStatuses.find(s => s.id === feature.id);
          const savedConfig = currentConfigs[feature.id];
          
          // Apply saved config to registry
          if (savedConfig) {
            if (savedConfig.enabled && !status?.enabled) {
              pluginRegistry.enable(feature.id);
            }
            newConfigs[feature.id] = savedConfig;
          } else {
            // Initialize with current status
            newConfigs[feature.id] = {
              enabled: status?.enabled ?? true,
              lastUpdated: Date.now(),
            };
          }
        }

        set({ featureConfigs: newConfigs, isLoaded: true });
      },
    }),
    {
      name: 'feature-config-storage',
      partialize: (state) => ({ featureConfigs: state.featureConfigs }),
    }
  )
);
