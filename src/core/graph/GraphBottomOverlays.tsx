/** Stable toolbar and mutually exclusive, collision-aware graph overlays. */
import { useEffect, useState } from 'react';
import { Layers, Map, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib';
import { GraphMiniMap, type GraphMiniMapProps } from './GraphMiniMap';
import { GraphLevelLegend } from './GraphLevelLegend';
import type { HierarchyColorConfig } from './model/hierarchyColors';

interface GraphBottomOverlaysProps extends GraphMiniMapProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
}

export function GraphBottomOverlays({ depths, hierarchy, ...miniMapProps }: GraphBottomOverlaysProps) {
  const [active, setActive] = useState<'levels' | 'minimap' | null>(null);
  const showLevels = hierarchy.enabled && depths.length > 0;
  useEffect(() => {
    if (!showLevels) setActive((value) => value === 'levels' ? null : value);
  }, [showLevels]);

  const panelWidth = Math.max(1, Math.min(240, miniMapProps.viewportWidth - 24));
  const panelHeight = Math.max(1, Math.min(280, miniMapProps.viewportHeight - 72));
  const options = showLevels ? (['levels', 'minimap'] as const) : (['minimap'] as const);

  return (
    <div role="group" aria-label="Graph overview controls"
      className="pointer-events-auto absolute bottom-3 right-3 z-30 inline-flex max-w-[calc(100%-24px)] items-center gap-0.5 rounded-md border border-border/60 bg-card/90 p-0.5 backdrop-blur-md">
      <TooltipProvider delayDuration={350}>
        {options.map((option) => {
          const label = option === 'levels' ? 'Hierarchy levels' : 'Mini-map';
          const Icon = option === 'levels' ? Layers : Map;
          const open = active === option;
          return (
            <Popover key={option} open={open} onOpenChange={(value) =>
              setActive((current) => value ? option : current === option ? null : current)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={label}
                      className={cn('h-9 w-9 shrink-0 touch-manipulation rounded-sm text-muted-foreground shadow-none',
                        open && 'bg-secondary text-primary')}>
                      <Icon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                {!open && <TooltipContent side="top">{label}</TooltipContent>}
              </Tooltip>
              <PopoverContent side="top" align="end" sideOffset={8} collisionPadding={12}
                aria-label={label}
                style={{ width: panelWidth, maxHeight: panelHeight }}
                className="flex max-w-[calc(100vw-24px)] flex-col overflow-hidden border-border/60 bg-popover/95 p-0 shadow-none backdrop-blur-md motion-reduce:animate-none">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-1">
                  <span className="min-w-0 truncate text-xs font-medium">{label}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Close ${label}`}
                    className="h-8 w-8 shrink-0 text-muted-foreground shadow-none" onClick={() => setActive(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
                  {option === 'levels'
                    ? <GraphLevelLegend depths={depths} hierarchy={hierarchy} />
                    : <GraphMiniMap {...miniMapProps} />}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </TooltipProvider>
    </div>
  );
}