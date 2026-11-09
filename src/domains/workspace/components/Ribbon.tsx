import { useState, useEffect } from "react";
import { IconRibbon, type RibbonTool } from "@/domains/workspace/components/IconRibbon";
import { SidebarPanel } from "./SidebarPanel";
import { useUIStore } from "@/shared/stores";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { openGraphCanvas } from "@/domains/workspace/commands/graphCanvasCommands";
import { useNodeStore, useVaultStore } from "@/shared/stores";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { supabase } from "@/shared/lib/untypedSupabase";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import {
  moveNodeAction,
  addNodeAction,
  deleteNodeAction,
  updateNodeAction,
  importCompleteAction,
  closeVaultAction,
  switchVaultAction,
} from "@/domains/workspace/actions/workspaceActions";

export function Ribbon() {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const openView = useWorkspaceStore((s) => s.openView);

  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;

  const nodes = useNodeStore((s) => s.nodes);
  const selectedNode = useNodeStore((s) => s.selectedNode);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);
  const currentVaultId = useVaultStore((s) => s.currentVaultId);

  const vaultManager = getVaultManager();
  const vault = currentVaultId ? vaultManager.getVault(currentVaultId) : null;
  const vaultName = vault?.name ?? null;
  const vaultLocation = vault?.location;

  const handleToolSelect = (tool: RibbonTool) => {
    if (tool === "settings") {
      setActiveTool(activeTool === "settings" ? null : "settings");
      return;
    }
    setActiveTool(activeTool === tool ? null : tool);
  };

  const handleOpenGraph = () => openGraphCanvas("graph");
  const handleOpenMindmap = () => openGraphCanvas("mindmap");

  const [authorizedVaultIds, setAuthorizedVaultIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchAuthorizedVaults() {
      if (!user) {
        setAuthorizedVaultIds(new Set());
        return;
      }

      // Cek apakah superadmin
      const { data: superadmin } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superadmin")
        .maybeSingle();

      if (superadmin) {
        // Superadmin berhak melihat semua vault
        setAuthorizedVaultIds(null);
        return;
      }

      // Ambil vault milik sendiri & vault di mana user terdaftar sebagai member
      const [ownVaults, memberVaults] = await Promise.all([
        supabase.from("user_vaults").select("id").eq("user_id", user.id),
        supabase.from("vault_members").select("vault_id").eq("user_id", user.id),
      ]);

      const allowed = new Set<string>();
      (ownVaults.data || []).forEach((v) => allowed.add(v.id));
      (memberVaults.data || []).forEach((m) => allowed.add(m.vault_id));

      if (active) {
        setAuthorizedVaultIds(allowed);
      }
    }

    fetchAuthorizedVaults();
    return () => {
      active = false;
    };
  }, [user]);

  // Hanya daftar vault yang memiliki hak akses
  const availableVaults = vaultManager
    .getAllVaults()
    .filter((item) => authorizedVaultIds === null || authorizedVaultIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      location: item.location,
      nodeCount: item.graphService.getGraphData().nodes.length,
    }));

  return (
    <>
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
            onNodeSelect={(node) => setSelectedNode(node)}
            onNodeOpen={(node) => {
              setSelectedNode(node);
              openView({ type: "markdown", nodeId: node.id, title: node.name });
              if (window.innerWidth < 768) {
                setActiveTool(null);
              }
            }}
            onNodeMove={(nodeId, newParentId) => moveNodeAction(nodeId, newParentId)}
            onNodeDelete={(nodeId) => deleteNodeAction(nodeId, isAuthenticated)}
            onNodeUpdate={(node) => updateNodeAction(node, isAuthenticated)}
            onAddNode={(type) => addNodeAction(type)}
            isVaultMode={!!currentVaultId}
            vaultName={vaultName}
            vaultLocation={vaultLocation}
            currentVaultId={currentVaultId}
            availableVaults={availableVaults}
            onSwitchVault={(vaultId) => switchVaultAction(vaultId)}
            onCloseVault={() => closeVaultAction()}
            onImportComplete={(imported, updated) =>
              importCompleteAction(imported, updated, isAuthenticated)
            }
          />
        </div>
      )}
    </>
  );
}