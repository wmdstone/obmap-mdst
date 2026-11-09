import { GraphCanvas, type GraphCanvasHandle } from "@/domains/graph/components/GraphCanvas";
import { GraphWorkspaceControls, type SmartZoomAction } from "@/domains/graph/components/GraphWorkspaceControls";
import {
  GraphInteractionProvider,
  useGraphInteractionStore,
  useLeafGraphInteractionStore,
} from "@/domains/graph/model/useGraphInteractionStore";
import {
  LeafGraphConfigProvider,
  useLeafGraphConfig,
  useLeafGraphConfigStore,
} from "@/domains/graph/model/useLeafGraphConfigStore";
import { useGraphStore, useNodeStore } from "@/shared/stores";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import type { LeafViewProps } from "../registry/ViewRegistry";
import type { ViewState } from "../types";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useGraphData } from "@/domains/graph/hooks/useGraphData";
import {
  moveNodeAction,
  deleteNodeAction,
  updateNodeAction,
  addNodeAction,
} from "../actions/workspaceActions";


function GraphLeafBody({ leafId, canvasMode: requestedMode, view }: { leafId: string; view?: ViewState; isActive?: boolean; canvasMode?: "graph" | "mindmap" }) {
  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;

  const nodes = useNodeStore((s) => s.nodes);
  const selectedNode = useNodeStore((s) => s.selectedNode);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);

  // Ambil config dari store lokal tab ini (fallback ke global store bila di luar provider)
  const localConfig = useLeafGraphConfig((s) => s.config);
  const fallbackConfig = useGraphStore((s) => s.config);
  const graphConfig = localConfig ?? fallbackConfig;

  // Data graf dihitung spesifik untuk leaf ini
  const graphData = useGraphData(graphConfig);

  const handleAddSubNode = async (parentId: string, type: "file" | "folder") => {
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;

    if (parentNode.type !== "folder") {
      await updateNodeAction({ ...parentNode, type: "folder" }, isAuthenticated);
    }

    await addNodeAction(type);
  };

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
    if (node) {
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
        onNodeMove={(nodeId, newParentId) => moveNodeAction(nodeId, newParentId)}
        onNodeDelete={(nodeId) => deleteNodeAction(nodeId, isAuthenticated)}
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