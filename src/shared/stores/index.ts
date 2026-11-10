/**
 * Central store exports
 */

export * from '@/shared/stores/types';
export { useNodeStore } from '@/domains/graph/shared/stores/useNodeStore';
export { useVaultStore } from '@/domains/vault/stores/useVaultStore';
export { useUIStore } from '@/domains/workspace/stores/useUIStore';
export { useGraphStore } from '@/domains/graph/shared/stores/useGraphStore';
export { useThemeStore } from '@/domains/settings/stores/useThemeStore';
export { useOfflineStore } from '@/domains/sync/stores/useOfflineStore';

// Re-export graph config types for convenience
export type {
  NodeConfig,
  LinkConfig,
  LinkStyle,
  TopologyConfig,
  ForceConfig,
  GraphConfigState,
  LinkStats,
} from '@/domains/graph/shared/stores/useGraphStore';

export {
  defaultNodeConfig,
  defaultLinkConfig,
  defaultTopologyConfig,
  defaultForceConfig,
  defaultGraphConfig,
} from '@/domains/graph/shared/stores/useGraphStore';
