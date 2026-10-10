import { GraphCanvas, type GraphCanvasHandle } from "@/core/graph/GraphCanvas";
import { GraphWorkspaceControls, type SmartZoomAction } from "@/core/graph/GraphWorkspaceControls";
import {
  GraphInteractionProvider,
  useGraphInteractionStore,
  useLeafGraphInteractionStore,
} from "@/core/graph/model/useGraphInteractionStore";
import {
  LeafGraphConfigProvider,
  useLeafGraphConfig,
  useLeafGraphConfigStore,
} from "@/core/graph/model/useLeafGraphConfigStore";
import { useGraphStore, useNodeStore } from "@/shared/stores";
import { useVaultSession } from "../VaultSessionContext";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import type { LeafViewProps } from "../ViewRegistry";
import type { ViewState } from "../store/types";
import { useEffect, useRef, useState } from "react";

function GraphLeafBody({ leafId, canvasMode: requestedMode, view }: { leafId: string; view?: ViewState; isActive?: boolean; canvasMode?: "graph" | "mindmap" }) {

  const { 
    graphData, 
    selectedNode, 
    setSelectedNode, 
    onNodeMove, 
    onNodeDelete,
    onNodeUpdate,
    nodes 
  } = useVaultSession();

  const handleAddSubNode = async (parentId: string, type: "file" | "folder") => {
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;

    // Jika node saat ini berupa file, konversi menjadi folder agar bisa memiliki children
    if (parentNode.type !== "folder") {
      onNodeUpdate({ ...parentNode, type: "folder" });
    }

    const newNode = {
      id: `node-${Date.now()}`,
      name: type === "folder" 
        ? `New Folder ${nodes.filter((n) => n.type === "folder").length + 1}`
        : `New File ${nodes.filter((n) => n.type === "file").length + 1}`,
      content: "",
      type,
      parentId: parentNode.id,
      depth: parentNode.depth + 1,
      tags: [],
    };

    useNodeStore.getState().addNode(newNode);
    setSelectedNode(newNode);
  };

  // Ambil config dari store lokal tab ini (fallback ke global store bila di luar provider)
  const localConfig = useLeafGraphConfig((s) => s.config);
  const fallbackConfig = useGraphStore((s) => s.config);
  const graphConfig = localConfig ?? fallbackConfig;

  const {
    layoutMode,
    setLayoutMode,
    orientation,
    setOrientation,
    collapsedIds,
    expandAll,
    focusedRootId,
    setFocusedRoot,
    canvasMode,
    setCanvasMode,
  } = useGraphInteractionStore();

    useEffect(() => {
    if (requestedMode) setCanvasMode(requestedMode);
  }, [requestedMode, setCanvasMode]);

  // Sinkronkan tab title & canvasMode pada leaf view
  useEffect(() => {
    const title = canvasMode === "mindmap" ? "Mindmap View" : "Graph View";
    if (view && (view.title !== title || view.canvasMode !== canvasMode)) {
      useWorkspaceStore.getState().setLeafView(leafId, { ...view, title, canvasMode });
    }
  }, [canvasMode, leafId, view]);

  // The ribbon / shortcuts set the requested mode on the tab's view state.
  useEffect(() => {
    if (requestedMode) setCanvasMode(requestedMode);
  }, [requestedMode, setCanvasMode]);

  // Keep the tab title in sync with the active mode.
  useEffect(() => {
    const title = canvasMode === "mindmap" ? "Mindmap View" : "Graph View";
    if (view && view.title !== title) {
      useWorkspaceStore.getState().setLeafView(leafId, { ...view, title });
    }
  }, [canvasMode, leafId, view]);

  const [search, setSearch] = useState("");
  const [minDepth, setMinDepth] = useState(0);
  const [maxDepth, setMaxDepth] = useState(10);
  const [contentFilter, setContentFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const graphRef = useRef<GraphCanvasHandle>(null);

  const handleSmartZoom = (action: SmartZoomAction) => graphRef.current?.smartZoom(action);

  const handleSelect = (node: typeof selectedNode) => {
    setSelectedNode(node);
  };

  const handleOpen = (node: typeof selectedNode) => {
    if (node && node.type !== "folder") {
      useWorkspaceStore.getState().openFile(node.id, node.name);
    }
  };

  return (
    <div className="relative w-full h-full">
      <GraphCanvas
        ref={graphRef}
        graphData={graphData}
        selectedNode={selectedNode}
        onNodeSelect={handleSelect}
        onNodeOpen={handleOpen}
        onNodeMove={onNodeMove}
        onNodeDelete={onNodeDelete}
        onAddSubNode={handleAddSubNode}
        graphConfig={graphConfig}
        search={search}
        minDepth={minDepth}
        maxDepth={maxDepth}
        contentFilter={contentFilter}
        tagFilter={tagFilter}
      />

      <GraphWorkspaceControls
        layout={layoutMode}
        canvasMode={canvasMode}
        onCanvasModeChange={setCanvasMode}
        onLayoutChange={setLayoutMode}
        orientation={orientation}
        onOrientationChange={setOrientation}
        collapsedCount={collapsedIds.length}
        onExpandAll={expandAll}
        focused={Boolean(focusedRootId)}
        onClearFocus={() => setFocusedRoot(null)}
        search={search}
        onSearchChange={setSearch}
        minDepth={minDepth}
        onMinDepthChange={(value) => {
          setMinDepth(value);
          if (value > maxDepth) setMaxDepth(value);
        }}
        maxDepth={maxDepth}
        onMaxDepthChange={(value) => {
          setMaxDepth(value);
          if (value < minDepth) setMinDepth(value);
        }}
        contentFilter={contentFilter}
        onContentFilterChange={setContentFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        onSmartZoom={handleSmartZoom}
      />
    </div>
  );
}

export default function GraphLeaf({ leaf, isActive = true }: LeafViewProps) {
  const interactionStore = useLeafGraphInteractionStore(leaf.id);
  const configStore = useLeafGraphConfigStore(leaf.id);

  return (
    <LeafGraphConfigProvider store={configStore}>
      <GraphInteractionProvider store={interactionStore}>
        <GraphLeafBody leafId={leaf.id} isActive={isActive} canvasMode={leaf.view.canvasMode} view={leaf.view} />
      </GraphInteractionProvider>
    </LeafGraphConfigProvider>
  );
}