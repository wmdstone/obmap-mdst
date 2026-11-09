import React from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";
import {
  X,
  ArrowRightToLine,
  Layers,
  Pin,
  PinOff,
  FolderSearch,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useNodeStore } from "@/domains/graph/stores/useNodeStore";
import { useUIStore } from "@/shared/stores";
import type { WorkspaceGroup, WorkspaceLeaf } from "../types";

interface TabContextMenuProps {
  leaf: WorkspaceLeaf;
  group: WorkspaceGroup;
  index: number;
  children: React.ReactNode;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  leaf,
  group,
  index,
  children,
}) => {
  const { closeLeaf, closeLeavesToRight, closeAllLeaves, togglePin, getPinnedCount } =
    useWorkspaceStore();

  const isPinned = leaf.pinned;
  const pinnedCount = getPinnedCount();

  // Hitung tab unpinned di sebelah kanan
  const unpinnedToRight = group.leaves
    .slice(index + 1)
    .filter((l) => !l.pinned);
  const hasUnpinnedToRight = unpinnedToRight.length > 0;

  // Hitung seluruh tab unpinned dalam grup
  const hasUnpinnedInGroup = group.leaves.some((l) => !l.pinned);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeLeaf(leaf.id);
  };

  const handleCloseToRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeLeavesToRight(group.id, leaf.id);
  };

  const handleCloseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeAllLeaves(group.id);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = togglePin(leaf.id);
    if (!result.success) {
      toast.error(result.error || "Maksimal 7 tab yang dapat di-pin.");
    } else {
      toast.success(result.pinned ? "Tab disematkan (pinned)" : "Pin tab dilepas");
    }
  };

  const handleRevealInExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nodeId = leaf.view.nodeId;
    if (!nodeId) {
      toast.info("Tab ini bukan file catatan di explorer.");
      return;
    }

    const nodes = useNodeStore.getState().nodes;
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      toast.error("File catatan tidak ditemukan di explorer.");
      return;
    }

    // 1. Pastikan sidebar terbuka dan tool files aktif
    const ui = useUIStore.getState();
    ui.setActiveTool("files");
    ui.setSidebarOpen(true);

    // 2. Expand seluruh hierarki folder parent menuju file
    ui.revealFolderPath(targetNode.id, nodes as any);

    // 3. Set selected node agar file explorer menyorot elemen
    useNodeStore.getState().setSelectedNode(targetNode);

    // 4. Smooth scroll ke elemen file di explorer
    window.setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${targetNode.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 120);

    toast.success(`Menampilkan "${targetNode.name}" di File Explorer`);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-lg p-1 text-xs select-none z-50">
        {/* 1. Close Tab */}
        <ContextMenuItem
          onClick={handleClose}
          className="cursor-pointer flex items-center gap-2 py-1.5 px-2 hover:bg-accent/70 rounded-md"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Close</span>
        </ContextMenuItem>

        {/* 2. Close to the Right */}
        <ContextMenuItem
          onClick={handleCloseToRight}
          disabled={!hasUnpinnedToRight}
          className="cursor-pointer flex items-center gap-2 py-1.5 px-2 hover:bg-accent/70 rounded-md data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
        >
          <ArrowRightToLine className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Close to the right</span>
        </ContextMenuItem>

        {/* 3. Close All */}
        <ContextMenuItem
          onClick={handleCloseAll}
          disabled={!hasUnpinnedInGroup}
          className="cursor-pointer flex items-center gap-2 py-1.5 px-2 hover:bg-accent/70 rounded-md data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
        >
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Close all</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 bg-border/40" />

        {/* 4. Pin / Unpin Tab */}
        <ContextMenuItem
          onClick={handleTogglePin}
          className="cursor-pointer flex items-center gap-2 py-1.5 px-2 hover:bg-accent/70 rounded-md"
        >
          {isPinned ? (
            <>
              <PinOff className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">Unpin tab</span>
            </>
          ) : (
            <>
              <Pin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Pin tab</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {pinnedCount}/7
              </span>
            </>
          )}
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 bg-border/40" />

        {/* 5. Reveal in Explorer */}
        <ContextMenuItem
          onClick={handleRevealInExplorer}
          disabled={!leaf.view.nodeId}
          className="cursor-pointer flex items-center gap-2 py-1.5 px-2 hover:bg-accent/70 rounded-md data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
        >
          <FolderSearch className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Reveal in explorer</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};