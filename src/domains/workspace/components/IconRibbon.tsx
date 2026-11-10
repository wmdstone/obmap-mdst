import { cn } from "@/global/utils";
import { Button } from "@/global/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/global/ui/tooltip";
import { FolderTree, GitBranch, Network, Settings2 } from "lucide-react";

export type RibbonTool = "files" | "vcs" | "settings";

interface IconRibbonProps {
  activeTool: RibbonTool | null;
  onToolSelect: (tool: RibbonTool) => void;
  onOpenGraph?: () => void;
  onOpenMindmap?: () => void;
  className?: string;
}

export function IconRibbon({
  activeTool,
  onToolSelect,
  onOpenGraph,
  onOpenMindmap,
  className,
}: IconRibbonProps) {
  return (
    <div
      className={cn(
        // Modern minimal width w-9 (36px), border tipis, py-2
        "w-9 h-full bg-sidebar/80 backdrop-blur-sm border-r border-sidebar-border flex flex-col items-center py-2 shrink-0 select-none",
        className,
      )}
    >
      {/* Top tools */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {/* File Explorer */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onToolSelect("files")}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring",
            activeTool === "files" && "bg-sidebar-accent text-primary font-medium shadow-xs",
          )}
          aria-label="File Explorer"
          aria-pressed={activeTool === "files"}
        >
          <FolderTree className="w-3.5 h-3.5" />
        </Button>

        {/* Version Control System (VCS Panel) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onToolSelect("vcs")}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring",
            activeTool === "vcs" && "bg-sidebar-accent text-primary font-medium shadow-xs",
          )}
          aria-label="Version Control"
          aria-pressed={activeTool === "vcs"}
        >
          <GitBranch className="w-3.5 h-3.5" />
        </Button>

        {/* Open Graph Tab */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenGraph}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label="Open Graph View"
        >
          <Network className="w-3.5 h-3.5" />
        </Button>

        {/* Open Mindmap Tab */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMindmap}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label="Open Mindmap View"
        >
          <GitBranch className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1" />

      {/* Settings at the bottom */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onToolSelect("settings")}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring",
            activeTool === "settings" && "bg-sidebar-accent text-primary font-medium shadow-xs",
          )}
          aria-label="Settings"
          aria-pressed={activeTool === "settings"}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
