// src/domains/editor/components/FootnotePopover.tsx
import React, { useState, useEffect, useRef } from "react";
import { CornerDownLeft, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/global/ui/popover";
import { cn } from "@/global/utils";

export interface FootnotePopoverProps {
  label: string;
  initialText?: string;
  definitionText?: string;
  onSave?: (newText: string) => void;
  onJumpToSection?: () => void;
  onJumpToBottomSection?: (label: string) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerAsChild?: boolean;
  virtualElement?: { getBoundingClientRect: () => DOMRect } | null;
}

export const FootnotePopover: React.FC<FootnotePopoverProps> = ({
  label,
  initialText,
  definitionText,
  onSave,
  onJumpToSection,
  onJumpToBottomSection,
  children,
  open,
  onOpenChange,
  triggerAsChild = true,
  virtualElement,
}) => {
  const effectiveText = initialText ?? definitionText ?? "";
  const [text, setText] = useState(effectiveText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    setText(effectiveText);
  }, [effectiveText]);

  const handleBlur = () => {
    if (text !== effectiveText && onSave) {
      onSave(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave?.(text);
      handleOpenChange(false);
    }
  };

  const handleJump = () => {
    if (onJumpToSection) {
      onJumpToSection();
    } else if (onJumpToBottomSection) {
      onJumpToBottomSection(label);
    }
    handleOpenChange(false);
  };

  const isUrl = /^https?:\/\//i.test(text.trim());

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Virtual Anchor untuk Editing Mode */}
      {virtualElement && (
        <PopoverAnchor virtualRef={{ current: virtualElement as any }} />
      )}

      {/* Trigger untuk Reading Mode */}
      {children && (
        <PopoverTrigger asChild={triggerAsChild}>{children}</PopoverTrigger>
      )}

      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={12}
        sticky="always"
        className={cn(
          "w-[min(240px,calc(100vw-24px))] max-w-[calc(100vw-24px)] box-border",
          "p-2 bg-popover/95 backdrop-blur-md border border-border/60 shadow-xl rounded-lg text-xs space-y-1.5 select-none z-50"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ultra-Compact: Badge + Aksi Kanan (Link & Lompat) */}
        <div className="flex items-center justify-between pb-1 border-b border-border/30">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 leading-none">
            [^{label}]
          </span>
          <div className="flex items-center gap-0.5">
            {isUrl && (
              <a
                href={text.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-muted-foreground/70 hover:text-primary hover:bg-muted/50 transition-colors"
                title="Buka URL sitasi"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={handleJump}
              className="p-1 rounded text-muted-foreground/70 hover:text-primary hover:bg-muted/50 transition-colors"
              title="Lompat ke daftar footnote (↩)"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Input Minimalis (Tinggi Ramping ~42px) */}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Tulis sitasi atau URL..."
            rows={2}
            autoFocus
            className={cn(
              "w-full h-[44px] min-h-[44px] max-h-[68px] px-2 py-1 text-[11.5px] rounded-md",
              "bg-muted/30 focus:bg-background border border-border/40 focus:border-primary/60 outline-none resize-none leading-snug text-foreground transition-all placeholder:text-muted-foreground/40",
              "scrollbar-thin scrollbar-thumb-muted-foreground/20"
            )}
          />
        </div>

        {/* Micro-Hint Footer Satu Baris Ramping */}
        <div className="flex items-center justify-between text-[9.5px] text-muted-foreground/45 px-0.5 pt-0.5">
          <span>Ctrl+↵ simpan</span>
          <span>Auto-save saat blur</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};