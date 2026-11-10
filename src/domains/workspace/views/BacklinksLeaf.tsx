import { BacklinksView } from "@/domains/metadata/backlinks/BacklinksView";
import { useNodeStore } from "@/shared/stores";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { linkMentionAction } from "@/domains/workspace/actions/workspaceActions";
import type { WorkspaceLeaf } from "@/domains/workspace/types";

export default function BacklinksLeaf({ leaf }: { leaf: WorkspaceLeaf }) {
  const nodes = useNodeStore((s) => s.nodes);
  const selectedNode = useNodeStore((s) => s.selectedNode);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);

  const node =
    nodes.find((n) => n.id === (leaf.view.nodeId ?? selectedNode?.id)) ?? null;

  if (!node || node.type === "folder") {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Open a note to see its backlinks.
      </div>
    );
  }

  return (
    <BacklinksView
      node={node}
      nodes={nodes}
      onLinkMention={(sourceNodeId, targetName) => linkMentionAction(sourceNodeId, targetName)}
      onOpenNode={(nodeId) => {
        const target = nodes.find((n) => n.id === nodeId);
        if (target) {
          setSelectedNode(target);
          useWorkspaceStore.getState().openFile(target.id, target.name);
        }
      }}
    />
  );
}