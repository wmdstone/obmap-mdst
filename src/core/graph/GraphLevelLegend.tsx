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
  const [open, setOpen] = useState(false); // default collapsed agar hemat ruang
  if (!hierarchy.enabled || depths.length === 0) return null;

  return (
    <div className="pointer-events-auto relative rounded-lg border border-border/80 bg-card/95 shadow-lg backdrop-blur-md">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="h-9 gap-1.5 px-2.5 text-xs font-medium"
      >
        <Layers className="h-4 w-4 text-primary" />
        <span>Levels</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {open && (
        <div className="absolute bottom-11 right-0 max-h-[220px] w-40 space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur-md">
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