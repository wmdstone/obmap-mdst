// src/domains/public-reader/components/PublicBreadcrumbs.tsx
import React, { useMemo } from "react";
import type { NoteRecord } from "@/types/collaboration";
import { Folder, FileText, ChevronRight, Home } from "lucide-react";
import { cn } from "@/shared/lib";

interface BreadcrumbItem {
  id: string;
  title: string;
  isFolder: boolean;
  rawNote?: NoteRecord;
  isRoot?: boolean;
}

interface PublicBreadcrumbsProps {
  vaultName: string;
  notes: NoteRecord[];
  activeNote: NoteRecord | null;
  onNavigateHome: () => void;
  onSelectNode: (note: NoteRecord) => void;
}

export const PublicBreadcrumbs: React.FC<PublicBreadcrumbsProps> = ({
  vaultName,
  notes,
  activeNote,
  onNavigateHome,
  onSelectNode,
}) => {
  // Telusuri rantai leluhur dari activeNote menuju akar
  const breadcrumbTrail = useMemo(() => {
    const crumbs: BreadcrumbItem[] = [
      {
        id: "root-vault",
        title: vaultName,
        isFolder: true,
        isRoot: true,
      },
    ];

    if (!activeNote) return crumbs;

    const localIdToNote = new Map<string, NoteRecord>();
    for (const n of notes) {
      const fm = (n.frontmatter as Record<string, any>) || {};
      const lid = fm.local_node_id || n.id;
      localIdToNote.set(lid, n);
      localIdToNote.set(n.id, n);
    }

    const path: BreadcrumbItem[] = [];
    let curr: NoteRecord | undefined = activeNote;
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      const fm = (curr.frontmatter as Record<string, any>) || {};
      const isFolder = fm.type === "folder" || fm.is_folder === true;

      path.unshift({
        id: curr.id,
        title: curr.title,
        isFolder,
        rawNote: curr,
      });

      const parentLocalId = fm.parentId;
      if (parentLocalId) {
        curr = localIdToNote.get(parentLocalId);
      } else {
        curr = undefined;
      }
    }

    return [...crumbs, ...path];
  }, [vaultName, notes, activeNote]);

  return (
    <div className="relative w-full shrink-0 flex items-center min-w-0 h-10 px-3 md:px-6 border-b border-border/70 bg-card/40 backdrop-blur-sm select-none z-10">
      {/* Container Scroll Horizontal Tanpa Scrollbar Bawaan */}
      <nav
        aria-label="Breadcrumb Navigasi"
        className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap py-1 pr-8 text-xs font-mono text-muted-foreground scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {breadcrumbTrail.map((item, index) => {
          const isLast = index === breadcrumbTrail.length - 1;

          return (
            <span key={item.id} className="inline-flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (item.isRoot) {
                    onNavigateHome();
                  } else if (item.rawNote) {
                    onSelectNode(item.rawNote);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors shrink-0",
                  isLast
                    ? "font-semibold text-foreground bg-accent/60 shadow-xs"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
                title={item.title}
              >
                {item.isRoot ? (
                  <Home className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : item.isFolder ? (
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
                <span className="truncate max-w-[140px] sm:max-w-[180px] md:max-w-[220px]">
                  {item.title}
                </span>
              </button>

              {!isLast && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0 mx-0.5" />
              )}
            </span>
          );
        })}
      </nav>

      {/* Gradien Pudar Overflow di Ujung Kanan */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/60 to-transparent" />
    </div>
  );
};