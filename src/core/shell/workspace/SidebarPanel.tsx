import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  X,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Cloud,
  Folder,
  FileText,
  FolderOpen,
  Image,
  Music,
  Video,
  GripVertical,
  FolderPlus,
  FilePlus,
  SortAsc,
  Columns2,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/core/shell/settings/settingsNavigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";
import type { RibbonTool } from "./IconRibbon";
import { useWorkspaceStore } from "./store/useWorkspaceStore";
import { useUIStore, useNodeStore } from "@/shared/stores";
import { getVaultManager } from "@/core/system/vault/VaultManagerSingleton";
import { writeNodeToDisk } from "@/core/system/persistence/VaultFileWriter";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video";
}

interface SidebarPanelProps {
  activeTool: RibbonTool | null;
  onClose: () => void;
  nodes: Node[];
  selectedNode: Node | null;
  onNodeSelect: (node: Node) => void;
  onNodeOpen?: (node: Node) => void;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onNodeUpdate?: (node: Node) => Promise<void> | void;
  onAddNode?: (type: "folder" | "file") => void;
  isVaultMode: boolean;
  vaultName: string | null;
  vaultLocation?: "folder" | "cloud";
  currentVaultId: string | null;
  availableVaults: Array<{
    id: string;
    name: string;
    location: "folder" | "cloud";
    nodeCount: number;
  }>;
  onSwitchVault: (vaultId: string) => void;
  onCloseVault: () => void;
  graphConfigTrigger?: React.ReactNode;
  onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 450;
const DEFAULT_WIDTH = 260;

export function SidebarPanel({
  activeTool,
  onClose,
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeOpen,
  onNodeMove,
  onNodeDelete,
  onNodeUpdate,
  onAddNode,
  isVaultMode,
  vaultName,
  currentVaultId,
  availableVaults,
  onSwitchVault,
}: SidebarPanelProps) {
  const openView = useWorkspaceStore((state) => state.openView);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const expandedFolderIds = useUIStore((state) => state.expandedFolderIds);
  const setExpandedFolderIds = useUIStore((state) => state.setExpandedFolderIds);
  const expandedFolders = new Set(expandedFolderIds);

  const [expandedSettingsGroups, setExpandedSettingsGroups] = useState<Set<string>>(
    () => new Set(SETTINGS_GROUPS),
  );
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("account");
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "type">("type");
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectSettingsSection = (section: SettingsSectionId, label: string) => {
    setActiveSettingsSection(section);
    openView({ type: "settings", title: label, settingsSection: section });
  };

  const toggleFolder = useCallback(
    (folderId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setExpandedFolderIds(
        expandedFolders.has(folderId)
          ? expandedFolderIds.filter((id) => id !== folderId)
          : [...expandedFolderIds, folderId],
      );
    },
    [expandedFolderIds, expandedFolders, setExpandedFolderIds],
  );

  const handleDragStart = (node: Node, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (node: Node, e: React.DragEvent) => {
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

  const handleDrop = (targetNode: Node, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNode(null);

    if (!draggedNode || !onNodeMove) return;

    if (targetNode.type === "folder" && draggedNode.id !== targetNode.id) {
      let current: Node | undefined = targetNode;
      let isDescendant = false;

      while (current && current.parentId) {
        if (current.parentId === draggedNode.id) {
          isDescendant = true;
          break;
        }
        current = nodes.find((n) => n.id === current!.parentId);
      }

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

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      const panelRect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - panelRect.left;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  const getNodeIcon = (node: Node) => {
    if (node.type === "folder") {
      return <Folder className="w-4 h-4 shrink-0 text-yellow-500" />;
    }
    if (node.type === "media") {
      if (node.mediaType === "image")
        return <Image className="w-4 h-4 shrink-0 text-green-500" />;
      if (node.mediaType === "audio")
        return <Music className="w-4 h-4 shrink-0 text-purple-500" />;
      if (node.mediaType === "video")
        return <Video className="w-4 h-4 shrink-0 text-red-500" />;
    }
    return <FileText className="w-4 h-4 shrink-0 text-primary" />;
  };

  const INDENT_WIDTH = 16;

  // Lacak rantai leluhur aktif untuk dynamic tree line highlighting
  const selectedPathSet = useMemo(() => {
    const pathSet = new Set<string>();
    if (!selectedNode) return pathSet;

    pathSet.add(selectedNode.id);
    let current = nodes.find((n) => n.id === selectedNode.id);
    while (current && current.parentId) {
      pathSet.add(current.parentId);
      current = nodes.find((n) => n.id === current?.parentId);
    }
    return pathSet;
  }, [selectedNode, nodes]);

  // Handler Context Menu Actions
  const handleAddNodeUnder = async (targetNode: Node, type: "file" | "folder") => {
    let parentId: string | null = null;
    let depth = 0;

    if (targetNode.type === "folder") {
      parentId = targetNode.id;
      depth = targetNode.depth + 1;
      if (!expandedFolders.has(targetNode.id)) {
        setExpandedFolderIds([...expandedFolderIds, targetNode.id]);
      }
    } else {
      parentId = targetNode.parentId;
      depth = targetNode.depth;
    }

    const newNode: Node = {
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

  const handleRename = (node: Node, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === node.name) {
      setRenamingNodeId(null);
      return;
    }
    onNodeUpdate?.({ ...node, name: trimmed });
    setRenamingNodeId(null);
  };

  const buildHierarchy = () => {
    const rootNodes = nodes.filter((node) => node.parentId === null);

    const getChildren = (parentId: string): Node[] => {
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
      node: Node,
      level: number = 0,
      isLastChild: boolean = true,
      parentLines: boolean[] = [],
      siblingIndex: number = 0,
      targetSiblingIndex: number = -1,
    ): JSX.Element => {
      const children = getChildren(node.id);
      const hasChildren = children.length > 0;
      const isFolder = node.type === "folder";
      const isExpanded = expandedFolders.has(node.id);
      const isDragOver = dragOverNode === node.id;
      const isSelected = selectedNode?.id === node.id;

      const activeChildIndex = children.findIndex((child) =>
        selectedPathSet.has(child.id),
      );

      const isTopVerticalActive =
        targetSiblingIndex !== -1 && siblingIndex <= targetSiblingIndex;
      const isHorizontalActive =
        targetSiblingIndex !== -1 && siblingIndex === targetSiblingIndex;
      const isBottomVerticalActive =
        targetSiblingIndex !== -1 && siblingIndex < targetSiblingIndex;

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
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className={cn(
                  "relative group",
                  isDragOver && isFolder && "bg-accent/30 rounded-md",
                )}
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
                  onClick={() => {
                    onNodeSelect(node);
                    if (isFolder && hasChildren) toggleFolder(node.id);
                  }}
                  onDoubleClick={() => {
                    if (!isFolder) onNodeOpen?.(node);
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
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4 shrink-0 ml-auto"
                    >
                      {node.tags.length}
                    </Badge>
                  )}
                </div>
              </div>
            </ContextMenuTrigger>

            {/* Floating Context Menu - Obsidian Style */}
            <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-lg p-1 text-xs select-none z-50">
              {!isFolder && (
                <>
                  <ContextMenuItem
                    onClick={() => openFile(node.id, node.name, "tab")}
                    className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Open in new tab</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => openFile(node.id, node.name, "split-horizontal")}
                    className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
                  >
                    <Columns2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Open to the right (split)</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator className="my-1 bg-border/40" />
                </>
              )}

              <ContextMenuItem
                onClick={() => handleAddNodeUnder(node, "file")}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
              >
                <FilePlus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isFolder ? "New note in folder" : "New note"}</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => handleAddNodeUnder(node, "folder")}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
              >
                <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isFolder ? "New subfolder" : "New folder"}</span>
              </ContextMenuItem>

              <ContextMenuSeparator className="my-1 bg-border/40" />

              <ContextMenuItem
                onClick={() => setRenamingNodeId(node.id)}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rename...</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => onNodeDelete?.(node.id)}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                <span>Delete</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

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
        </div>
      );
    };

    // Render Root
    const rootActiveIndex = rootNodes.findIndex((n) => selectedPathSet.has(n.id));
    return rootNodes.map((node, idx) =>
      renderNode(node, 0, idx === rootNodes.length - 1, [], idx, rootActiveIndex),
    );
  };

