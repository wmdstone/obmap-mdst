import { GraphCanvas, type GraphCanvasHandle } from "@/core/graph/GraphCanvas";
import { GraphWorkspaceControls, type SmartZoomAction } from "@/core/graph/GraphWorkspaceControls";
import {
  GraphInteractionProvider,
  useGraphInteractionStore,
  useLeafGraphInteractionStore,
} from "@/core/graph/model/useGraphInteractionStore";
import { useGraphStore } from "@/shared/stores";
import { useVaultSession } from "../VaultSessionContext";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import type { LeafViewProps } from "../ViewRegistry";
import { useRef, useState } from "react";

function GraphLeafBody() {
  const { graphData, selectedNode, setSelectedNode } = useVaultSession();
  const graphConfig = useGraphStore((s) => s.config);
  const {
    layoutMode,
    setLayoutMode,
    orientation,
    setOrientation,
    highlightMode,
    setHighlightMode,
    collapsedIds,
    expandAll,
    focusedRootId,
    setFocusedRoot,
  } = useGraphInteractionStore();
  const [search, setSearch] = useState("");
  const [minDepth, setMinDepth] = useState(0);
  const [maxDepth, setMaxDepth] = useState(10);
  const [contentFilter, setContentFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const graphRef = useRef<GraphCanvasHandle>(null);

  const handleSmartZoom = (action: SmartZoomAction) => graphRef.current?.smartZoom(action);

  const handleSelect = (node: typeof selectedNode) => {
    setSelectedNode(node);
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
        graphConfig={graphConfig}
        search={search}
        minDepth={minDepth}
        maxDepth={maxDepth}
        contentFilter={contentFilter}
        tagFilter={tagFilter}
      />

      <GraphWorkspaceControls
        layout={layoutMode}
        onLayoutChange={setLayoutMode}
        orientation={orientation}
        onOrientationChange={setOrientation}
        highlightPathway={highlightMode === "pathway"}
        onHighlightPathwayChange={(value) =>
          setHighlightMode(value ? "pathway" : "off")
        }
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

export default function GraphLeaf({ leaf }: LeafViewProps) {
  // One interaction store per graph tab: each graph keeps its own layout,
  // orientation, collapse set, focus and highlight state.
  const store = useLeafGraphInteractionStore(leaf.id);
  return (
    <GraphInteractionProvider store={store}>
      <GraphLeafBody />
    </GraphInteractionProvider>
  );
}
