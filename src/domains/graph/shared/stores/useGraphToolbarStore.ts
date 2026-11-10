import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SettingGroup } from "@/domains/graph/components/GraphWorkspaceControls";

export type GraphControlsDisplayMode = "horizontal_toolbar" | "gear_button";

interface GraphToolbarState {
  mode: GraphControlsDisplayMode;
  isExpanded: boolean;
  activeTab: SettingGroup;
  setMode: (mode: GraphControlsDisplayMode) => void;
  setIsExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setActiveTab: (tab: SettingGroup) => void;
}

export const useGraphToolbarStore = create<GraphToolbarState>()(
  persist(
    (set) => ({
      // Default: Tombol melayang klasik di sudut kiri bawah dengan popup menu
      mode: "gear_button",
      isExpanded: false,
      activeTab: "search",

      setMode: (mode) => set({ mode }),
      setIsExpanded: (isExpanded) => set({ isExpanded }),
      toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: "vault_graph_toolbar_preferences",
      version: 2,
      // Migrasi aman: Mengalihkan pengguna dari default lama (v1) ke gear_button (v2)
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...persistedState,
            mode: "gear_button" as GraphControlsDisplayMode,
          };
        }
        return persistedState as GraphToolbarState;
      },
      partialize: (state) => ({
        mode: state.mode,
        activeTab: state.activeTab,
      }),
    }
  )
);