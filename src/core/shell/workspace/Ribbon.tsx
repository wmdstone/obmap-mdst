/**
 * Left ribbon plus the expandable side panel. Reads everything it needs from
 * the vault session, so no props are drilled through the workspace.
 */

import { useEffect, useState } from "react";
import { IconRibbon, type RibbonTool } from "./IconRibbon";
import { SidebarPanel } from "./SidebarPanel";
import { useUIStore } from "@/shared/stores";
import { useVaultSession } from "./VaultSessionContext";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

export function Ribbon() {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const openView = useWorkspaceStore((s) => s.openView);
  const {
    nodes,
    selectedNode,
    setSelectedNode,
    onNodeMove,
    onAddNode,
    onImportComplete,
    onCloseVault,
    currentVaultId,
    vaultName,
    vaultLocation,
    availableVaults,
    onSwitchVault,
  } = useVaultSession();

  const [renderedTool, setRenderedTool] = useState<RibbonTool | null>(
    activeTool,
  );

  useEffect(() => {
    if (activeTool) {
      setRenderedTool(activeTool);
      return;
    }
    const timer = window.setTimeout(() => setRenderedTool(null), 320);
    return () => window.clearTimeout(timer);
  }, [activeTool]);

  const handleToolSelect = (tool: RibbonTool) => {
    if (tool === "settings") {
      setActiveTool(activeTool === "settings" ? null : "settings");
      return;
    }
    setActiveTool(activeTool === tool ? null : tool);
  };

  return (
    <>
      <IconRibbon activeTool={activeTool} onToolSelect={handleToolSelect} />
      {renderedTool && (
        <SidebarPanel
          activeTool={renderedTool}
          open={!!activeTool}
          onClose={() => setActiveTool(null)}
          nodes={nodes}
          selectedNode={selectedNode}
          onNodeSelect={(node) => {
            setSelectedNode(node);
          }}
          onNodeOpen={(node) => {
            setSelectedNode(node);
            if (node.type !== "folder")
              openView({ type: "markdown", nodeId: node.id, title: node.name });
          }}
          onNodeMove={onNodeMove}
          onAddNode={onAddNode}
          isVaultMode={!!currentVaultId}
          vaultName={vaultName}
          vaultLocation={vaultLocation}
          currentVaultId={currentVaultId}
          availableVaults={availableVaults}
          onSwitchVault={onSwitchVault}
          onCloseVault={onCloseVault}
          onImportComplete={onImportComplete}
        />
      )}
    </>
  );
}
