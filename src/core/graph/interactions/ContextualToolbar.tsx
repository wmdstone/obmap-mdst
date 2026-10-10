import { useState } from "react";
import { 
  GitBranch, 
  Plus, 
  Focus, 
  Trash2, 
  Settings2,
  X
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { MindmapLayoutMode, CanvasMode } from "../model/graphTypes";

const MINDMAP_STRUCTURES: { mode: MindmapLayoutMode; label: string }[] = [
  { mode: "mindmap", label: "Mindmap (Balanced)" },
  { mode: "org-chart", label: "Org Chart (Top-Down)" },
  { mode: "brace-map", label: "Brace Map (Left-Right)" },
  { mode: "fishbone", label: "Fishbone (Cause-Effect)" },
  { mode: "timeline", label: "Timeline (Sequential)" },
];

interface ContextualToolbarProps {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  isFolder: boolean;
  canvasMode?: CanvasMode;
  currentOverride?: MindmapLayoutMode;
  isFocused: boolean;
  onSetStructure: (layout: MindmapLayoutMode | null) => void;
  onAddSub: (type: "file" | "folder") => void;
  onToggleFocus: () => void;
  onDelete: () => void;
  onClose?: () => void;
}

export function ContextualToolbar({
  x,
  y,
  canvasMode = "mindmap",
  currentOverride,
  isFocused,
  onSetStructure,
  onAddSub,
  onToggleFocus,
  onDelete,
  onClose,
}: ContextualToolbarProps) {
  // Default expanded saat dibuka melalui klik kanan / double tap
  const [isExpanded, setIsExpanded] = useState(true);
  const toolbarWidth = isExpanded ? (canvasMode === "graph" ? 144 : 180) : 36;
  
  // Clamping koordinat toolbar agar tidak terpotong tepi layar
  const clampedX = typeof window !== "undefined"
    ? Math.max(toolbarWidth / 2 + 12, Math.min(window.innerWidth - toolbarWidth / 2 - 12, x))
    : x;

  const clampedY = typeof window !== "undefined"
    ? Math.max(50, Math.min(window.innerHeight - 20, y - 18))
    : y - 18;

  const handleToggle = () => {
    if (isExpanded && onClose) {
      onClose();
    } else {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div
      className="absolute z-50 flex items-center gap-1 p-1 bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-full select-none pointer-events-auto transition-all duration-200 ease-out"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: "translate(-50%, -100%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {/* 1. Toggle / Close Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 rounded-full p-0 transition-transform duration-200 ${
          isExpanded ? "bg-accent/70 rotate-90 text-primary" : "hover:bg-accent/50 text-muted-foreground"
        }`}
        onClick={handleToggle}
        title={isExpanded ? "Close Actions" : "Node Actions"}
      >
        {isExpanded ? <X className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
      </Button>

      {/* 2. Expanded Options Bar */}
      {isExpanded && (
        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Structure Override Dropdown (HANYA tampil di Mindmap View, tanpa multi/mix layout di Graph View) */}
          {canvasMode === "mindmap" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded-full p-0 hover:bg-accent/50 text-foreground"
                  title="Change Subtree Structure"
                >
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 text-xs">
                <DropdownMenuLabel>Subtree Layout</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MINDMAP_STRUCTURES.map((s) => (
                  <DropdownMenuItem
                    key={s.mode}
                    onClick={() => onSetStructure(s.mode)}
                    className={`cursor-pointer ${
                      currentOverride === s.mode ? "font-semibold text-primary" : ""
                    }`}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
                {currentOverride && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onSetStructure(null)}
                      className="text-muted-foreground cursor-pointer"
                    >
                      Reset to Default
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add Sub Dropdown (Sub-note & Sub-folder) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-full p-0 hover:bg-accent/50 text-foreground"
                title="Add Child Node"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 text-xs">
              <DropdownMenuItem
                onClick={() => onAddSub("file")}
                className="cursor-pointer"
              >
                Sub-note
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAddSub("folder")}
                className="cursor-pointer"
              >
                Sub-folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Focus Subtree */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 rounded-full p-0 hover:bg-accent/50 ${
              isFocused ? "text-primary bg-primary/10" : "text-muted-foreground"
            }`}
            onClick={onToggleFocus}
            title={isFocused ? "Unfocus (Show All)" : "Focus Subtree"}
          >
            <Focus className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Delete Node */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 rounded-full p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete Node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}