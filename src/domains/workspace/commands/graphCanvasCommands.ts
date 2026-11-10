/**
 * Open (or focus) a graph tab in a given canvas mode, plus the global
 * shortcuts Mod-Shift-G (graph) and Mod-Shift-M (mindmap).
 */
import { commandRegistry } from "@/domains/workspace/commands/CommandRegistry";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";

export function openGraphCanvas(canvasMode: "graph" | "mindmap") {
  useWorkspaceStore.getState().openView({
    type: "graph",
    title: canvasMode === "mindmap" ? "Mindmap View" : "Graph View",
    canvasMode,
  });
}

commandRegistry.registerMany([
  {
    id: "graph:open-graph",
    name: "Open Graph View",
    section: "Graph",
    hotkey: "Mod-Shift-G",
    run: () => openGraphCanvas("graph"),
  },
  {
    id: "graph:open-mindmap",
    name: "Open Mindmap View",
    section: "Graph",
    hotkey: "Mod-Shift-M",
    run: () => openGraphCanvas("mindmap"),
  },
]);
