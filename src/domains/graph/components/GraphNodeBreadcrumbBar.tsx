import { useMemo } from "react";
import { Folder, FileText, Image, Music, Video } from "lucide-react";
import { cn } from "@/shared/lib";
import { useNodeStore } from "@/domains/graph/shared/stores/useNodeStore";
import { useUIStore } from "@/domains/workspace/stores/useUIStore";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { getBreadcrumbPath } from "@/domains/graph/shared/utils/hierarchyTraversal";

export interface NodeBreadcrumbItem {
  id: string;
  name: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId: string | null;
  mediaType?: "image" | "audio" | "video" | "pdf";
  [key: string]: any;
}

interface NodeBreadcrumbBarProps {
  node: NodeBreadcrumbItem;
  hasChanges?: boolean;
  isSaving?: boolean;
  onBreadcrumbClick?: (target: any) => void;
}

export const getNodeIcon = (node: NodeBreadcrumbItem) => {
  if (node.type === "folder")
    return <Folder className="w-4 h-4 text-yellow-500" />;
  if (node.type === "media") {
    switch (node.mediaType) {
      case "image":
        return <Image className="w-4 h-4 text-emerald-500" />;
      case "audio":
        return <Music className="w-4 h-4 text-violet-500" />;
      case "video":
        return <Video className="w-4 h-4 text-rose-500" />;
    }
  }
  return <FileText className="w-4 h-4 text-primary" />;
};

export const NodeBreadcrumbBar = ({
  node,
  hasChanges = false,
  isSaving = false,
  onBreadcrumbClick,
}: NodeBreadcrumbBarProps) => {

  const breadcrumbNodes = useMemo(() => {
    if (!node) return [];
    return getBreadcrumbPath(node as any, useNodeStore.getState().nodes) as NodeBreadcrumbItem[];
  }, [node]);


  const defaultBreadcrumbClick = (targetNode: NodeBreadcrumbItem) => {
    if (targetNode.type === "folder") {
      useUIStore.getState().setActiveTool("files");
      useNodeStore.getState().setSelectedNode(targetNode as any);
    } else {
      useNodeStore.getState().setSelectedNode(targetNode as any);
      useWorkspaceStore.getState().openFile(targetNode.id, targetNode.name);
    }
  };

  const handleClick = (item: NodeBreadcrumbItem) => {
    if (onBreadcrumbClick) {
      onBreadcrumbClick(item);
    } else {
      defaultBreadcrumbClick(item);
    }
  };

  return (
    <div className="relative flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
      <div className="shrink-0">{getNodeIcon(node)}</div>

      {/* Breadcrumb Path dengan Gradien Pudar Halus */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap py-0.5 pr-8 text-xs font-mono text-muted-foreground scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {breadcrumbNodes.map((item, index) => {
            const isLast = index === breadcrumbNodes.length - 1;

            return (
              <span
                key={item.id}
                className="inline-flex shrink-0 items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() => handleClick(item)}
                  className={cn(
                    "rounded px-1 py-0.5 transition-colors",
                    isLast
                      ? "font-medium text-foreground hover:bg-accent/40"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground hover:underline",
                  )}
                >
                  {item.name}
                </button>

                {!isLast && (
                  <span className="select-none text-muted-foreground/40">/</span>
                )}
              </span>
            );
          })}
        </nav>

        {/* OVERFLOW SHADOW */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/80 to-transparent" />
      </div>

      {hasChanges && (
        <span className="text-xs text-amber-500/80 shrink-0">
          • Unsaved
        </span>
      )}
      {isSaving && (
        <span className="text-xs text-muted-foreground/60 shrink-0">
          Saving...
        </span>
      )}
    </div>
  );
};