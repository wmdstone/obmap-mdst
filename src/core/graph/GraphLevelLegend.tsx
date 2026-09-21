/**
 * Compact hierarchy-level legend, shown on the graph canvas only while
 * hierarchy colouring is active. Levels come from the projected graph, so
 * loop/gradient overflow levels appear exactly as they are painted.
 */

import { useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  resolveLevelColor,
  type HierarchyColorConfig,
} from './model/hierarchyColors';

interface GraphLevelLegendProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
}

export function GraphLevelLegend({ depths, hierarchy }: GraphLevelLegendProps) {
  const [open, setOpen] = useState(true);
  if (!hierarchy.enabled || depths.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-10 max-w-[45vw] rounded-lg border border-border bg-card/90 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="h-8 w-full justify-start gap-1.5 px-2 text-xs font-medium"
      >
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span>Levels</span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </Button>

      {open && (
        <div className="max-h-[40vh] space-y-1 overflow-y-auto px-2 pb-2">
          {depths.map((depth) => (
            <div key={depth} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-sm border border-border/60"
                style={{ backgroundColor: resolveLevelColor(depth, hierarchy) }}
              />
              <span className="truncate text-muted-foreground">
                Level {depth}
                {depth === 0 ? ' · Root' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
