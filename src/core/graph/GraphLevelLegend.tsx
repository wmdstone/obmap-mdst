/**
 * Compact hierarchy-level legend.
 * Pure presentation: receives depths and hierarchy from GraphBottomOverlays.
 */

import {
  resolveLevelColor,
  type HierarchyColorConfig,
} from './model/hierarchyColors';

export interface GraphLevelLegendProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
}

export function GraphLevelLegend({ depths, hierarchy }: GraphLevelLegendProps) {
  if (!hierarchy.enabled || depths.length === 0) return null;

  return (
    <div className="space-y-1 p-2">
      {depths.map((depth) => (
        <div
          key={depth}
          className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-secondary/40"
        >
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
  );
}