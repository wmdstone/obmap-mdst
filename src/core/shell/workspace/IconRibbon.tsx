import { cn } from "@/shared/lib";
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  FolderTree,
  GitBranch,
  Network,
  Settings2,
} from "lucide-react";

export type RibbonTool = "files" | "settings";

interface IconRibbonProps {
  activeTool: RibbonTool | null;
  onToolSelect: (tool: RibbonTool) => void;
  onOpenGraph?: () => void;
  onOpenMindmap?: () => void;
  className?: string;
}

export function IconRibbon({ activeTool, onToolSelect, onOpenGraph, onOpenMindmap, className }: IconRibbonProps) {
  return (
    <div
      className={cn(
        "w-12 h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3",
        className
      )}
    >
      {/* Top tools */}
      <div className="flex flex-col items-center gap-1">
        {/* File Explorer */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onToolSelect("files")}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200",
                "hover:bg-accent/50 hover:text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                activeTool === "files" && "text-primary"
              )}
              aria-label="File Explorer"
              aria-pressed={activeTool === "files"}
            >
              <FolderTree className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>File Explorer</span>
            <span className="text-muted-foreground text-xs">⌘1</span>
          </TooltipContent>
        </Tooltip>

        {/* Open Graph Tab (Action Button) */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenGraph}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200",
                "hover:bg-accent/50 hover:text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              aria-label="Open Graph View"
            >
              <Network className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>Open Graph View</span>
            <span className="text-muted-foreground text-xs">⌘⇧G</span>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenMindmap}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200",
                "hover:bg-accent/50 hover:text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              aria-label="Open Mindmap View"
            >
              <GitBranch className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>Open Mindmap View</span>
            <span className="text-muted-foreground text-xs">⌘⇧M</span>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1" />

      {/* Settings at the bottom */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect("settings")}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200",
              "hover:bg-accent/50 hover:text-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              activeTool === "settings" && "text-primary"
            )}
            aria-label="Settings"
            aria-pressed={activeTool === "settings"}
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>Settings</span>
          <span className="text-muted-foreground text-xs">⌘,</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}