import * as React from 'react';
import { cn } from '@/global/utils/cn';
import { Label } from '@/global/ui/label';
import { Slider } from '@/global/ui/slider-noinput';
import { RotateCcw } from 'lucide-react';

export interface ControlSliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  className?: string;
  disabled?: boolean;
  description?: string;
}

export function ControlSliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  defaultValue,
  unit = '',
  formatValue,
  className,
  disabled = false,
  description,
}: ControlSliderRowProps) {
  const displayValue = formatValue
    ? formatValue(value)
    : `${Number.isInteger(value) ? value : value.toFixed(1)}${unit ? ` ${unit}` : ''}`;

  const isModified = defaultValue !== undefined && Math.abs(value - defaultValue) > 0.0001;

  return (
    <div className={cn('group space-y-1.5 rounded-md transition-colors', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="truncate text-xs font-medium text-foreground/90">
            {label}
          </Label>
          {description && (
            <p className="line-clamp-1 text-[10px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center justify-center rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
            {displayValue}
          </span>
          {defaultValue !== undefined && isModified && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              disabled={disabled}
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none"
              title={`Reset ke ${defaultValue}${unit}`}
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([val]) => onChange(val)}
        className="py-1 cursor-pointer"
      />
    </div>
  );
}