/**
 * Graph engine settings: spacing, labels and the timeline date field.
 *
 * Layout mode / orientation / collapse live in `useGraphInteractionStore`;
 * the legacy renderer toggle, link-routing choice and per-depth rules were
 * removed together with the parallel canvas renderer.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GraphEngineState {
  timeField: string;
  laneHeight: number;
  levelDistance: number;
  showLabels: boolean;
  labelZoomThreshold: number;

  patch: (partial: Partial<Omit<GraphEngineState, 'patch'>>) => void;
}

export const useGraphEngineStore = create<GraphEngineState>()(
  persist(
    (set) => ({
      timeField: 'date',
      laneHeight: 46,
      levelDistance: 110,
      showLabels: true,
      labelZoomThreshold: 0.7,

      patch: (partial) => set(partial),
    }),
    {
      name: 'graph-engine-storage',
      version: 2,
      partialize: (state) => ({
        timeField: state.timeField,
        laneHeight: state.laneHeight,
        levelDistance: state.levelDistance,
        showLabels: state.showLabels,
        labelZoomThreshold: state.labelZoomThreshold,
      }),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<GraphEngineState>;
        return {
          timeField: state.timeField ?? 'date',
          laneHeight: state.laneHeight ?? 46,
          levelDistance: state.levelDistance ?? 110,
          showLabels: state.showLabels ?? true,
          labelZoomThreshold: state.labelZoomThreshold ?? 0.7,
        } as GraphEngineState;
      },
    }
  )
);
