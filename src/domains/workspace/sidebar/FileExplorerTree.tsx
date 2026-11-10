import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/global/utils";
import { Badge } from "@/global/ui/badge";
import { ChevronRight, ChevronDown, Folder, FileText, Image, Music, Video } from "lucide-react";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { useNodeStore } from "@/shared/stores";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import { writeNodeToDisk } from "@/domains/vault/persistence/VaultFileWriter";
import { useFolderNavigation } from "@/domains/workspace/hooks/useFolderNavigation";
import { ExplorerContextMenu } from "@/domains/workspace/sidebar/ExplorerContextMenu";
import { getAncestorIdSet, isNodeDescendant } from "@/domains/graph/shared/utils/hierarchyTraversal";
import { useExplorerGraphSyncStore } from "@/domains/graph/shared/stores/useExplorerGraphSyncStore";
import { BulkPublishModal } from "@/domains/collaboration/components/BulkPublishModal";

export interface ExplorerNode {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video" | "pdf";
}

export interface FileExplorerTreeProps {
  nodes: ExplorerNode[];
  selectedNode: ExplorerNode | null;
  onNodeSelect: (node: ExplorerNode) => void;
  onNodeOpen?: (node: ExplorerNode) => void;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onNodeUpdate?: (node: ExplorerNode) => Promise<void> | void;
  currentVaultId: string | null;
  sortBy?: "name" | "type";
}

const INDENT_WIDTH = 16;

// Sesuaikan fungsi getNodeIcon agar menangani node bertipe "pdf" maupun mediaType "pdf":
const getNodeIcon = (node: ExplorerNode) => {
  if (node.type === "folder") {
    return <Folder className="w-4 h-4 shrink-0 text-yellow-500" />;
  }
  // Dukung type === "pdf" langsung atau type === "media" dengan mediaType === "pdf"
  if (node.type === "pdf" || (node.type === "media" && node.mediaType === "pdf")) {
    return <FileText className="w-4 h-4 shrink-0 text-rose-500" />;
  }
  if (node.type === "media") {
    if (node.mediaType === "image") return <Image className="w-4 h-4 shrink-0 text-emerald-500" />;
    if (node.mediaType === "audio") return <Music className="w-4 h-4 shrink-0 text-purple-500" />;
    if (node.mediaType === "video") return <Video className="w-4 h-4 shrink-0 text-red-500" />;
  }
  return <FileText className="w-4 h-4 shrink-0 text-primary" />;
};

