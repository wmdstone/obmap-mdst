// src/domains/public-reader/components/PublicFolderOverview.tsx
import React, { useState, useMemo } from "react";
import type { NoteRecord } from "@/types/collaboration";
import { Folder, FolderOpen, FileText, Search, Layers, Calendar, ArrowRight } from "lucide-react";
import { Input } from "@/global/ui/input";
import { Badge } from "@/global/ui/badge";

interface PublicFolderOverviewProps {
  folderNote: NoteRecord;
  allNotes: NoteRecord[];
  onSelectNode: (note: NoteRecord) => void;
}

export const PublicFolderOverview: React.FC<PublicFolderOverviewProps> = ({
  folderNote,
  allNotes,
  onSelectNode,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const folderFm = (folderNote.frontmatter as Record<string, any>) || {};
  const currentLocalId = folderFm.local_node_id || folderNote.id;

  // Dapatkan semua anak langsung dari folder ini
  const childNodes = useMemo(() => {
    return allNotes.filter((n) => {
      const fm = (n.frontmatter as Record<string, any>) || {};
      return fm.parentId === currentLocalId || fm.parentId === folderNote.id;
    });
  }, [allNotes, currentLocalId, folderNote.id]);

  // Pisahkan subfolder dan catatan
  const { subfolders, fileNotes } = useMemo(() => {
    const folders: NoteRecord[] = [];
    const files: NoteRecord[] = [];

    for (const child of childNodes) {
      const fm = (child.frontmatter as Record<string, any>) || {};
      const isFolder = fm.type === "folder" || fm.is_folder === true;
      if (isFolder) folders.push(child);
      else files.push(child);
    }

    folders.sort((a, b) => a.title.localeCompare(b.title));
    files.sort((a, b) => a.title.localeCompare(b.title));

    return { subfolders: folders, fileNotes: files };
  }, [childNodes]);

  // Filter pencarian
  const filteredSubfolders = useMemo(() => {
    if (!searchQuery.trim()) return subfolders;
    const q = searchQuery.toLowerCase();
    return subfolders.filter((f) => f.title.toLowerCase().includes(q));
  }, [subfolders, searchQuery]);

  const filteredFileNotes = useMemo(() => {
    if (!searchQuery.trim()) return fileNotes;
    const q = searchQuery.toLowerCase();
    return fileNotes.filter((f) => f.title.toLowerCase().includes(q));
  }, [fileNotes, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Folder Header Banner */}
      <div className="p-5 md:p-6 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <FolderOpen className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
              {folderNote.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Direktori publik • Menampilkan catatan dan subfolder terbit
            </p>
          </div>
        </div>

        {/* Badges Ringkasan */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
          <Badge variant="outline" className="gap-1.5 font-medium bg-background/50">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Total {childNodes.length} Item
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-medium bg-background/50">
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            {subfolders.length} Subfolder
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-medium bg-background/50">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            {fileNotes.length} Catatan
          </Badge>
        </div>
      </div>

      {/* Filter Pencarian Internal Folder */}
      {childNodes.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Cari di dalam folder ${folderNote.title}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card"
          />
        </div>
      )}

      {/* Bagian Subfolder (Bila Ada) */}
      {filteredSubfolders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            Subfolder ({filteredSubfolders.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredSubfolders.map((sub) => {
              // Hitung jumlah item di dalam subfolder ini
              const subLocalId = (sub.frontmatter as any)?.local_node_id || sub.id;
              const subItemsCount = allNotes.filter(
                (n) => (n.frontmatter as any)?.parentId === subLocalId
              ).length;

              return (
                <div
                  key={sub.id}
                  onClick={() => onSelectNode(sub)}
                  className="group p-3.5 rounded-xl border border-border/80 bg-card hover:border-amber-500/50 hover:bg-accent/40 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="w-5 h-5 text-amber-500 shrink-0 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {sub.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {subItemsCount} item di dalam
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Bagian Catatan / Dokumen */}
      {filteredFileNotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            Catatan ({filteredFileNotes.length})
          </h2>

          <div className="border border-border/80 rounded-xl overflow-hidden bg-card divide-y divide-border/60">
            {filteredFileNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => onSelectNode(note)}
                className="group flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0 opacity-80 group-hover:opacity-100" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors block">
                      {note.title}
                    </span>
                    {note.published_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(note.published_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                    v{note.version}
                  </Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* State Kosong */}
      {childNodes.length === 0 && (
        <div className="p-10 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-xs space-y-2">
          <Folder className="w-8 h-8 mx-auto opacity-40 text-muted-foreground" />
          <p>Folder ini belum memiliki catatan terbit.</p>
        </div>
      )}
    </div>
  );
};