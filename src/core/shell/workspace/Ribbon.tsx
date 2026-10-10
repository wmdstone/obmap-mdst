import { IconRibbon, type RibbonTool } from "./IconRibbon";
import { SidebarPanel } from "./SidebarPanel";
import { useUIStore } from "@/shared/stores";
import { useVaultSession } from "./VaultSessionContext";
import { useWorkspaceStore } from "./store/useWorkspaceStore";
import { openGraphCanvas } from "./graphCanvasCommands";

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
    onNodeDelete,
    onNodeUpdate,
    onImportComplete,
    onCloseVault,
    currentVaultId,
    vaultName,
    vaultLocation,
    availableVaults,
    onSwitchVault,
  } = useVaultSession();

  const handleToolSelect = (tool: RibbonTool) => {
    if (tool === "settings") {
      setActiveTool(activeTool === "settings" ? null : "settings");
      return;
    }
    setActiveTool(activeTool === tool ? null : tool);
  };

  const handleOpenGraph = () => openGraphCanvas("graph");
  const handleOpenMindmap = () => openGraphCanvas("mindmap");

  return (
    <>
      {/* Sembunyikan ribbon icon di layar mobile/tablet, hanya tampil di md ke atas */}
      <div className="hidden md:flex h-full shrink-0">
        <IconRibbon
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          onOpenGraph={handleOpenGraph}
          onOpenMindmap={handleOpenMindmap}
        />
      </div>

      {activeTool && (
        <div className="relative md:static z-40">
          <SidebarPanel
            activeTool={activeTool}
            onClose={() => setActiveTool(null)}
            nodes={nodes}
            selectedNode={selectedNode}
            onNodeSelect={(node) => {
              setSelectedNode(node);
            }}
            onNodeOpen={(node) => {
              setSelectedNode(node);
              if (node.type !== "folder") {
                openView({ type: "markdown", nodeId: node.id, title: node.name });
                // Tutup sidebar di layar HP saat file dipilih agar workspace lega
                if (window.innerWidth < 768) {
                  setActiveTool(null);
                }
              }
            }}
            onNodeMove={onNodeMove}
            onNodeDelete={onNodeDelete}
            onNodeUpdate={onNodeUpdate}
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
        </div>
      )}
    </>
  );

}