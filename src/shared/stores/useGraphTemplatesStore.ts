import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphConfigState } from './useGraphStore';
import type { LayoutMode, MindmapOrientation } from '@/core/graph/model/graphTypes';
import { defaultGraphConfig, mergeGraphConfig } from './useGraphStore';

export interface GraphTemplate {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  config: GraphConfigState;
  layoutMode?: LayoutMode;
  orientation?: MindmapOrientation;
}

export interface GraphTemplatesState {
  templates: Record<string, GraphTemplate>;
  defaultTemplateId: string | null;
  saveTemplate: (
    name: string,
    config: GraphConfigState,
    layoutMode?: LayoutMode,
    orientation?: MindmapOrientation
  ) => string;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string | null) => void;
  getTemplate: (id: string) => GraphTemplate | undefined;
  getDefaultConfig: () => GraphConfigState;
  setAll: (data: { templates: Record<string, GraphTemplate>; defaultTemplateId: string | null }) => void;
}

export const useGraphTemplatesStore = create<GraphTemplatesState>()(
  persist(
    (set, get) => ({
      templates: {},
      defaultTemplateId: null,

      saveTemplate: (name, config, layoutMode, orientation) => {
        const id = `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newTemplate: GraphTemplate = {
          id,
          name: name.trim() || 'Untitled Template',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          config: JSON.parse(JSON.stringify(config)),
          layoutMode,
          orientation,
        };

        set((state) => ({
          templates: { ...state.templates, [id]: newTemplate },
          defaultTemplateId: state.defaultTemplateId ?? id,
        }));
        return id;
      },

      deleteTemplate: (id) =>
        set((state) => {
          const next = { ...state.templates };
          delete next[id];
          return {
            templates: next,
            defaultTemplateId: state.defaultTemplateId === id ? null : state.defaultTemplateId,
          };
        }),

      setDefaultTemplate: (id) => set({ defaultTemplateId: id }),

      getTemplate: (id) => get().templates[id],

      getDefaultConfig: () => {
        const { templates, defaultTemplateId } = get();
        if (defaultTemplateId && templates[defaultTemplateId]) {
          return mergeGraphConfig(templates[defaultTemplateId].config);
        }
        return JSON.parse(JSON.stringify(defaultGraphConfig));
      },

      setAll: (data) =>
        set({
          templates: data?.templates ?? {},
          defaultTemplateId: data?.defaultTemplateId ?? null,
        }),
    }),
    {
      name: 'obmap-graph-templates',
    }
  )
);