export const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeOpen,
  onNodeMove,
  onNodeDelete,
  onNodeUpdate,
  currentVaultId,
  sortBy = "type",
}) => {
  const openFile = useWorkspaceStore((state) => state.openFile);
  const { expandedFolders, toggleFolder, expandFolder, expandAll } = useFolderNavigation();
  const syncMode = useExplorerGraphSyncStore((state) => state.mode);
  const setExplorerHoveredNodeId = useExplorerGraphSyncStore(
    (state) => state.setExplorerHoveredNodeId,
  );
  const clearExplorerHoveredNode = useExplorerGraphSyncStore(
    (state) => state.clearExplorerHoveredNode,
  );
  const requestGraphFocus = useExplorerGraphSyncStore((state) => state.requestFocus);

  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  const hoverSyncEnabled = syncMode === "hover-highlight" || syncMode === "hover-and-focus";

  const focusSyncEnabled = syncMode === "select-focus" || syncMode === "hover-and-focus";

  const [draggedNode, setDraggedNode] = useState<ExplorerNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

  // Lacak rantai leluhur aktif untuk dynamic tree line highlighting
  const selectedPathSet = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return getAncestorIdSet(selectedNode.id, nodes as any, true);
  }, [selectedNode, nodes]);

  // Ref untuk elemen baris aktif dan pelacak node terakhir
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const lastProcessedNodeIdRef = useRef<string | null>(null);

  const [publishingFolder, setPublishingFolder] = useState<ExplorerNode | null>(null);

  // Auto-expand dan scroll hanya saat mode focus aktif.
  // Mode "Selection only" tetap menyinkronkan selected state,
  // tetapi tidak menggerakkan atau membuka Explorer secara otomatis.
  useEffect(() => {
    if (!focusSyncEnabled) {
      lastProcessedNodeIdRef.current = null;
      return;
    }

    const currentId = selectedNode?.id ?? null;

    if (!currentId) {
      lastProcessedNodeIdRef.current = null;
      return;
    }

    // Hindari pekerjaan ulang pada node yang sama agar tidak memicu render loop.
    if (lastProcessedNodeIdRef.current === currentId) {
      return;
    }

    lastProcessedNodeIdRef.current = currentId;

    const ancestorIds = Array.from(getAncestorIdSet(currentId, nodes as ExplorerNode[], false));

    if (ancestorIds.length > 0) {
      expandAll(ancestorIds);
    }

    const scrollTimer = window.setTimeout(() => {
      selectedRowRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);

    return () => window.clearTimeout(scrollTimer);

    // `nodes` sengaja tidak menjadi dependency:
    // rename/update node tidak boleh mengulang scroll/focus.
  }, [selectedNode?.id, focusSyncEnabled, expandAll]);

  // Drag and drop handlers
  const handleDragStart = (node: ExplorerNode, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (node: ExplorerNode, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === "folder" && draggedNode && draggedNode.id !== node.id) {
      setDragOverNode(node.id);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverNode(null);
  };

  const handleDrop = (targetNode: ExplorerNode, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNode(null);

    if (!draggedNode || !onNodeMove) return;

    if (targetNode.type === "folder" && draggedNode.id !== targetNode.id) {
      const isDescendant = isNodeDescendant(targetNode.id, draggedNode.id, nodes as any);

      if (!isDescendant) {
        onNodeMove(draggedNode.id, targetNode.id);
      }
    }

    setDraggedNode(null);
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverNode(null);

    if (draggedNode && onNodeMove) {
      onNodeMove(draggedNode.id, null);
    }

    setDraggedNode(null);
  };

  const handleRename = (node: ExplorerNode, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === node.name) {
      setRenamingNodeId(null);
      return;
    }
    onNodeUpdate?.({ ...node, name: trimmed });
    setRenamingNodeId(null);
  };

  const handleAddNodeUnder = async (targetNode: ExplorerNode, type: "file" | "folder") => {
    let parentId: string | null = null;
    let depth = 0;

    if (targetNode.type === "folder") {
      parentId = targetNode.id;
      depth = targetNode.depth + 1;
      expandFolder(targetNode.id);
    } else {
      parentId = targetNode.parentId;
      depth = targetNode.depth;
    }

    const newNode: ExplorerNode = {
      id: `node-${Date.now()}`,
      name:
        type === "folder"
          ? `New Folder ${nodes.filter((n) => n.type === "folder").length + 1}`
          : `New File ${nodes.filter((n) => n.type === "file").length + 1}`,
      content: "",
      type,
      parentId,
      depth,
      tags: [],
    };

    useNodeStore.getState().addNode(newNode);
    onNodeSelect(newNode);
    if (type === "file") {
      openFile(newNode.id, newNode.name, "tab");
    }

    if (currentVaultId) {
      const vault = getVaultManager().getVault(currentVaultId);
      if (vault) {
        const allNodes = useNodeStore.getState().nodes;
        vault.graphService.setNode(newNode);
        await writeNodeToDisk(vault, allNodes, newNode.id);
        vault.history.addState(allNodes, []);
        await getVaultManager().saveCurrentVault();
      }
    }
  };

  const rootNodes = useMemo(() => nodes.filter((node) => node.parentId === null), [nodes]);

  const getChildren = (parentId: string): ExplorerNode[] => {
    return nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => {
        if (sortBy === "type") {
          if (a.type === "folder" && b.type !== "folder") return -1;
          if (a.type !== "folder" && b.type === "folder") return 1;
        }
        return a.name.localeCompare(b.name);
      });
  };

  const renderNode = (
    node: ExplorerNode,
    level: number = 0,
    isLastChild: boolean = true,
    parentLines: boolean[] = [],
    siblingIndex: number = 0,
    targetSiblingIndex: number = -1,
  ): React.ReactNode => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isFolder = node.type === "folder";
    const isExpanded = expandedFolders.has(node.id);
    const isDragOver = dragOverNode === node.id;
    const isSelected = selectedNode?.id === node.id;

    const activeChildIndex = children.findIndex((child) => selectedPathSet.has(child.id));

    const isTopVerticalActive = targetSiblingIndex !== -1 && siblingIndex <= targetSiblingIndex;
    const isHorizontalActive = targetSiblingIndex !== -1 && siblingIndex === targetSiblingIndex;
    const isBottomVerticalActive = targetSiblingIndex !== -1 && siblingIndex < targetSiblingIndex;

    const connectorLeft = (level - 1) * INDENT_WIDTH + 14;

    return (
      <div key={node.id} className="relative">
        {/* Tree lines HD */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
            {parentLines.map(
              (showLine, idx) =>
                showLine && (
                  <div
                    key={idx}
                    className="absolute w-[1px] bg-border/40"
                    style={{
                      left: `${idx * INDENT_WIDTH + 14}px`,
                      top: 0,
                      bottom: 0,
                    }}
                  />
                ),
            )}

            {/* Segmen Vertikal Atas (0px -> 14px) */}
            <div
              className={cn(
                "absolute w-[1px] transition-colors duration-150",
                isTopVerticalActive
                  ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)] z-10"
                  : "bg-border/40",
              )}
              style={{
                left: `${connectorLeft}px`,
                top: 0,
                height: "14px",
              }}
            />

            {/* Konektor Horizontal ke Node (14px) */}
            <div
              className={cn(
                "absolute h-[1px] transition-colors duration-150",
                isHorizontalActive
                  ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)] z-10"
                  : "bg-border/40",
              )}
              style={{
                left: `${connectorLeft}px`,
                width: hasChildren ? "12px" : "26px",
                top: "14px",
              }}
            />

            {/* Segmen Vertikal Bawah (14px -> 100%) */}
            {!isLastChild && (
              <div
                className={cn(
                  "absolute w-[1px] transition-colors duration-150",
                  isBottomVerticalActive
                    ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)] z-10"
                    : "bg-border/40",
                )}
                style={{
                  left: `${connectorLeft}px`,
                  top: "14px",
                  bottom: 0,
                }}
              />
            )}
          </div>
        )}

        {/* Node Row with Floating Context Menu */}
        <ExplorerContextMenu
          node={node}
          onAddNodeUnder={handleAddNodeUnder}
          onStartRename={(id) => setRenamingNodeId(id)}
          onDeleteNode={onNodeDelete}
          onOpenFile={openFile}
          onPublishFolder={(targetNode) => setPublishingFolder(targetNode as ExplorerNode)}
        >
          <div
            className={cn("relative group", isDragOver && isFolder && "bg-accent/30 rounded-md")}
            draggable
            onDragStart={(e) => handleDragStart(node, e)}
            onDragOver={(e) => handleDragOver(node, e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(node, e)}
          >
            {/* Stem Vertikal dari Chevron Parent ke Anak-anak */}
            {isFolder && hasChildren && isExpanded && (
              <div
                className={cn(
                  "absolute w-[1px] pointer-events-none transition-colors duration-150",
                  activeChildIndex !== -1
                    ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)] z-10"
                    : "bg-border/40",
                )}
                style={{
                  left: `${level * INDENT_WIDTH + 14}px`,
                  top: "20px",
                  bottom: 0,
                }}
              />
            )}

            <div
              ref={(element) => {
                if (element) {
                  itemRefs.current.set(node.id, element);
                } else {
                  itemRefs.current.delete(node.id);
                }
                if (isSelected) selectedRowRef.current = element;
              }}
              onMouseEnter={() => {
                if (hoverSyncEnabled) {
                  setExplorerHoveredNodeId(node.id);
                }
              }}
              onMouseLeave={() => {
                clearExplorerHoveredNode(node.id);
              }}
              onClick={() => {
                onNodeSelect(node);

                if (focusSyncEnabled) {
                  requestGraphFocus(node.id);
                }

                if (isFolder && hasChildren) {
                  toggleFolder(node.id);
                }
              }}
              onDoubleClick={() => {
                onNodeOpen?.(node);
              }}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors cursor-pointer select-none",
                "hover:bg-accent/50",
                isSelected && "bg-accent/20",
              )}
              style={{
                paddingLeft: `${level * INDENT_WIDTH + 8}px`,
              }}
            >
              {/* Slot Chevron 16px (w-4 h-4) */}
              {isFolder && hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(node.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center p-0.5 rounded hover:bg-accent shrink-0 text-muted-foreground hover:text-foreground z-10"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              ) : (
                <span className="w-4 h-4 shrink-0" />
              )}

              {getNodeIcon(node)}

              {/* Inline Renaming or Obsidian Overflow Shadow/Fade Title */}
              {renamingNodeId === node.id ? (
                <input
                  type="text"
                  defaultValue={node.name}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename(node, e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      setRenamingNodeId(null);
                    }
                  }}
                  onBlur={(e) => handleRename(node, e.currentTarget.value)}
                  className="h-5 flex-1 min-w-0 bg-background border border-primary/60 text-xs px-1.5 rounded text-foreground outline-none ring-1 ring-primary/40"
                />
              ) : (
                <div className="relative min-w-0 flex-1 flex items-center overflow-hidden">
                  <span
                    className="truncate flex-1 text-left select-none text-xs leading-5"
                    style={{
                      maskImage:
                        "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
                    }}
                    title={node.name}
                  >
                    {node.name}
                  </span>
                </div>
              )}

              {node.tags.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 ml-auto">
                  {node.tags.length}
                </Badge>
              )}
            </div>
          </div>
        </ExplorerContextMenu>

        {/* Children render */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {children.map((child, idx) =>
              renderNode(
                child,
                level + 1,
                idx === children.length - 1,
                [...parentLines, !isLastChild],
                idx,
                activeChildIndex,
              ),
            )}
          </div>
        )}

        <BulkPublishModal
          open={!!publishingFolder}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPublishingFolder(null);
          }}
          folderNode={publishingFolder}
          allNodes={nodes}
          currentVaultId={currentVaultId}
        />
      </div>
    );
  };

  const rootActiveIndex = rootNodes.findIndex((n) => selectedPathSet.has(n.id));

  return (
    <div
      className="p-2 min-h-full"
      onDragOver={(e) => {
        e.preventDefault();
        if (draggedNode) e.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDropOnRoot}
    >
      {nodes.length > 0 ? (
        rootNodes.map((node, idx) =>
          renderNode(node, 0, idx === rootNodes.length - 1, [], idx, rootActiveIndex),
        )
      ) : (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No files yet. Import or create your first node.
        </div>
      )}
    </div>
  );
};
