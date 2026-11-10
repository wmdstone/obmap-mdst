/** Renders the workspace tree: splits become resizable panel groups. */

import { Fragment } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/global/ui/resizable";
import { WorkspaceGroup } from "@/domains/workspace/components/WorkspaceGroup";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import type { WorkspaceNode } from "@/domains/workspace/types";

export function WorkspaceTree({ node }: { node: WorkspaceNode }) {
  const activeGroupId = useWorkspaceStore((s) => s.activeGroupId);
  const setSizes = useWorkspaceStore((s) => s.setSizes);

  if (node.kind === "group") {
    return <WorkspaceGroup group={node} isActive={node.id === activeGroupId} />;
  }

  return (
    <ResizablePanelGroup
      direction={node.direction}
      onLayout={(sizes) => setSizes(node.id, sizes)}
    >
      {node.children.map((child, index) => (
        <Fragment key={child.id}>
          {index > 0 && <ResizableHandle withHandle />}
          <ResizablePanel
            defaultSize={node.sizes[index] ?? 100 / node.children.length}
            minSize={15}
          >
            <WorkspaceTree node={child} />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
