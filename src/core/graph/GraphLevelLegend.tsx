/**
 * Compact hierarchy-level legend, shown on the graph canvas only while
 * hierarchy colouring is active. Icon-only variant for toolbar grouping.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib';
import {
  resolveLevelColor,
  type HierarchyColorConfig,
} from './model/hierarchyColors';

interface GraphLevelLegendProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
}

export function GraphLevelLegend({ depths, hierarchy }: GraphLevelLegendProps) {
  const [open, setOpen] = useState(false);
  if (!hierarchy.enabled || depths.length === 0) return null;

  return (
    <div className="relative">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={open ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setOpen((value) => !value)}
              className={cn(
                "h-8 w-8 shrink-0 rounded-md transition-colors",
                open && "bg-secondary text-primary"
              )}
              aria-label="Toggle Hierarchy Levels Legend"
            >
              <Layers className="h-4 w-4 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Hierarchy Levels</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <div className="absolute bottom-10 right-0 z-50 max-h-[220px] w-40 space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-card/95 p-2 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Active Levels
          </div>
          {depths.map((depth) => (
            <div key={depth} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-secondary/40">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-border/60"
                style={{ backgroundColor: resolveLevelColor(depth, hierarchy) }}
              />
              <span className="truncate text-foreground/80 text-[11px]">
                Level {depth}
                {depth === 0 ? ' (Root)' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}