import { useState } from "react";
import { Frame, Focus, UnfoldVertical, Layers, Map, Play, Pause } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/cn";
import { GraphMiniMap, type GraphMiniMapProps } from "./GraphMiniMap";
import { GraphLevelLegend } from "./GraphLevelLegend";
import type { HierarchyColorConfig } from "../model/hierarchyColors";
import { useGraphInteractionStore } from "../model/useGraphInteractionStore";

export interface GraphCanvasUtilityDockProps extends GraphMiniMapProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
  onSmartZoom: (action: "fit" | "selection" | "reset") => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function GraphCanvasUtilityDock({
  depths,
  hierarchy,
  onSmartZoom,
  className,
  orientation = "vertical",
  ...miniMapProps
}: GraphCanvasUtilityDockProps) {
  const [activePopover, setActivePopover] = useState<"levels" | "minimap" | null>(null);

  const collapsedCount = useGraphInteractionStore((s) => s.collapsedIds.length);
  const focused = useGraphInteractionStore((s) => Boolean(s.focusedRootId));
  const expandAll = useGraphInteractionStore((s) => s.expandAll);
  const setFocusedRoot = useGraphInteractionStore((s) => s.setFocusedRoot);
  const isTimeLapseActive = useGraphInteractionStore((s) => s.isTimeLapseActive);
  const toggleTimeLapse = useGraphInteractionStore((s) => s.toggleTimeLapse);

  const showLevels = hierarchy.enabled && depths.length > 0;
  const isVertical = orientation === "vertical";

  const panelWidth = Math.max(180, Math.min(224, miniMapProps.viewportWidth - 32));
  const panelHeight = Math.max(140, Math.min(260, miniMapProps.viewportHeight - 80));

  // Arah tooltip dan popover: jika dock vertikal di kanan atas, buka ke arah kiri (masuk ke canvas)
  const tooltipSide = isVertical ? "left" : "bottom";
  const popoverSide = isVertical ? "left" : "bottom";

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          "pointer-events-auto absolute top-3 right-3 z-30 rounded-lg border border-border/70 bg-card/90 p-1 shadow-lg shadow-black/15 backdrop-blur-md sm:top-4 sm:right-4",
          isVertical ? "flex flex-col items-center gap-1" : "flex items-center gap-1",
          className,
        )}
      >
        {/* 4. HIERARCHY LEVELS POPOVER */}
        {showLevels && (
          <Popover
            open={activePopover === "levels"}
            onOpenChange={(open) => setActivePopover(open ? "levels" : null)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 rounded-md text-muted-foreground hover:text-foreground",
                      activePopover === "levels" && "bg-accent text-accent-foreground",
                    )}
                    aria-label="Hierarchy levels"
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
                Hierarchy levels
              </TooltipContent>
            </Tooltip>

            <PopoverContent
              align={isVertical ? "start" : "end"}
              side={popoverSide}
              sideOffset={8}
              className="w-56 p-2 rounded-lg border-border/80 bg-popover/95 backdrop-blur-md shadow-xl"
            >
              <div className="border-b border-border/40 pb-1.5 px-1 mb-1">
                <p className="text-[11px] font-semibold">Hierarchy Depths</p>
              </div>
              <GraphLevelLegend depths={depths} hierarchy={hierarchy} />
            </PopoverContent>
          </Popover>
        )}

        {/* 5. MINIMAP POPOVER */}
        <Popover
          open={activePopover === "minimap"}
          onOpenChange={(open) => setActivePopover(open ? "minimap" : null)}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-md text-muted-foreground hover:text-foreground",
                    activePopover === "minimap" && "bg-accent text-accent-foreground",
                  )}
                  aria-label="Mini-map"
                >
                  <Map className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
              Mini-map view
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            align={isVertical ? "start" : "end"}
            side={popoverSide}
            sideOffset={8}
            style={{ width: `${panelWidth}px`, height: `${panelHeight}px` }}
            className="p-1 rounded-lg border-border/80 bg-popover/95 backdrop-blur-md shadow-xl overflow-hidden"
          >
            <GraphMiniMap {...miniMapProps} />
          </PopoverContent>
        </Popover>

        {/* 6. TIME-LAPSE PLAYBACK */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md text-muted-foreground hover:text-foreground transition-colors",
                isTimeLapseActive && "text-primary bg-primary/10",
              )}
              aria-label={isTimeLapseActive ? "Pause time-lapse" : "Play time-lapse"}
              onClick={toggleTimeLapse}
            >
              {isTimeLapseActive ? (
                <Pause className="h-3.5 w-3.5 text-primary animate-pulse" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
            {isTimeLapseActive ? "Pause evolution replay" : "Replay vault evolution"}
          </TooltipContent>
        </Tooltip>

          <div className="w-4 h-px border border-t bg-border/60 my-0.5" />

        {/* 1. ZOOM TO FIT */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Zoom to fit"
              onClick={() => onSmartZoom("fit")}
            >
              <Frame className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
            Zoom to fit screen
          </TooltipContent>
        </Tooltip>

        {/* 2. ZOOM TO SELECTION */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Zoom to selection"
              onClick={() => onSmartZoom("selection")}
            >
              <Focus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
            Focus selection
          </TooltipContent>
        </Tooltip>

        {/* 3. SHOW EVERYTHING (EXPAND ALL) */}
        {(collapsedCount > 0 || focused) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-primary animate-in fade-in zoom-in-95 duration-150"
                aria-label="Show everything"
                onClick={() => {
                  expandAll();
                  setFocusedRoot(null);
                }}
              >
                <UnfoldVertical className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} sideOffset={6} className="text-xs">
              Show everything ({collapsedCount} collapsed)
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
