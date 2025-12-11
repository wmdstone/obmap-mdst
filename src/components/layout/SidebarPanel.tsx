import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, ChevronRight, ChevronDown, Folder, FileText, FolderOpen, Image, Music, Video } from "lucide-react";
import { ImportExportPanel } from "@/components/layout/ImportExportPanel";
import type { RibbonTool } from "./IconRibbon";

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
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  isVaultMode: boolean;
  vaultName: string | null;
  vaultType?: "in-memory" | "local-folder";
  onCloseVault: () => void;
  graphConfigTrigger: React.ReactNode;
  onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
}

export function SidebarPanel({
  activeTool,
  onClose,
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeMove,
  isVaultMode,
  vaultName,
  onCloseVault,
  graphConfigTrigger,
  onImportComplete,
}: SidebarPanelProps) {
  const navigate = useNavigate();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  const toggleFolder = useCallback((folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const getNodeIcon = (node: Node) => {
    if (node.type === "folder") {
      return <Folder className="w-4 h-4 shrink-0 text-yellow-500" />;
    }
    if (node.type === "media") {
      if (node.mediaType === "image") return <Image className="w-4 h-4 shrink-0 text-green-500" />;
      if (node.mediaType === "audio") return <Music className="w-4 h-4 shrink-0 text-purple-500" />;
      if (node.mediaType === "video") return <Video className="w-4 h-4 shrink-0 text-red-500" />;
    }
    return <FileText className="w-4 h-4 shrink-0 text-primary" />;
  };

  const buildHierarchy = () => {
    const rootNodes = nodes.filter((node) => node.parentId === null);

    const getChildren = (parentId: string): Node[] => {
      return nodes
        .filter((node) => node.parentId === parentId)
        .sort((a, b) => {
          if (a.type === "folder" && b.type === "file") return -1;
          if (a.type === "file" && b.type === "folder") return 1;
          return a.name.localeCompare(b.name);
        });
    };

    const renderNode = (node: Node, level: number = 0): JSX.Element => {
      const children = getChildren(node.id);
      const hasChildren = children.length > 0;
      const isFolder = node.type === "folder";
      const isExpanded = expandedFolders.has(node.id);
      const isDragOver = dragOverNode === node.id;

      return (
        <div key={node.id}>
          <div
            className={cn("relative group", isDragOver && isFolder && "bg-accent/30 rounded-md")}
            draggable
            onDragStart={(e) => handleDragStart(node, e)}
            onDragOver={(e) => handleDragOver(node, e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(node, e)}
          >
            <button
              onClick={() => onNodeSelect(node)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                "hover:bg-accent/50",
                selectedNode?.id === node.id && "bg-accent text-accent-foreground font-medium"
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {isFolder && hasChildren && (
                <button onClick={(e) => toggleFolder(node.id, e)} className="p-0.5 hover:bg-accent rounded">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {isFolder && !hasChildren && <span className="w-4" />}
              {getNodeIcon(node)}
              <span className="truncate flex-1 text-left">{node.name}</span>
              {node.tags.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {node.tags.length}
                </Badge>
              )}
            </button>
          </div>
          {hasChildren && isExpanded && <div>{children.map((child) => renderNode(child, level + 1))}</div>}
        </div>
      );
    };

    return rootNodes.map((node) => renderNode(node, 0));
  };

  const folderCount = nodes.filter((n) => n.type === "folder").length;
  const fileCount = nodes.filter((n) => n.type === "file").length;

  const panelTitles: Record<RibbonTool, string> = {
    files: "File Explorer",
    graph: "Graph Settings",
    "import-export": "Import / Export",
    settings: "Settings",
    account: "Account",
    vaults: "Vault Manager",
  };

  if (!activeTool) return null;

  return (
    <div className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-right">
      {/* Panel Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
        <span className="text-sm font-medium text-sidebar-foreground">{panelTitles[activeTool]}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTool === "files" && (
          <div className="h-full flex flex-col">
            {/* Vault Info */}
            {isVaultMode && (
              <div className="p-3 border-b border-sidebar-border bg-sidebar/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{vaultName}</span>
                  </div>
                  <Button onClick={onCloseVault} variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{folderCount} folders</span>
                  <span>•</span>
                  <span>{fileCount} files</span>
                </div>
              </div>
            )}

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
          </div>
        )}

        {activeTool === "graph" && (
          <div className="p-3">
            <p className="text-xs text-muted-foreground mb-3">Configure graph visualization settings.</p>
            {graphConfigTrigger}
          </div>
        )}

        {activeTool === "import-export" && (
          <div className="p-3">
            <p className="text-xs text-muted-foreground mb-3">Import files or export your vault.</p>
            <ImportExportPanel nodes={nodes} onImportComplete={onImportComplete || (() => {})} />
          </div>
        )}

        {activeTool === "settings" && (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">Application settings coming soon.</p>
          </div>
        )}

        {activeTool === "vaults" && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Manage your vaults and storage.</p>
            <Button onClick={() => navigate("/vaults")} variant="default" size="sm" className="w-full">
              Open Vault Manager
            </Button>
          </div>
        )}

        {activeTool === "account" && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Manage your account and profile.</p>
            <Button onClick={() => navigate("/vaults")} variant="default" size="sm" className="w-full">
              Account Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