  const folderCount = nodes.filter((n) => n.type === "folder").length;
  const fileCount = nodes.filter((n) => n.type === "file").length;

  const expandAll = () => {
    setExpandedFolderIds(
      nodes.filter((node) => node.type === "folder").map((node) => node.id),
    );
  };

  const collapseAll = () => {
    setExpandedFolderIds([]);
  };

  const panelTitles: Record<RibbonTool, string> = {
    files: "File Explorer",
    settings: "Settings",
  };

  if (!activeTool) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full bg-sidebar border-r border-sidebar-border flex flex-col relative",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl max-md:w-[280px] max-md:max-w-[85vw]",
        "animate-in slide-in-from-left-2 duration-200 ease-out",
      )}
      style={{ width: window.innerWidth < 768 ? undefined : `${width}px` }}
    >
      {/* Panel Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
        <span className="text-sm font-medium text-sidebar-foreground">
          {panelTitles[activeTool]}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTool === "files" && (
          <div className="h-full flex flex-col">
            {/* File Explorer Toolbar */}
            <div className="p-2 border-b border-sidebar-border flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddNode?.("folder")}
                title="Add Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddNode?.("file")}
                title="Add File"
              >
                <FilePlus className="w-4 h-4" />
              </Button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Sort">
                    <SortAsc className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("name")}>
                    Sort by Name {sortBy === "name" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("type")}>
                    Sort by Type {sortBy === "type" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={expandedFolders.size > 0 ? collapseAll : expandAll}
                title={expandedFolders.size > 0 ? "Collapse All" : "Expand All"}
              >
                <ChevronsUpDown className="w-4 h-4" />
              </Button>
            </div>

            {/* File Tree */}
            <ScrollArea className="flex-1">
              <div
                className="p-2 min-h-full"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedNode) e.dataTransfer.dropEffect = "move";
                }}
                onDrop={handleDropOnRoot}
              >
                {nodes.length > 0 ? (
                  buildHierarchy()
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No files yet. Import or create your first node.
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Vault Info */}
            {isVaultMode && (
              <div className="p-3 border-t border-sidebar-border bg-sidebar/50 shrink-0">
                <div className="flex items-center justify-between gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 min-w-0 flex-1 justify-start gap-2 px-1.5"
                        aria-label="Switch vault"
                      >
                        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">
                          {vaultName}
                        </span>
                        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-48"
                    >
                      {availableVaults.map((vault) => {
                        const VaultIcon =
                          vault.location === "folder" ? FolderOpen : Cloud;
                        const active = vault.id === currentVaultId;
                        return (
                          <DropdownMenuItem
                            key={vault.id}
                            onSelect={() => onSwitchVault(vault.id)}
                            className="gap-2 py-2"
                          >
                            <VaultIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {vault.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {vault.nodeCount}{" "}
                                {vault.nodeCount === 1 ? "item" : "items"}
                              </p>
                            </div>
                            {active && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{folderCount} folders</span>
                  <span>•</span>
                  <span>{fileCount} files</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === "settings" && (
          <ScrollArea className="h-full">
            <nav className="space-y-1 p-2" aria-label="Settings sections">
              {SETTINGS_GROUPS.map((group) => {
                const isOpen = expandedSettingsGroups.has(group);
                const sections = SETTINGS_SECTIONS.filter(
                  (section) => section.group === group,
                );

                return (
                  <Collapsible
                    key={group}
                    open={isOpen}
                    onOpenChange={(open) => {
                      setExpandedSettingsGroups((current) => {
                        const next = new Set(current);
                        if (open) next.add(group);
                        else next.delete(group);
                        return next;
                      });
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-full justify-start gap-2 px-2 text-xs font-semibold text-sidebar-foreground"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                        <span className="truncate">{group}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pb-1 pl-3">
                      {sections.map((section) => (
                        <Button
                          key={section.id}
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            selectSettingsSection(section.id, section.label)
                          }
                          className={cn(
                            "h-8 w-full justify-start gap-2 px-2 text-xs font-normal",
                            activeSettingsSection === section.id &&
                            "bg-sidebar-accent text-sidebar-accent-foreground",
                          )}
                        >
                          <section.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{section.label}</span>
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </nav>
          </ScrollArea>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-1 h-full cursor-col-resize group",
          "hover:bg-primary/50 transition-colors",
          isResizing && "bg-primary/50",
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs z-[-1] md:hidden"
        onClick={onClose}
      />
    </div>
  );
}