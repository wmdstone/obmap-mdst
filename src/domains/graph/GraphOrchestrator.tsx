import React, { useRef, useMemo, useCallback } from "react";
import { GraphCanvas, type GraphCanvasHandle } from "./components/GraphCanvas";
import { GraphWorkspaceControls, type SmartZoomAction } from "./components/GraphWorkspaceControls";
import { useGraphInteractionStore } from "./shared/stores/useGraphInteractionStore";
import { useLeafGraphConfigStore } from "./shared/stores/useLeafGraphConfigStore";
import { useGraphData } from "./shared/hooks/useGraphData";

export interface GraphOrchestratorProps {
  leafId: string;
  className?: string;
}

/**
 * GraphOrchestrator - Single Entry Point for the Graph Domain
 * Coordinates reactive state, simulation data, and graph controls into a unified surface.
 */
export const GraphOrchestrator: React.FC<GraphOrchestratorProps> = ({ leafId, className }) => {
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const selectedNodeId = useGraphInteractionStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useGraphInteractionStore((s) => s.setSelectedNodeId);
  const hoverNodeId = useGraphInteractionStore((s) => s.hoverNodeId);
  const setHoverNodeId = useGraphInteractionStore((s) => s.setHoverNodeId);

  const config = useLeafGraphConfigStore((s) => s.getConfig(leafId));
  const setConfig = useLeafGraphConfigStore((s) => s.setConfig);

  const { nodes, links, rawNodes } = useGraphData();

  const handleSmartZoom = useCallback((action: SmartZoomAction) => {
    if (!canvasRef.current) return;
    if (action === "zoom-in") canvasRef.current.zoomIn();
    else if (action === "zoom-out") canvasRef.current.zoomOut();
    else if (action === "fit-view") canvasRef.current.fitView();
    else if (action === "reset-zoom") canvasRef.current.resetZoom();
  }, []);

  return (
    <div className={`relative h-full w-full overflow-hidden select-none ${className ?? ""}`}>
      <GraphCanvas
        ref={canvasRef}
        nodes={nodes}
        links={links}
        rawNodes={rawNodes}
        config={config}
        selectedNodeId={selectedNodeId}
        hoverNodeId={hoverNodeId}
        onSelectNode={setSelectedNodeId}
        onHoverNode={setHoverNodeId}
      />

      <GraphWorkspaceControls
        leafId={leafId}
        config={config}
        onConfigChange={(patch) => setConfig(leafId, patch)}
        onSmartZoom={handleSmartZoom}
      />
    </div>
  );
};

export default GraphOrchestrator;
