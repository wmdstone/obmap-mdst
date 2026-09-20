/**
 * Graph interaction state.
 *
 * Graph *content* stays in the vault session; this store only holds view state
 * (layout mode, collapse set, selection, hover, focus, transition status).
 *
 * Each graph leaf (tab) owns its own instance of this store through
 * `GraphInteractionProvider`, so several graph views can run side by side with
 * different layouts, filters and collapse sets. A global instance remains as
 * the app-wide default (used by settings panels and by any consumer rendered
 * outside a graph leaf); new leaves start from those defaults.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { createStore, useStore, type StateCreator, type StoreApi } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutMode, MindmapOrientation } from './graphTypes';

export type TransitionStatus = 'idle' | 'animating';
export type HighlightMode = 'off' | 'pathway';

/** Legacy persisted names from the worker engine. */
const LEGACY_MODES: Record<string, LayoutMode> = {
  force: 'free-force',
  tree: 'mindmap',
  mindmap: 'mindmap',
  timeline: 'timeline',
  fishbone: 'fishbone',
  'free-force': 'free-force',
};

export const normalizeLayoutMode = (value: unknown): LayoutMode =>
  LEGACY_MODES[String(value)] ?? 'mindmap';

export interface GraphInteractionState {
  layoutMode: LayoutMode;
  orientation: MindmapOrientation;
  highlightMode: HighlightMode;
  collapsedIds: string[];
  selectedId: string | null;
  hoveredId: string | null;
  focusedRootId: string | null;
  transitionStatus: TransitionStatus;
  simulationCommand: { type: 'reheat' | 'stop'; nonce: number } | null;

  setLayoutMode: (mode: LayoutMode) => void;
  setOrientation: (orientation: MindmapOrientation) => void;
  setHighlightMode: (mode: HighlightMode) => void;
  toggleCollapsed: (id: string) => void;
  setCollapsed: (ids: string[]) => void;
  expandAll: () => void;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setFocusedRoot: (id: string | null) => void;
  setTransitionStatus: (status: TransitionStatus) => void;
  requestReheat: () => void;
  requestStop: () => void;
}

const creator: StateCreator<GraphInteractionState> = (set) => ({
  layoutMode: 'mindmap',
  orientation: 'balanced',
  highlightMode: 'pathway',
  collapsedIds: [],
  selectedId: null,
  hoveredId: null,
  focusedRootId: null,
  transitionStatus: 'idle',
  simulationCommand: null,

  setLayoutMode: (layoutMode) => set({ layoutMode: normalizeLayoutMode(layoutMode) }),
  setOrientation: (orientation) => set({ orientation }),
  setHighlightMode: (highlightMode) => set({ highlightMode }),
  toggleCollapsed: (id) =>
    set((state) => ({
      collapsedIds: state.collapsedIds.includes(id)
        ? state.collapsedIds.filter((item) => item !== id)
        : [...state.collapsedIds, id],
    })),
  setCollapsed: (collapsedIds) => set({ collapsedIds }),
  expandAll: () => set({ collapsedIds: [] }),
  setSelected: (selectedId) => set({ selectedId }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setFocusedRoot: (focusedRootId) => set({ focusedRootId }),
  setTransitionStatus: (transitionStatus) => set({ transitionStatus }),
  requestReheat: () => set({ simulationCommand: { type: 'reheat', nonce: Date.now() } }),
  requestStop: () => set({ simulationCommand: { type: 'stop', nonce: Date.now() } }),
});

/** App-wide defaults; persisted. */
export const globalGraphInteractionStore = createStore<GraphInteractionState>()(
  persist(creator, {
    name: 'graph-interaction-storage',
    version: 1,
    partialize: (state) => ({
      layoutMode: state.layoutMode,
      orientation: state.orientation,
      highlightMode: state.highlightMode,
      collapsedIds: state.collapsedIds,
    }) as GraphInteractionState,
    migrate: (persisted) => {
      const state = (persisted ?? {}) as Partial<GraphInteractionState>;
      return {
        layoutMode: normalizeLayoutMode(state.layoutMode),
        orientation: state.orientation ?? 'balanced',
        highlightMode: state.highlightMode ?? 'pathway',
        collapsedIds: state.collapsedIds ?? [],
      } as GraphInteractionState;
    },
  })
);

/** A fresh, leaf-scoped instance seeded from the app-wide defaults. */
export const createGraphInteractionStore = (): StoreApi<GraphInteractionState> => {
  const store = createStore<GraphInteractionState>()(creator);
  const defaults = globalGraphInteractionStore.getState();
  store.setState({
    layoutMode: defaults.layoutMode,
    orientation: defaults.orientation,
    highlightMode: defaults.highlightMode,
  });
  return store;
};

const GraphInteractionContext = createContext<StoreApi<GraphInteractionState> | null>(null);

export function GraphInteractionProvider({
  store,
  children,
}: {
  store: StoreApi<GraphInteractionState>;
  children: ReactNode;
}) {
  return createElement(GraphInteractionContext.Provider, { value: store }, children);
}

/** Creates (and memoises) one store per graph leaf id. */
export function useLeafGraphInteractionStore(leafId: string) {
  return useMemo(() => createGraphInteractionStore(), [leafId]);
}

export function useGraphInteractionStoreApi(): StoreApi<GraphInteractionState> {
  return useContext(GraphInteractionContext) ?? globalGraphInteractionStore;
}

export function useGraphInteractionStore(): GraphInteractionState;
export function useGraphInteractionStore<T>(selector: (state: GraphInteractionState) => T): T;
export function useGraphInteractionStore<T>(selector?: (state: GraphInteractionState) => T) {
  const api = useGraphInteractionStoreApi();
  return useStore(api, (selector ?? ((state) => state)) as (state: GraphInteractionState) => T);
}
