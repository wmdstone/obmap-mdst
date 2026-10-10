import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import {
  type GraphConfigState,
  type NodeConfig,
  type LinkConfig,
  type ForceConfig,
  type TopologyConfig,
  type HierarchyColorConfig,
  mergeGraphConfig,
  useGraphStore,
} from '@/shared/stores/useGraphStore';
import { useGraphTemplatesStore } from '@/shared/stores/useGraphTemplatesStore';
import { mergeAtmosphereConfig, type AtmosphereConfig } from './atmosphereConfig';

export interface LeafGraphConfigState {
  config: GraphConfigState;
  activeTemplateId: string | null;
  setAtmosphereConfig: (updates: Partial<AtmosphereConfig>) => void;
  setNodeConfig: (updater: Partial<NodeConfig> | ((prev: NodeConfig) => Partial<NodeConfig>)) => void;
  setLinkConfig: (updater: Partial<LinkConfig> | ((prev: LinkConfig) => Partial<LinkConfig>)) => void;
  setForceConfig: (updater: Partial<ForceConfig> | ((prev: ForceConfig) => Partial<ForceConfig>)) => void;
  setTopologyConfig: (updater: Partial<TopologyConfig> | ((prev: TopologyConfig) => Partial<TopologyConfig>)) => void;
  setHierarchyConfig: (config: HierarchyColorConfig) => void;
  setFullConfig: (config: GraphConfigState, templateId?: string | null) => void;
  resetToDefault: () => void;
}

export function createLeafGraphConfigStore(initialConfig?: GraphConfigState): StoreApi<LeafGraphConfigState> {
  // Ambil template default jika tersedia; selalu deep-merge ke defaultGraphConfig
  // agar config legacy/parsial tidak pernah menghasilkan section `undefined`.
  const templatesState = useGraphTemplatesStore.getState();
  const baseConfig: GraphConfigState = mergeGraphConfig(
    initialConfig ?? templatesState.getDefaultConfig?.() ?? useGraphStore.getState().config,
  );

  return createStore<LeafGraphConfigState>((set) => ({
    config: baseConfig,
    activeTemplateId: templatesState.defaultTemplateId ?? null,

    setAtmosphereConfig: (updates) => set((state) => ({
      config: {
        ...state.config,
        atmosphere: mergeAtmosphereConfig({ ...state.config.atmosphere, ...updates }),
      },
    })),

    setNodeConfig: (updater) =>
      set((state) => ({
        config: {
          ...state.config,
          nodes: {
            ...state.config.nodes,
            ...(typeof updater === 'function' ? updater(state.config.nodes) : updater),
          },
        },
      })),

    setLinkConfig: (updater) =>
      set((state) => ({
        config: {
          ...state.config,
          links: {
            ...state.config.links,
            ...(typeof updater === 'function' ? updater(state.config.links) : updater),
          },
        },
      })),

    setForceConfig: (updater) =>
      set((state) => ({
        config: {
          ...state.config,
          forces: {
            ...state.config.forces,
            ...(typeof updater === 'function' ? updater(state.config.forces) : updater),
          },
        },
      })),

    setTopologyConfig: (updater) =>
      set((state) => ({
        config: {
          ...state.config,
          topology: {
            ...state.config.topology,
            ...(typeof updater === 'function' ? updater(state.config.topology) : updater),
          },
        },
      })),

    setHierarchyConfig: (hierarchy) =>
      set((state) => ({
        config: {
          ...state.config,
          hierarchy,
        },
      })),

    setFullConfig: (newConfig, templateId = null) =>
      set({
        config: mergeGraphConfig(newConfig),
        activeTemplateId: templateId,
      }),

    resetToDefault: () => {
      const freshTemplatesState = useGraphTemplatesStore.getState();
      const freshDefault =
        freshTemplatesState.getDefaultConfig?.() ?? useGraphStore.getState().config;
      set({
        config: mergeGraphConfig(freshDefault),
        activeTemplateId: freshTemplatesState.defaultTemplateId ?? null,
      });
    },
  }));
}

/** Registry: satu store config per graph leaf (tab), hidup sampai tab ditutup. */
const leafConfigStores = new Map<string, StoreApi<LeafGraphConfigState>>();

export function getOrCreateLeafConfigStore(leafId: string): StoreApi<LeafGraphConfigState> {
  let store = leafConfigStores.get(leafId);
  if (!store) {
    store = createLeafGraphConfigStore();
    leafConfigStores.set(leafId, store);
  }
  return store;
}

export function disposeLeafConfigStore(leafId: string): void {
  leafConfigStores.delete(leafId);
}

/** Hook: memoized store per leaf id. */
export function useLeafGraphConfigStore(leafId: string): StoreApi<LeafGraphConfigState> {
  return useMemo(() => getOrCreateLeafConfigStore(leafId), [leafId]);
}

const LeafGraphConfigContext = createContext<StoreApi<LeafGraphConfigState> | null>(null);

export function LeafGraphConfigProvider({
  store,
  children,
}: {
  store: StoreApi<LeafGraphConfigState>;
  children: ReactNode;
}) {
  return createElement(LeafGraphConfigContext.Provider, { value: store }, children);
}

export function useLeafGraphConfigApi(): StoreApi<LeafGraphConfigState> | null {
  return useContext(LeafGraphConfigContext);
}

export function useLeafGraphConfig(): GraphConfigState;
export function useLeafGraphConfig<T>(selector: (state: LeafGraphConfigState) => T): T;
export function useLeafGraphConfig<T>(selector?: (state: LeafGraphConfigState) => T) {
  const store = useContext(LeafGraphConfigContext);
  // Fallback ke global store bila dipanggil di luar leaf graph tab.
  const globalConfig = useGraphStore((s) => s.config);
  const fallback = useMemo<LeafGraphConfigState>(() => {
    const g = useGraphStore.getState();
    return {
      config: mergeGraphConfig(g.config),
      activeTemplateId: null,
      setAtmosphereConfig: (u) => g.updateAtmosphereConfig(u),
      setNodeConfig: (u) => g.updateNodeConfig(typeof u === 'function' ? u(g.config.nodes) : u),
      setLinkConfig: (u) => g.updateLinkConfig(typeof u === 'function' ? u(g.config.links) : u),
      setForceConfig: (u) => g.updateForceConfig(typeof u === 'function' ? u(g.config.forces) : u),
      setTopologyConfig: (u) =>
        g.updateTopologyConfig(typeof u === 'function' ? u(g.config.topology) : u),
      setHierarchyConfig: (h) => g.updateHierarchyConfig(h),
      setFullConfig: (c) => g.setConfig(mergeGraphConfig(c)),
      resetToDefault: () => g.resetConfig(),
    };
  }, []);
  if (!store) {
    return selector
      ? selector({ ...fallback, config: mergeGraphConfig(globalConfig) })
      : mergeGraphConfig(globalConfig);
  }
  return useStore(store, (selector ?? ((s) => s.config)) as (s: LeafGraphConfigState) => T);
}