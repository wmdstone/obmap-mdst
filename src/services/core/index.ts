/**
 * Core Services - Foundation of the plugin architecture
 * 
 * This module exports all core infrastructure:
 * - Plugin Registry: Feature registration and lifecycle
 * - Dependency Injection Container: Service management
 * - Feature Registry: Convenience functions
 * - Feature Loader: Dynamic feature loading
 */

// Re-export plugin-registry (excluding ServiceFactory to avoid conflict)
export {
  type ComponentFactory,
  type HookFactory,
  type RouteConfig,
  type ComponentRegistry,
  type HookRegistry,
  type Feature,
  type FeatureStatus,
  PluginRegistry,
  pluginRegistry,
} from './plugin-registry';

// Re-export container
export * from './container';

// Re-export features (explicit exports to avoid conflicts with feature-loader)
export {
  registerCoreFeatures,
  initializeFeatures,
  cleanupFeatures,
  allFeatures,
  coreFeature,
  authFeature,
  vaultFeature,
  graphFeature,
  syncFeature,
  profileFeature,
  registerFeature,
  registerFeatures,
  getFeature,
  getAllFeatures,
  initializeFeature,
  initializeAllFeatures,
  cleanupFeature,
  cleanupAllFeatures,
  enableFeature,
  disableFeature,
  getFeatureStatus,
  getAllFeatureStatuses,
  getAllRoutes,
  getAllComponents,
  getAllHooks,
} from './features';

// Re-export feature loader (without conflicting exports)
export {
  initializeFeatureLoader,
  cleanupFeatureLoader,
  getFeatureLoaderState,
  getFeatureRoutes,
  createLazyComponent,
  getComponentFactory,
  createGlobalLazyComponent,
  isFeatureEnabled,
  type FeatureLoaderState,
} from './feature-loader';

