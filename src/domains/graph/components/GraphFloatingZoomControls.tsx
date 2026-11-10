import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { Frame, Focus, UnfoldVertical } from 'lucide-react';

export type SmartZoomAction = 'fit' | 'selection' | 'reset';

interface FloatingZoomControlsProps {
  onSmartZoom: (action: SmartZoomAction) => void;
  collapsedCount: number;
  focused: boolean;
  onExpandAll: () => void;
  onClearFocus: () => void;
}

export function FloatingZoomControls({
  onSmartZoom,
  collapsedCount,
  focused,
  onExpandAll,
  onClearFocus,
}: FloatingZoomControlsProps) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-30 flex flex-col items-center gap-1 sm:bottom-4 sm:right-4">
      <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-card/90 p-0.5 shadow-md shadow-black/25 backdrop-blur-md transition-all">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              aria-label="Zoom to fit"
              onClick={() => onSmartZoom('fit')}
            >
              <Frame className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Zoom to fit
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              aria-label="Zoom to selection"
              onClick={() => onSmartZoom('selection')}
            >
              <Focus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Zoom to selection
          </TooltipContent>
        </Tooltip>

        {(collapsedCount > 0 || focused) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-primary border-t border-border/40 pt-0.5 animate-in fade-in zoom-in-90 duration-150"
                aria-label="Show everything"
                onClick={() => {
                  onExpandAll();
                  onClearFocus();
                }}
              >
                <UnfoldVertical className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Show everything ({collapsedCount} collapsed)
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}