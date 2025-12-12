/**
 * Feature Loader
 * 
 * Handles async feature loading, dependency management, and lifecycle hooks.
 * This is the main entry point for feature initialization in the application.
 */

import React, { ComponentType, lazy, Suspense } from 'react';
import { pluginRegistry, type Feature, type RouteConfig, type ComponentFactory } from './plugin-registry';
import { registerCoreFeatures, initializeFeatures, cleanupFeatures } from './features/index';

export interface FeatureLoaderState {
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
  loadedFeatures: string[];
}

let loaderState: FeatureLoaderState = {
  isLoading: false,
  isInitialized: false,
  error: null,
  loadedFeatures: [],
};

/**
 * Initialize the feature loader and all registered features
 */
export async function initializeFeatureLoader(): Promise<void> {
  if (loaderState.isInitialized) {
    console.log('[FeatureLoader] Already initialized');
    return;
  }

  if (loaderState.isLoading) {
    console.log('[FeatureLoader] Already loading...');
    return;
  }

  loaderState.isLoading = true;
  loaderState.error = null;

  try {
    // Register all core features
    registerCoreFeatures();
    
    // Initialize all features
    await initializeFeatures();
    
    // Track loaded features
    loaderState.loadedFeatures = pluginRegistry.getAll().map(f => f.id);
    loaderState.isInitialized = true;
    
    console.log('[FeatureLoader] Initialization complete', loaderState.loadedFeatures);
  } catch (error) {
    loaderState.error = error instanceof Error ? error : new Error(String(error));
    console.error('[FeatureLoader] Initialization failed:', error);
    throw error;
  } finally {
    loaderState.isLoading = false;
  }
}

/**
 * Cleanup all features
 */
export async function cleanupFeatureLoader(): Promise<void> {
  if (!loaderState.isInitialized) {
    return;
  }

  try {
    await cleanupFeatures();
    loaderState.isInitialized = false;
    loaderState.loadedFeatures = [];
  } catch (error) {
    console.error('[FeatureLoader] Cleanup failed:', error);
    throw error;
  }
}

/**
 * Get current loader state
 */
export function getFeatureLoaderState(): FeatureLoaderState {
  return { ...loaderState };
}

/**
 * Get all routes from all enabled features
 */
export function getFeatureRoutes(): RouteConfig[] {
  return pluginRegistry.getAllRoutes();
}

/**
 * Create a lazy-loaded component from a feature's component registry
 */
export function createLazyComponent(
  featureId: string,
  componentName: string
): React.LazyExoticComponent<ComponentType<any>> | null {
  const feature = pluginRegistry.get(featureId);
  if (!feature?.components?.[componentName]) {
    console.warn(`[FeatureLoader] Component ${componentName} not found in feature ${featureId}`);
    return null;
  }

  const factory = feature.components[componentName];
  return lazy(async () => {
    try {
      const module = await factory();
      // Handle both default exports and named exports
      if (module.default) {
        return module;
      }
      // If no default export, try to find the component by name
      const Component = module[componentName] || Object.values(module)[0];
      return { default: Component };
    } catch (error) {
      console.error(`[FeatureLoader] Failed to load component ${componentName}:`, error);
      return { 
        default: () => React.createElement('div', { 
          className: 'p-4 text-destructive' 
        }, `Failed to load ${componentName}`)
      };
    }
  });
}

/**
 * Get a component factory from any registered feature
 */
export function getComponentFactory(componentName: string): ComponentFactory | null {
  const components = pluginRegistry.getAllComponents();
  return components.get(componentName) || null;
}

/**
 * Create a lazy component from the global component registry
 */
export function createGlobalLazyComponent(
  componentName: string
): React.LazyExoticComponent<ComponentType<any>> {
  return lazy(async () => {
    const factory = getComponentFactory(componentName);
    if (!factory) {
      console.warn(`[FeatureLoader] Component ${componentName} not found`);
      return { 
        default: () => React.createElement('div', { 
          className: 'p-4 text-destructive' 
        }, `Component ${componentName} not found`)
      };
    }

    try {
      const module = await factory();
      // Handle both default exports and named exports
      if (module.default) {
        return module;
      }
      // If no default export, try to find the component by name
      const Component = module[componentName] || Object.values(module)[0];
      return { default: Component };
    } catch (error) {
      console.error(`[FeatureLoader] Failed to load component ${componentName}:`, error);
      return { 
        default: () => React.createElement('div', { 
          className: 'p-4 text-destructive' 
        }, `Failed to load ${componentName}`)
      };
    }
  });
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureId: string): boolean {
  const status = pluginRegistry.getStatus(featureId);
  return status?.enabled === true;
}

/**
 * Enable a feature dynamically
 */
export function enableFeature(featureId: string): void {
  pluginRegistry.enable(featureId);
}

/**
 * Disable a feature dynamically
 */
export async function disableFeature(featureId: string): Promise<void> {
  await pluginRegistry.disable(featureId);
}

/**
 * Get feature by ID
 */
export function getFeature(featureId: string): Feature | undefined {
  return pluginRegistry.get(featureId);
}

/**
 * Get all registered features
 */
export function getAllFeatures(): Feature[] {
  return pluginRegistry.getAll();
}
