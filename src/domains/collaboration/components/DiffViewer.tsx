import React, { useMemo } from "react";
import { cn } from "@/shared/lib";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";

export interface DiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  originalLabel?: string;
  modifiedLabel?: string;
  className?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  lineNumber?: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalContent,
  modifiedContent,
  originalLabel = "Versi Terbit (Basis)",
  modifiedLabel = "Perubahan Terbaru (Draf)",
  className,
}) => {
  // Hitung perbedaan baris demi baris dengan algoritma komputasi diff ringan
  const { originalLines, modifiedLines, stats } = useMemo(() => {
    const orig = (originalContent || "").split("\n");
    const mod = (modifiedContent || "").split("\n");

    const left: DiffLine[] = [];
    const right: DiffLine[] = [];

    const max = Math.max(orig.length, mod.length);
    let additions = 0;
    let deletions = 0;

    for (let i = 0; i < max; i++) {
      const o = orig[i];
      const m = mod[i];

      if (o === undefined) {
        // Baris baru ditambahkan
        left.push({ type: "unchanged", text: "", lineNumber: undefined });
        right.push({ type: "added", text: m, lineNumber: i + 1 });
        additions++;
      } else if (m === undefined) {
        // Baris dihapus
        left.push({ type: "removed", text: o, lineNumber: i + 1 });
        right.push({ type: "unchanged", text: "", lineNumber: undefined });
        deletions++;
      } else if (o !== m) {
        // Baris dimodifikasi (dihitung sebagai hapus di kiri & tambah di kanan)
        left.push({ type: "removed", text: o, lineNumber: i + 1 });
        right.push({ type: "added", text: m, lineNumber: i + 1 });
        deletions++;
        additions++;
      } else {
        // Baris sama
        left.push({ type: "unchanged", text: o, lineNumber: i + 1 });
        right.push({ type: "unchanged", text: m, lineNumber: i + 1 });
      }
    }

    return {
      originalLines: left,
      modifiedLines: right,
      stats: { additions, deletions },
    };
  }, [originalContent, modifiedContent]);

  return (
    <div
      className={cn(
        "flex flex-col border border-border rounded-lg bg-background text-sm font-mono overflow-hidden",
        className
      )}
    >
      {/* Header Statistik Diff */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            Pemeriksaan Perubahan
          </span>
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
            +{stats.additions} Baris
          </Badge>
          <Badge variant="outline" className="text-rose-500 border-rose-500/30">
            -{stats.deletions} Baris
          </Badge>
        </div>
      </div>

      {/* Panel Perbandingan Berdampingan (Side-by-Side Split) */}
      <div className="grid grid-cols-2 divide-x divide-border flex-1 min-h-[300px] max-h-[500px]">
        {/* Kolom Kiri: Versi Asli */}
        <div className="flex flex-col">
          <div className="px-3 py-1.5 text-xs font-semibold bg-muted/60 text-muted-foreground border-b border-border">
            {originalLabel}
          </div>
          <ScrollArea className="flex-1 p-2">
            {originalLines.map((line, idx) => (
              <div
                key={`orig-${idx}`}
                className={cn(
                  "flex items-start gap-2 px-1 py-0.5 rounded leading-relaxed text-xs",
                  line.type === "removed" && "bg-rose-500/15 text-rose-300"
                )}
              >
                <span className="select-none text-muted-foreground/40 w-6 text-right">
                  {line.lineNumber ?? ""}
                </span>
                <span className="whitespace-pre-wrap break-all flex-1">
                  {line.text || "\u00A0"}
                </span>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Kolom Kanan: Versi Modifikasi */}
        <div className="flex flex-col">
          <div className="px-3 py-1.5 text-xs font-semibold bg-muted/60 text-muted-foreground border-b border-border">
            {modifiedLabel}
          </div>
          <ScrollArea className="flex-1 p-2">
            {modifiedLines.map((line, idx) => (
              <div
                key={`mod-${idx}`}
                className={cn(
                  "flex items-start gap-2 px-1 py-0.5 rounded leading-relaxed text-xs",
                  line.type === "added" && "bg-emerald-500/15 text-emerald-300"
                )}
              >
                <span className="select-none text-muted-foreground/40 w-6 text-right">
                  {line.lineNumber ?? ""}
                </span>
                <span className="whitespace-pre-wrap break-all flex-1">
                  {line.text || "\u00A0"}
                </span>
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};