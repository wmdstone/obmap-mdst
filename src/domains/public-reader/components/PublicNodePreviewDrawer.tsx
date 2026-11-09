// src/domains/public-reader/components/PublicNodePreviewDrawer.tsx
import React, { useMemo } from "react";
import type { NoteRecord } from "@/types/collaboration";
import type { Node, Link as GraphLink } from "@/shared/stores/types";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  X,
  BookOpen,
  ArrowRight,
  Network,
  Calendar,
  Folder,
  FileText,
  CornerDownRight,
  ExternalLink,
} from "lucide-react";

interface PublicNodePreviewDrawerProps {
  selectedNode: Node | null;
  activeNoteRecord: NoteRecord | null;
  allNotes: NoteRecord[];
  graphLinks: GraphLink[];
  onClose: () => void;
  onNavigateToNode: (slug: string) => void;
  onReadFullArticle: (note: NoteRecord) => void;
}

export const PublicNodePreviewDrawer: React.FC<PublicNodePreviewDrawerProps> = ({
  selectedNode,
  activeNoteRecord,
  allNotes,
  graphLinks,
  onClose,
  onNavigateToNode,
  onReadFullArticle,
}) => {
  if (!selectedNode || !activeNoteRecord) return null;

  const isFolder =
    selectedNode.type === "folder" ||
    (activeNoteRecord.frontmatter as Record<string, any>)?.type === "folder" ||
    (activeNoteRecord.frontmatter as Record<string, any>)?.is_folder === true;

  // Temukan semua relasi yang terhubung ke node ini (Inbound & Outbound)
  const connectedNotes = useMemo(() => {
    const connectedIds = new Set<string>();

    for (const link of graphLinks) {
      const sourceId = typeof link.source === "object" ? (link.source as any).id : link.source;
      const targetId = typeof link.target === "object" ? (link.target as any).id : link.target;

      if (sourceId === selectedNode.id) {
        connectedIds.add(targetId);
      } else if (targetId === selectedNode.id) {
        connectedIds.add(sourceId);
      }
    }

    // Ambil detail NoteRecord untuk setiap node yang terhubung
    return allNotes.filter((note) => connectedIds.has(note.id));
  }, [selectedNode.id, graphLinks, allNotes]);

  // Ekstrak ringkasan isi artikel (Markdown strip singkat ~240 karakter)
  const contentSnippet = useMemo(() => {
    if (!activeNoteRecord.content) return "Tidak ada cuplikan isi catatan.";
    const cleanText = activeNoteRecord.content
      .replace(/#+\s+/g, "") // Hapus heading markdown
      .replace(/\[\[(.*?)\]\]/g, "$1") // Bersihkan wikilink
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Bersihkan url markdown
      .replace(/[*_`~>]/g, "") // Hapus format bold/italic/quote
      .trim();
    return cleanText.length > 280 ? cleanText.slice(0, 280) + "..." : cleanText;
  }, [activeNoteRecord.content]);

  return (
    <div
      className={`absolute z-30 transition-all duration-300 ease-out shadow-2xl border border-border/80 bg-card/95 backdrop-blur-xl flex flex-col overflow-hidden
        /* Mobile: Bottom Sheet Drawer */
        inset-x-2 bottom-2 max-h-[55vh] rounded-2xl md:inset-x-auto
        /* Desktop: Floating Right Glass Panel */
        md:top-4 md:right-4 md:bottom-4 md:w-88 md:max-h-none md:rounded-2xl
      `}
    >
      {/* 1. Header Drawer */}
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-2 shrink-0 bg-muted/20">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            {isFolder ? (
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            <span className="uppercase tracking-wider">{isFolder ? "Folder Hub" : "Dokumen Catatan"}</span>
            <Badge variant="outline" className="text-[9px] h-4 font-mono px-1">
              v{activeNoteRecord.version}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug truncate">
            {activeNoteRecord.title}
          </h3>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Tutup Cuplikan"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs [scrollbar-width:thin]">
        {/* Cuplikan Teks */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Ringkasan Isi
          </span>
          <p className="text-foreground/90 leading-relaxed bg-background/50 p-2.5 rounded-lg border border-border/50 text-xs italic">
            "{contentSnippet}"
          </p>
        </div>

        {/* Tanggal Terbit */}
        {activeNoteRecord.published_at && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Diterbitkan:{" "}
              {new Date(activeNoteRecord.published_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Daftar Catatan Terhubung (Graph Traversal Hub) */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Network className="w-3 h-3 text-primary" />
              <span>Relasi Terhubung ({connectedNotes.length})</span>
            </span>
            <span className="text-[9px] text-muted-foreground/80">Klik untuk selancar</span>
          </div>

          {connectedNotes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/70 italic py-1">
              Belum ada tautan yang terhubung ke dokumen ini.
            </p>
          ) : (
            <div className="space-y-1">
              {connectedNotes.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => onNavigateToNode(conn.slug)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg border border-border/40 bg-background/60 hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerDownRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="truncate text-xs font-medium">{conn.title}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Footer Action Button */}
      <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0 flex items-center gap-2">
        <Button
          onClick={() => onReadFullArticle(activeNoteRecord)}
          className="w-full text-xs h-8 gap-1.5 shadow-sm font-medium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Buka Catatan Lengkap</span>
        </Button>
      </div>
    </div>
  );
};