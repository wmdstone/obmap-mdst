import { useState, useCallback, useRef, useEffect } from "react";
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
import type { RibbonTool } from "./IconRibbon";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

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
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;

export function SidebarPanel({
  activeTool,
  onClose,
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeOpen,
  onNodeMove,
  onAddNode,
  isVaultMode,
  vaultName,
  currentVaultId,
  availableVaults,
  onSwitchVault,
  onCloseVault,
  onImportComplete,
}: SidebarPanelProps) {
  const openView = useWorkspaceStore((state) => state.openView);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSettingsGroups, setExpandedSettingsGroups] = useState<
    Set<string>
  >(() => new Set(SETTINGS_GROUPS));
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("account");
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "type">("type");
  const panelRef = useRef<HTMLDivElement>(null);

  const selectSettingsSection = (section: SettingsSectionId, label: string) => {
    setActiveSettingsSection(section);
    openView({ type: "settings", title: label, settingsSection: section });
  };

  const toggleFolder = useCallback((folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

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
    ): JSX.Element => {
      const children = getChildren(node.id);
      const hasChildren = children.length > 0;
      const isFolder = node.type === "folder";
      const isExpanded = expandedFolders.has(node.id);
      const isDragOver = dragOverNode === node.id;

      return (
        <div key={node.id} className="relative">
          {/* Tree lines */}
          {level > 0 && (
            <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
              {parentLines.map(
                (showLine, idx) =>
                  showLine && (
                    <div
                      key={idx}
                      className="absolute w-px bg-gradient-to-b from-border/60 to-border/20"
                      style={{
                        left: `${idx * 12 + 12}px`,
                        top: 0,
                        bottom: 0,
                      }}
                    />
                  ),
              )}
              {/* Horizontal connector */}
              <div
                className="absolute h-px bg-gradient-to-r from-border/60 to-border/30"
                style={{
                  left: `${(level - 1) * 12 + 12}px`,
                  width: "10px",
                  top: "14px",
                }}
              />
              {/* Vertical connector to this node */}
              <div
                className={cn(
                  "absolute w-px bg-gradient-to-b from-border/60 to-border/20",
                  isLastChild && "to-transparent",
                )}
                style={{
                  left: `${(level - 1) * 12 + 12}px`,
                  top: 0,
                  height: isLastChild ? "14px" : "100%",
                }}
              />
            </div>
          )}

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
            <div
              onClick={() => {
                onNodeSelect(node);
                if (isFolder && hasChildren) toggleFolder(node.id);
              }}
              onDoubleClick={() => {
                if (!isFolder) onNodeOpen?.(node);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors cursor-pointer select-none",
                "hover:bg-accent/50",
                selectedNode?.id === node.id &&
                  "bg-accent text-accent-foreground font-medium",
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {isFolder && hasChildren && (
                <span className="p-0.5 rounded">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </span>
              )}
              {isFolder && !hasChildren && <span className="w-4" />}
              {getNodeIcon(node)}
              <span className="truncate flex-1 text-left">{node.name}</span>
              {node.tags.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {node.tags.length}
                </Badge>
              )}
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="relative">
              {children.map((child, idx) =>
                renderNode(child, level + 1, idx === children.length - 1, [
                  ...parentLines,
                  !isLastChild,
                ]),
              )}
            </div>
          )}
        </div>
      );
    };

    return rootNodes.map((node, idx) =>
      renderNode(node, 0, idx === rootNodes.length - 1, []),
    );
  };

  const folderCount = nodes.filter((n) => n.type === "folder").length;
  const fileCount = nodes.filter((n) => n.type === "file").length;

  const expandAll = () => {
    const allFolderIds = nodes
      .filter((n) => n.type === "folder")
      .map((n) => n.id);
    setExpandedFolders(new Set(allFolderIds));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
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
        "animate-in slide-in-from-left-2 duration-200 ease-out",
      )}
      style={{ width: `${width}px` }}
    >
      {/* Panel Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
        <span className="text-sm font-medium text-sidebar-foreground">
          {panelTitles[activeTool]}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Sort"
                  >
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
                className="p-2"
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
    </div>
  );
}
