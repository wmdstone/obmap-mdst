/** Stable toolbar and mutually exclusive, collision-aware graph overlays. */
import { useEffect, useState } from 'react';
import { Layers, Map, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib';
import { GraphMiniMap, type GraphMiniMapProps } from './GraphMiniMap';
import { GraphLevelLegend } from './GraphLevelLegend';
import type { HierarchyColorConfig } from './model/hierarchyColors';

export interface GraphBottomOverlaysProps extends GraphMiniMapProps {
  depths: number[];
  hierarchy: HierarchyColorConfig;
}

export function GraphBottomOverlays({
  depths,
  hierarchy,
  ...miniMapProps
}: GraphBottomOverlaysProps) {
  const [active, setActive] = useState<'levels' | 'minimap' | null>(null);
  const showLevels = hierarchy.enabled && depths.length > 0;

  useEffect(() => {
    if (!showLevels) {
      setActive((value) => (value === 'levels' ? null : value));
    }
  }, [showLevels]);

  const panelWidth = Math.max(180, Math.min(224, miniMapProps.viewportWidth - 24));
  const panelHeight = Math.max(140, Math.min(260, miniMapProps.viewportHeight - 72));
  const label = active === 'levels' ? 'Hierarchy levels' : 'Mini-map';

  return (
    <Popover open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
      {/* Seluruh dock buttons menjadi Anchor Popover */}
      <PopoverAnchor asChild>
        <div
          role="group"
          aria-label="Graph overview controls"
          className="pointer-events-auto absolute bottom-3 right-3 z-30 inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/90 p-0.5 shadow-md shadow-black/25 backdrop-blur-md"
        >
          <TooltipProvider delayDuration={300}>
            {showLevels && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hierarchy levels"
                    onClick={() => setActive((curr) => (curr === 'levels' ? null : 'levels'))}
                    className={cn(
                      'h-7 w-7 shrink-0 rounded-md text-muted-foreground shadow-none touch-manipulation',
                      active === 'levels' && 'bg-secondary text-primary'
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                {active !== 'levels' && (
                  <TooltipContent side="top" className="text-xs">Hierarchy levels</TooltipContent>
                )}
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mini-map"
                  onClick={() => setActive((curr) => (curr === 'minimap' ? null : 'minimap'))}
                  className={cn(
                    'h-7 w-7 shrink-0 rounded-md text-muted-foreground shadow-none touch-manipulation',
                    active === 'minimap' && 'bg-secondary text-primary'
                  )}
                >
                  <Map className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              {active !== 'minimap' && (
                <TooltipContent side="top" className="text-xs">Mini-map</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </PopoverAnchor>

      {/* PopoverContent tunggal yang selalu sejajar rata kanan dengan ujung toolbar dock */}
      {active && (
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label={label}
          style={{ width: panelWidth, maxHeight: panelHeight }}
          className="flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border-border/60 bg-popover/95 p-0 shadow-lg backdrop-blur-md"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-2.5 py-1">
            <span className="text-[11px] font-medium text-foreground/80">{label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Close ${label}`}
              className="h-5 w-5 shrink-0 rounded text-muted-foreground hover:text-foreground shadow-none"
              onClick={() => setActive(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
            {active === 'levels' ? (
              <GraphLevelLegend depths={depths} hierarchy={hierarchy} />
            ) : (
              <GraphMiniMap {...miniMapProps} />
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}