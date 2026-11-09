// src/domains/public-reader/components/PublicFileTree.tsx
import React, { useState, useMemo, useEffect } from "react";
import type { NoteRecord } from "@/types/collaboration";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from "lucide-react";
import { cn } from "@/shared/lib";

export interface PublicTreeNode {
  id: string;
  slug: string;
  title: string;
  isFolder: boolean;
  parentId: string | null;
  localNodeId: string;
  depth: number;
  rawNote: NoteRecord;
  children: PublicTreeNode[];
}

interface PublicFileTreeProps {
  notes: NoteRecord[];
  activeNoteId: string | null;
  onSelectNode: (note: NoteRecord) => void;
  searchQuery?: string;
}

const INDENT_WIDTH = 14;

export const PublicFileTree: React.FC<PublicFileTreeProps> = ({
  notes,
  activeNoteId,
  onSelectNode,
  searchQuery = "",
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Bangun Hierarki Tree dari NoteRecord[]
  const { rootNodes, nodeMap, parentMap } = useMemo(() => {
    const localIdToNoteMap = new Map<string, NoteRecord>();
    const idToTreeObj = new Map<string, PublicTreeNode>();
    const pMap = new Map<string, string>();

    // 1. Indeks awal
    for (const note of notes) {
      const fm = (note.frontmatter as Record<string, any>) || {};
      const localId = fm.local_node_id || note.id;
      localIdToNoteMap.set(localId, note);
      localIdToNoteMap.set(note.id, note);

      const isFolder = fm.type === "folder" || fm.is_folder === true;
      idToTreeObj.set(note.id, {
        id: note.id,
        slug: note.slug,
        title: note.title,
        isFolder,
        parentId: fm.parentId || null,
        localNodeId: localId,
        depth: typeof fm.depth === "number" ? fm.depth : 0,
        rawNote: note,
        children: [],
      });
    }

    // 2. Hubungkan anak ke induk
    const roots: PublicTreeNode[] = [];

    idToTreeObj.forEach((node) => {
      let parentDbId: string | null = null;
      if (node.parentId) {
        const parentNote = localIdToNoteMap.get(node.parentId);
        if (parentNote && parentNote.id !== node.id) {
          parentDbId = parentNote.id;
        }
      }

      if (parentDbId && idToTreeObj.has(parentDbId)) {
        idToTreeObj.get(parentDbId)!.children.push(node);
        pMap.set(node.id, parentDbId);
      } else {
        roots.push(node);
      }
    });

    // 3. Urutkan: Folder terlebih dahulu, lalu urutkan abjad A-Z
    const sortNodes = (items: PublicTreeNode[]) => {
      items.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
      items.forEach((item) => {
        if (item.children.length > 0) sortNodes(item.children);
      });
    };

    sortNodes(roots);

    return { rootNodes: roots, nodeMap: idToTreeObj, parentMap: pMap };
  }, [notes]);

  // Otomatis expand folder leluhur dari node yang aktif
  useEffect(() => {
    if (!activeNoteId) return;

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let curr = parentMap.get(activeNoteId);
      while (curr) {
        next.add(curr);
        curr = parentMap.get(curr);
      }
      return next;
    });
  }, [activeNoteId, parentMap]);

  // Buka semua folder bila pengguna sedang melakukan pencarian teks
  useEffect(() => {
    if (searchQuery.trim()) {
      const allFolderIds = new Set<string>();
      nodeMap.forEach((n) => {
        if (n.isFolder) allFolderIds.add(n.id);
      });
      setExpandedFolders(allFolderIds);
    }
  }, [searchQuery, nodeMap]);

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Rekursi render item pohon
  const renderItem = (node: PublicTreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id);
    const isActive = activeNoteId === node.id;
    const hasChildren = node.children.length > 0;

    // Filter teks pencarian sederhana jika ada
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSelf = node.title.toLowerCase().includes(q);
      const matchesChild = (function checkMatch(n: PublicTreeNode): boolean {
        return n.title.toLowerCase().includes(q) || n.children.some(checkMatch);
      })(node);

      if (!matchesSelf && !matchesChild) return null;
    }

    return (
      <div key={node.id} className="select-none text-xs">
        <div
          onClick={() => onSelectNode(node.rawNote)}
          style={{ paddingLeft: `${Math.max(6, level * INDENT_WIDTH + 6)}px` }}
          className={cn(
            "group flex items-center gap-1.5 py-1.5 pr-2 rounded-md cursor-pointer transition-colors relative",
            isActive
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          {/* Chevron expand/collapse untuk folder */}
          {node.isFolder ? (
            <button
              type="button"
              onClick={(e) => toggleFolder(node.id, e)}
              className="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}

          {/* Ikon Tipe File / Folder */}
          {node.isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )
          ) : (
            <FileText
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground/70"
              )}
            />
          )}

          {/* Nama Node */}
          <span className="truncate flex-1">{node.title}</span>

          {/* Badge jumlah anak folder */}
          {node.isFolder && hasChildren && (
            <span className="text-[10px] text-muted-foreground/60 font-mono px-1 rounded bg-muted/40 shrink-0">
              {node.children.length}
            </span>
          )}
        </div>

        {/* Anak folder jika sedang terbuka */}
        {node.isFolder && isExpanded && hasChildren && (
          <div className="relative border-l border-border/40 ml-[13px] pl-1">
            {node.children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (rootNodes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Tidak ada dokumen yang ditemukan.
      </div>
    );
  }

  return <div className="space-y-0.5 py-1 px-1">{rootNodes.map((n) => renderItem(n, 0))}</div>;
};