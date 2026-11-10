import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/global/utils";

interface TableSliderNavProps {
  containerRef: React.RefObject<HTMLDivElement>;
  totalColumns: number;
  className?: string;
}

export const TableSliderNav: React.FC<TableSliderNavProps> = ({
  containerRef,
  totalColumns,
  className,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [visibleColInfo, setVisibleColInfo] = useState("");

  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const isOverflowing = maxScroll > 4;
    setHasOverflow(isOverflowing);

    if (!isOverflowing) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      setScrollProgress(0);
      setVisibleColInfo(`Semua ${totalColumns} Kolom Terlihat`);
      return;
    }

    const currentScroll = el.scrollLeft;
    setCanScrollLeft(currentScroll > 4);
    setCanScrollRight(currentScroll < maxScroll - 4);

    const progress = (currentScroll / maxScroll) * 100;
    setScrollProgress(Math.min(100, Math.max(0, progress)));

    // Perkiraan kolom yang berada di viewport
    if (totalColumns > 0 && el.scrollWidth > 0) {
      const colWidthAvg = el.scrollWidth / totalColumns;
      const startCol = Math.min(totalColumns, Math.floor(currentScroll / colWidthAvg) + 1);
      const endCol = Math.min(
        totalColumns,
        Math.ceil((currentScroll + el.clientWidth) / colWidthAvg)
      );
      setVisibleColInfo(`Kolom ${startCol}–${endCol} dari ${totalColumns}`);
    }
  }, [containerRef, totalColumns]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(el);

    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [containerRef, updateScrollState]);

  const handleScrollBy = (direction: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.55;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const percent = parseFloat(e.target.value);
    el.scrollLeft = (percent / 100) * maxScroll;
  };

  // Jangan tampilkan bar jika tidak meluap ke samping
  if (!hasOverflow) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 border-t border-border/50 text-xs text-muted-foreground select-none rounded-b-lg",
        className
      )}
    >
      {/* Tombol Geser Kiri */}
      <button
        type="button"
        onClick={() => handleScrollBy("left")}
        disabled={!canScrollLeft}
        aria-label="Geser tabel ke kiri"
        className={cn(
          "p-1.5 rounded-md hover:bg-muted/80 transition-colors disabled:opacity-20 disabled:pointer-events-none text-foreground/80 hover:text-foreground"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Slider Bar Horizontal Elegan */}
      <div className="flex-1 flex items-center gap-3 max-w-xs sm:max-w-md mx-auto">
        <input
          type="range"
          min="0"
          max="100"
          value={scrollProgress}
          onChange={handleSliderChange}
          aria-label="Navigasi slider kolom tabel horizontal"
          className="w-full h-1.5 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all focus:outline-none"
        />
      </div>

      {/* Indikator Kolom Aktif */}
      <span className="font-mono text-[11px] font-medium text-foreground/75 whitespace-nowrap bg-background/50 px-2 py-0.5 rounded border border-border/40">
        {visibleColInfo}
      </span>

      {/* Tombol Geser Kanan */}
      <button
        type="button"
        onClick={() => handleScrollBy("right")}
        disabled={!canScrollRight}
        aria-label="Geser tabel ke kanan"
        className={cn(
          "p-1.5 rounded-md hover:bg-muted/80 transition-colors disabled:opacity-20 disabled:pointer-events-none text-foreground/80 hover:text-foreground"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};