import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Network, Folder, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file";
  parentId: string | null;
  depth: number;
  tags: string[];
}

interface SidebarProps {
  nodes: Node[];
  onNodeSelect: (node: Node) => void;
  selectedNode: Node | null;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
}

export const Sidebar = ({ nodes, onNodeSelect, selectedNode, onNodeMove }: SidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

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
    
    // Only allow dropping on folders
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

    // Can only drop on folders
    if (targetNode.type === "folder" && draggedNode.id !== targetNode.id) {
      // Prevent dropping a parent into its own child
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

  // Build hierarchy tree
  const buildHierarchy = () => {
    const rootNodes = nodes.filter(node => node.parentId === null);
    
    const getChildren = (parentId: string): Node[] => {
      return nodes
        .filter(node => node.parentId === parentId)
        .sort((a, b) => {
          // Folders first, then files
          if (a.type === "folder" && b.type === "file") return -1;
          if (a.type === "file" && b.type === "folder") return 1;
          return a.name.localeCompare(b.name);
        });
    };

    const renderNode = (node: Node): JSX.Element => {
      const children = getChildren(node.id);
      const hasChildren = children.length > 0;
      const isFolder = node.type === "folder";
      const isExpanded = expandedFolders.has(node.id);
      const isDragOver = dragOverNode === node.id;

      return (
        <div key={node.id}>
          <div
            className={cn(
              "relative",
              isDragOver && isFolder && "bg-accent/20 rounded"
            )}
            draggable
            onDragStart={(e) => handleDragStart(node, e)}
            onDragOver={(e) => handleDragOver(node, e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(node, e)}
          >
            <Button
              variant={selectedNode?.id === node.id ? "secondary" : "ghost"}
              className="w-full justify-start text-left mb-1"
              style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
              onClick={() => onNodeSelect(node)}
            >
              {isFolder && hasChildren && (
                <button
                  onClick={(e) => toggleFolder(node.id, e)}
                  className="mr-1 hover:bg-accent/50 rounded p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
              {isFolder && !hasChildren && (
                <span className="w-4 mr-1" />
              )}
              {isFolder ? (
                <Folder className="w-4 h-4 mr-2 shrink-0 text-yellow-500" />
              ) : (
                <FileText className="w-4 h-4 mr-2 shrink-0 text-primary" />
              )}
              <span className="truncate flex-1">{node.name}</span>
              {node.tags.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {node.tags.length}
                </Badge>
              )}
            </Button>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {children.map(child => renderNode(child))}
            </div>
          )}
        </div>
      );
    };

    return rootNodes.map(node => renderNode(node));
  };

  const folderCount = nodes.filter(n => n.type === "folder").length;
  const fileCount = nodes.filter(n => n.type === "file").length;

  return (
    <div className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-sidebar-foreground">Knowledge Graph</h1>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Folder className="w-3 h-3" />
            {folderCount}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {fileCount}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
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
            <div className="text-center py-8 text-muted-foreground text-sm">
              No nodes yet. Create your first folder or file to get started!
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
