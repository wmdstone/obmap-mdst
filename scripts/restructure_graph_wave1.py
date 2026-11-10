#!/usr/bin/env python3
"""
Wave 1: Graph Domain Restructuring Script
Standardizes src/domains/graph into:
- GraphOrchestrator.tsx
- components/ (flat UI components)
- shared/ (api, stores, hooks, utils)
Includes backward-compatible re-exports for zero-breakage compilation.
"""

import os
import shutil
from pathlib import Path

ROOT = Path("src/domains/graph")

def ensure_dirs():
    dirs = [
        ROOT / "components",
        ROOT / "shared" / "api",
        ROOT / "shared" / "stores",
        ROOT / "shared" / "hooks",
        ROOT / "shared" / "utils",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    print("✓ Directories verified: components/ and shared/{api,stores,hooks,utils}")

def move_and_shim(src_rel: str, dst_rel: str, export_all: bool = True):
    src = ROOT / src_rel
    dst = ROOT / dst_rel
    if not src.exists():
        if dst.exists():
            print(f"  [Skip] Already at {dst_rel}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

    # Compute relative import path from src to dst for the shim
    rel_depth = len(Path(src_rel).parent.parts)
    prefix = "../" * rel_depth if rel_depth > 0 else "./"
    shim_target = f"{prefix}{dst_rel}".replace(".tsx", "").replace(".ts", "")

    # Replace old file with a clean re-export shim
    shim_content = f"// Re-export bridge for backward compatibility\nexport * from '{shim_target}';\n"
    src.write_text(shim_content, encoding="utf-8")
    print(f"✓ Migrated {src_rel} -> {dst_rel} (shim preserved)")

def run_migration():
    ensure_dirs()

    # 1. API (Services)
    move_and_shim("services/GraphService.ts", "shared/api/GraphService.ts")
    move_and_shim("services/RelationshipMapper.ts", "shared/api/RelationshipMapper.ts")
    move_and_shim("services/ZipImportService.ts", "shared/api/ZipImportService.ts")

    # 2. Stores
    move_and_shim("stores/useGraphStore.ts", "shared/stores/useGraphStore.ts")
    move_and_shim("stores/useGraphEngineStore.ts", "shared/stores/useGraphEngineStore.ts")
    move_and_shim("stores/useGraphTemplatesStore.ts", "shared/stores/useGraphTemplatesStore.ts")
    move_and_shim("stores/useGraphToolbarStore.ts", "shared/stores/useGraphToolbarStore.ts")
    move_and_shim("stores/useExplorerGraphSyncStore.ts", "shared/stores/useExplorerGraphSyncStore.ts")
    move_and_shim("stores/useNodeStore.ts", "shared/stores/useNodeStore.ts")
    move_and_shim("model/useGraphInteractionStore.ts", "shared/stores/useGraphInteractionStore.ts")
    move_and_shim("model/useLeafGraphConfigStore.ts", "shared/stores/useLeafGraphConfigStore.ts")

    # 3. Hooks
    move_and_shim("hooks/useGraphData.ts", "shared/hooks/useGraphData.ts")
    move_and_shim("hooks/useAutoLinks.tsx", "shared/hooks/useAutoLinks.tsx")
    move_and_shim("hooks/useCanvasAtmosphere.ts", "shared/hooks/useCanvasAtmosphere.ts")
    move_and_shim("hooks/useCanvasDragReparent.ts", "shared/hooks/useCanvasDragReparent.ts")
    move_and_shim("hooks/useCanvasGestureBridge.ts", "shared/hooks/useCanvasGestureBridge.ts")
    move_and_shim("layout/useLayoutEngine.ts", "shared/hooks/useLayoutEngine.ts")

    # 4. Utils (Layouts, Math, Algorithms, Renderers, Types)
    move_and_shim("model/graphTypes.ts", "shared/utils/graph.types.ts")
    move_and_shim("model/atmosphereConfig.ts", "shared/utils/atmosphereConfig.ts")
    move_and_shim("model/hierarchyColors.ts", "shared/utils/hierarchyColors.ts")
    move_and_shim("model/hierarchyTraversal.ts", "shared/utils/hierarchyTraversal.ts")
    move_and_shim("model/buildGraphProjection.ts", "shared/utils/buildGraphProjection.ts")

    move_and_shim("interactions/dragReparent.ts", "shared/utils/dragReparent.ts")
    move_and_shim("interactions/focusGraph.ts", "shared/utils/focusGraph.ts")
    move_and_shim("interactions/graphMutations.ts", "shared/utils/graphMutations.ts")
    move_and_shim("interactions/graphTraversal.ts", "shared/utils/graphTraversal.ts")

    for layout_file in [
        "fishbone.ts", "freeForce.ts", "layoutCategory.ts", "layoutMath.ts",
        "mindmap.ts", "networkLayouts.ts", "subtreeCompose.ts", "timeline.ts",
        "transitionController.ts", "treeLayouts.ts"
    ]:
        move_and_shim(f"layout/{layout_file}", f"shared/utils/{layout_file}")

    for render_file in [
        "cosmicAtmosphere.ts", "drawDecorations.ts", "drawLink.ts",
        "drawNode.ts", "textLayout.ts", "theme.ts"
    ]:
        move_and_shim(f"render/{render_file}", f"shared/utils/{render_file}")

    # 5. Flat Components
    component_renames = [
        ("components/DynamicLinkManager.tsx", "components/GraphDynamicLinkManager.tsx"),
        ("components/LinkManager.tsx", "components/GraphLinkManager.tsx"),
        ("components/BacklinksPanel.tsx", "components/GraphBacklinksPanel.tsx"),
        ("components/FolderOverviewEditor.tsx", "components/GraphFolderOverviewEditor.tsx"),
        ("components/NodePanel.tsx", "components/GraphNodePanel.tsx"),
        ("components/MarkdownRenderer.tsx", "components/GraphMarkdownRenderer.tsx"),
        ("controls/FloatingZoomControls.tsx", "components/GraphFloatingZoomControls.tsx"),
        ("controls/panels/AppearancePanel.tsx", "components/GraphAppearancePanel.tsx"),
        ("controls/panels/FreeForceControls.tsx", "components/GraphFreeForceControls.tsx"),
        ("controls/panels/GlobalTemplatesPanel.tsx", "components/GraphGlobalTemplatesPanel.tsx"),
        ("controls/panels/LayoutPanel.tsx", "components/GraphLayoutPanel.tsx"),
        ("controls/panels/SearchPanel.tsx", "components/GraphSearchPanel.tsx"),
        ("config-panel/AnalyticsTab.tsx", "components/GraphAnalyticsTab.tsx"),
        ("config-panel/AtmosphereControls.tsx", "components/GraphAtmosphereControls.tsx"),
        ("config-panel/CollapsibleSection.tsx", "components/GraphCollapsibleSection.tsx"),
        ("config-panel/ColorEngineControls.tsx", "components/GraphColorEngineControls.tsx"),
        ("config-panel/ColorPicker.tsx", "components/GraphColorPicker.tsx"),
        ("config-panel/HierarchyColorControls.tsx", "components/GraphHierarchyColorControls.tsx"),
        ("config-panel/LayoutEngineTab.tsx", "components/GraphLayoutEngineTab.tsx"),
        ("config-panel/LinkStylingTab.tsx", "components/GraphLinkStylingTab.tsx"),
        ("config-panel/NodeStylingTab.tsx", "components/GraphNodeStylingTab.tsx"),
        ("config-panel/index.tsx", "components/GraphConfigPanel.tsx"),
        ("interactions/ContextualToolbar.tsx", "components/GraphContextualToolbar.tsx"),
        ("node-panel/NodeBacklinksSection.tsx", "components/GraphNodeBacklinksSection.tsx"),
        ("node-panel/NodeBreadcrumBar.tsx", "components/GraphNodeBreadcrumbBar.tsx"),
        ("node-panel/NodeCitationsSection.tsx", "components/GraphNodeCitationsSection.tsx"),
        ("node-panel/NodeMediaPreview.tsx", "components/GraphNodeMediaPreview.tsx"),
    ]

    for src_file, dst_file in component_renames:
        move_and_shim(src_file, dst_file)

    create_orchestrator()

def create_orchestrator():
    orchestrator_path = ROOT / "GraphOrchestrator.tsx"
    code = """import React, { useRef, useMemo, useCallback } from "react";
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
"""
    orchestrator_path.write_text(code, encoding="utf-8")
    print("✓ Created GraphOrchestrator.tsx")

if __name__ == "__main__":
    print("Starting Wave 1 Graph Domain Restructuring...")
    run_migration()
    print("Done! Run 'bun test src/domains/graph/' to verify test suite.")
