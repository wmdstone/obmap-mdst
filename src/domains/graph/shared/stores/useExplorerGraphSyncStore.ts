import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExplorerGraphSyncMode =
  | "off"
  | "hover-highlight"
  | "select-focus"
  | "hover-and-focus";

interface ExplorerFocusRequest {
  nodeId: string;
  nonce: number;
}

interface ExplorerGraphSyncState {
  mode: ExplorerGraphSyncMode;

  /**
   * State transient. Tidak dipersist karena hover hanya berlaku selama
   * pointer berada pada item File Explorer.
   */
  explorerHoveredNodeId: string | null;

  /**
   * Command one-way dari File Explorer ke GraphCanvas.
   * `nonce` memastikan klik node yang sama tetap dianggap request baru.
   */
  focusRequest: ExplorerFocusRequest | null;

  setMode: (mode: ExplorerGraphSyncMode) => void;
  setExplorerHoveredNodeId: (nodeId: string | null) => void;
  clearExplorerHoveredNode: (nodeId?: string) => void;
  requestFocus: (nodeId: string) => void;
}

export const useExplorerGraphSyncStore = create<ExplorerGraphSyncState>()(
  persist(
    (set, get) => ({
      mode: "off",
      explorerHoveredNodeId: null,
      focusRequest: null,

      setMode: (mode) =>
        set({
          mode,
          // Jangan biarkan highlight lama tertinggal ketika mode hover dimatikan.
          explorerHoveredNodeId:
            mode === "hover-highlight" || mode === "hover-and-focus"
              ? get().explorerHoveredNodeId
              : null,
        }),

      setExplorerHoveredNodeId: (nodeId) =>
        set((state) =>
          state.explorerHoveredNodeId === nodeId
            ? state
            : { explorerHoveredNodeId: nodeId },
        ),

      clearExplorerHoveredNode: (nodeId) =>
        set((state) => {
          // Jika nodeId diberikan, hanya hapus bila hover saat ini memang node itu.
          if (
            nodeId &&
            state.explorerHoveredNodeId &&
            state.explorerHoveredNodeId !== nodeId
          ) {
            return state;
          }

          if (!state.explorerHoveredNodeId) return state;
          return { explorerHoveredNodeId: null };
        }),

      requestFocus: (nodeId) =>
        set({
          focusRequest: {
            nodeId,
            nonce: Date.now(),
          },
        }),
    }),
    {
      name: "explorer-graph-sync",
      partialize: (state) => ({
        mode: state.mode,
      }),
    },
  ),
);