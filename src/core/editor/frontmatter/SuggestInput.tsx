import { useMemo, useRef, useState } from "react";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib";
import { fuzzyScore } from "@/shared/lib/fuzzy";

interface SuggestInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Called on blur / Enter — used to commit renames or values. */
  onCommit?: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  className?: string;
  limit?: number;
}

/**
 * Text input with an inline suggestion list, mirroring the look and
 * keyboard behaviour of the editor's `[[link]]` / `#tag` suggesters.
 */
export const SuggestInput = ({
  value,
  onChange,
  onCommit,
  suggestions,
  placeholder,
  readOnly,
  type = "text",
  className,
  limit = 8,
}: SuggestInputProps) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => {
    const seen = new Set<string>();
    return suggestions
      .filter((s) => {
        const k = s.toLowerCase();
        if (!s || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((s) => ({ s, score: fuzzyScore(value.trim(), s) }))
      .filter((o) => o.score !== null && o.s !== value)
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, limit)
      .map((o) => o.s);
  }, [suggestions, value, limit]);

  const pick = (next: string) => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setOpen(false);
    onChange(next);
    onCommit?.(next);
  };

  const showList = open && !readOnly && matches.length > 0;

  return (
    <div className="relative w-full min-w-0">
      <Input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[active] ?? value);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setOpen(false);
            onCommit?.(value);
          }, 120);
        }}
        className={cn(
          "h-6 w-full border-none bg-transparent px-2 text-xs shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0",
          className,
        )}
      />

      {showList && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-48 w-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {matches.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "w-full truncate rounded px-2 py-1 text-left text-xs",
                  i === active ? "bg-accent text-accent-foreground" : "",
                )}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
