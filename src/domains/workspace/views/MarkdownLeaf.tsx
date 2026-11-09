import { useMemo } from "react";
import { NodePanel } from "@/domains/graph/components/NodePanel";
import { useNodeStore, useUIStore } from "@/shared/stores";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import type { WorkspaceLeaf } from "../types";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useMetadataVersion } from "@/domains/metadata/useMetadataCache";
import {
  deleteNodeAction,
  getBacklinksForNode,
  handleTagClick,
  handleWikilinkClick,
  updateNodeAction,
} from "../actions/workspaceActions";

export default function MarkdownLeaf({ leaf }: { leaf: WorkspaceLeaf }) {
  const nodes = useNodeStore((s) => s.nodes);
  const getNodePath = useNodeStore((s) => s.getNodePath);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);
  const closeLeaf = useWorkspaceStore((s) => s.closeLeaf);

  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;
  const metadataVersion = useMetadataVersion();

  const node = nodes.find((n) => n.id === leaf.view.nodeId) ?? null;

  const backlinks = useMemo(() => {
    if (!node) return [];
    return getBacklinksForNode(node, nodes, getNodePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, nodes, getNodePath, metadataVersion]);

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        This note is no longer available.
      </div>
    );
  }

  const handleBreadcrumbClick = (target: (typeof nodes)[number]) => {
    setSelectedNode(target);
    useWorkspaceStore.getState().openFile(target.id, target.name);
  };

  return (
    <div className="w-full h-full">
      <NodePanel
        node={node}
        nodePath={getNodePath(node.id)}
        onClose={() => closeLeaf(leaf.id)}
        onUpdate={(updated) => updateNodeAction(updated, isAuthenticated)}
        onDelete={(nodeId) => deleteNodeAction(nodeId, isAuthenticated)}
        backlinks={backlinks}
        onWikilinkClick={handleWikilinkClick}
        onBacklinkClick={(nodeId) => {
          const target = nodes.find((n) => n.id === nodeId);
          if (target) {
            setSelectedNode(target);
            useWorkspaceStore.getState().openFile(target.id, target.name);
          }
        }}
        onTagClick={handleTagClick}
        onBreadcrumbClick={handleBreadcrumbClick}
      />
    </div>
  );
}
