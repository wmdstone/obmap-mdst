import * as React from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { RotateCcw, type LucideIcon } from 'lucide-react';

export interface SectionHeaderWithResetProps {
  title: string;
  icon?: LucideIcon;
  badge?: string | number;
  description?: string;
  onReset?: () => void;
  resetTooltip?: string;
  className?: string;
  children?: React.ReactNode;
}

export function SectionHeaderWithReset({
  title,
  icon: Icon,
  badge,
  description,
  onReset,
  resetTooltip = 'Reset ke nilai default',
  className,
  children,
}: SectionHeaderWithResetProps) {
  return (
    <div className={cn('flex items-start justify-between gap-2 border-b border-border/40 pb-2', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-primary shrink-0" />}
          <h4 className="truncate text-xs font-semibold tracking-tight text-foreground">
            {title}
          </h4>
          {badge !== undefined && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {children}
        {onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title={resetTooltip}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}