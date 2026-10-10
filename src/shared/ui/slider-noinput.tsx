/**
 * Slider with an inline numeric input.
 *
 * Drop-in replacement for the plain `Slider`: same props, but it also renders a
 * small number box so any value can be typed directly. Typed values are NOT
 * clamped to the slider's min/max, so settings are not limited by the track.
 */

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/shared/lib";
import { Slider } from "@/shared/ui/slider";
import { Input } from "@/shared/ui/input";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

function decimalsOf(step: number) {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

const SliderNoInput = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps & { inputClassName?: string }
>(({ className, inputClassName, ...props }, ref) => {
  const step = typeof props.step === "number" ? props.step : 1;
  const current = props.value?.[0] ?? props.defaultValue?.[0] ?? 0;
  const [draft, setDraft] = React.useState<string | null>(null);

  const decimals = decimalsOf(step);
  const display =
    draft ?? (Number.isFinite(current) ? String(Number(current.toFixed(decimals))) : "");

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    props.onValueChange?.([parsed]);
    props.onValueCommit?.([parsed]);
  };

  // Widen the track bounds when the stored value sits outside them, so the
  // thumb never looks stuck after a custom number is typed.
  const min = typeof props.min === "number" ? Math.min(props.min, current) : props.min;
  const max = typeof props.max === "number" ? Math.max(props.max, current) : props.max;

  return (
    <div className="flex items-center gap-3">
      <Slider ref={ref} {...props} min={min} max={max} className={cn("flex-1", className)} />
    </div>
  );
});
SliderNoInput.displayName = "SliderNoInput";

export { SliderNoInput, SliderNoInput as Slider };
