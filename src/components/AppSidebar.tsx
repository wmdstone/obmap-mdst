import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Network, 
  Settings2, 
  Database, 
  LayoutGrid, 
  FolderOpen, 
  X,
  PanelLeftClose,
  PanelLeft,
  FileArchive,
  Image,
  Music,
  Video,
} from "lucide-react";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

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

interface AppSidebarProps {
  nodes: Node[];
  onNodeSelect: (node: Node) => void;
  selectedNode: Node | null;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  isVaultMode: boolean;
  vaultName: string | null;
  vaultType?: 'in-memory' | 'local-folder';
  onCloseVault: () => void;
  graphConfigTrigger: React.ReactNode;
  onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
}

export function AppSidebar({
  nodes,
  onNodeSelect,
  selectedNode,
  onNodeMove,
  isVaultMode,
  vaultName,
  vaultType,
  onCloseVault,
  graphConfigTrigger,
  onImportComplete,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [isFilesOpen, setIsFilesOpen] = useState(true);

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

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
        current = nodes.find(n => n.id === current!.parentId);
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

  const buildHierarchy = () => {
    const rootNodes = nodes.filter(node => node.parentId === null);
    
    const getChildren = (parentId: string): Node[] => {
      return nodes
        .filter(node => node.parentId === parentId)
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
      const isMedia = node.type === "media";
      const isExpanded = expandedFolders.has(node.id);
      const isDragOver = dragOverNode === node.id;

      const getNodeIcon = () => {
        if (isFolder) {
          return <Folder className="w-4 h-4 shrink-0 text-yellow-500" />;
        }
        if (isMedia) {
          if (node.mediaType === "image") {
            return <Image className="w-4 h-4 shrink-0 text-green-500" />;
          }
          if (node.mediaType === "audio") {
            return <Music className="w-4 h-4 shrink-0 text-purple-500" />;
          }
          if (node.mediaType === "video") {
            return <Video className="w-4 h-4 shrink-0 text-red-500" />;
          }
        }
        return <FileText className="w-4 h-4 shrink-0 text-primary" />;
      };

      return (
        <div key={node.id}>
          <div
            className={cn(
              "relative group",
              isDragOver && isFolder && "bg-accent/30 rounded-md"
            )}
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
                <button
                  onClick={(e) => toggleFolder(node.id, e)}
                  className="p-0.5 hover:bg-accent rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
              {isFolder && !hasChildren && <span className="w-4" />}
              {getNodeIcon()}
              <span className="truncate flex-1 text-left">{node.name}</span>
              {node.tags.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {node.tags.length}
                </Badge>
              )}
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    return rootNodes.map(node => renderNode(node, 0));
  };

  const folderCount = nodes.filter(n => n.type === "folder").length;
  const fileCount = nodes.filter(n => n.type === "file").length;

  if (isCollapsed) {
    return (
      <div className="w-14 h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="h-8 w-8"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
        <Separator className="w-8" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/vaults")}
          className="h-8 w-8"
          title="Vault Manager"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Files"
        >
          <FileText className="w-4 h-4" />
        </Button>
        <div title="Graph Config">
          {graphConfigTrigger}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sidebar-foreground">Knowledge Graph</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="h-7 w-7"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Vault Section */}
      <div className="p-3 border-b border-sidebar-border bg-sidebar/50">
        {!isVaultMode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
            </div>
            <Button
              onClick={() => navigate("/vaults")}
              variant="default"
              className="w-full"
              size="sm"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Open Vault Manager
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{vaultName}</span>
              </div>
              <Button
                onClick={onCloseVault}
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">Active</Badge>
              <Button
                onClick={() => navigate("/vaults")}
                variant="outline"
                size="sm"
                className="h-7 text-xs flex-1"
              >
                Manage Vaults
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Files Section */}
      <Collapsible open={isFilesOpen} onOpenChange={setIsFilesOpen} className="flex-1 flex flex-col min-h-0">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Files</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {folderCount}F / {fileCount}N
              </span>
              {isFilesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 min-h-0">
          <ScrollArea className="h-full max-h-[calc(100vh-320px)]">
            <div 
              className="p-2"
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedNode) {
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={handleDropOnRoot}
            >
              {nodes.length > 0 ? (
                buildHierarchy()
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No nodes yet. Create your first folder or file!
                </div>
              )}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* Import/Export Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <FileArchive className="w-3.5 h-3.5" />
          <span>Import / Export</span>
        </div>
        <ImportExportPanel 
          nodes={nodes} 
          onImportComplete={onImportComplete || (() => {})} 
        />
      </div>

      {/* Graph Config Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <Settings2 className="w-3.5 h-3.5" />
          <span>Graph Settings</span>
        </div>
        {graphConfigTrigger}
      </div>
    </div>
  );
}
