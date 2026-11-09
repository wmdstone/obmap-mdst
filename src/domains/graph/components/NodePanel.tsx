import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Trash2,
  Save,
  BookOpen,
  Link2,
  MoreHorizontal,
  Maximize,
  Minimize,
  PenLine,
  Network,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownView } from "@/domains/editor/components/MarkdownView";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/lib";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/shared/ui/dropdown-menu";
import { NodeMediaPreview } from "../node-panel/NodeMediaPreview";
import { NodeBreadcrumbBar } from "../node-panel/NodeBreadcrumBar";
import { NodeBacklinksSection, type Backlink } from "../node-panel/NodeBacklinksSection";
import { NoteWorkflowMenuSection } from "@/domains/collaboration/components/NoteWorkflowMenuSection";
import { FolderOverviewEditor } from "./FolderOverviewEditor";
import { DocumentVcsButtonGroup } from "@/domains/vcs/components/DocumentVcsButtonGroup";
import { DocumentSharePopover } from "@/domains/collaboration/components/DocumentSharePopover";
import { openGraphCanvas } from "@/domains/workspace/commands/graphCanvasCommands";
import { useNodeStore } from "@/shared/stores";
import { NodeCitationsSection } from "../node-panel/NodeCitationsSection";
import {
  undoActiveEditor,
  redoActiveEditor,
  canUndoActiveEditor,
  canRedoActiveEditor,
} from "@/domains/editor/services/activeEditor";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video" | "pdf";
  dataUrl?: string;
  mimeType?: string;
}

interface NodePanelProps {
  node: Node | null;
  nodePath?: string;
  onClose: () => void;
  onUpdate: (node: Node) => void;
  onDelete: (nodeId: string) => void;
  backlinks?: Backlink[];
  onWikilinkClick?: (target: string) => void;
  onBacklinkClick?: (nodeId: string) => void;
  onTagClick?: (tag: string) => void;
  autoSaveDelay?: number;
  onBreadcrumbClick?: (target: Node) => void;
}

export const NodePanel = ({
  node,
  onClose,
  onUpdate,
  onDelete,
  backlinks = [],
  onWikilinkClick,
  onBacklinkClick,
  onTagClick,
  autoSaveDelay = 1500,
  onBreadcrumbClick,
}: NodePanelProps) => {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [editorMode, setEditorMode] = useState<"editor" | "reading">("editor");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"wide" | "narrow">("wide");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNodeIdRef = useRef<string | null>(null);
  // State ketersediaan riwayat
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });
  const lastSavedContentRef = useRef<string>(node.content || "");

  const refreshHistoryStatus = useCallback(() => {
    setHistoryStatus({
      canUndo: canUndoActiveEditor(),
      canRedo: canRedoActiveEditor(),
    });
  }, []);

  // Update hasChanges berdasarkan checkpoint teks terakhir yang tersimpan
  useEffect(() => {
    const isDirty = content !== lastSavedContentRef.current || name !== node.name;
    setHasChanges(isDirty);
    refreshHistoryStatus();
  }, [content, name, node.name, refreshHistoryStatus]);

  // Handler Simpan (Auto-save & Manual) tanpa mereset stack editor
  const handleSave = useCallback(
    (isAutoSave = false) => {
      if (!node || isSaving) return;

      setIsSaving(true);
      lastSavedContentRef.current = content; // Catat titik simpan (Checkpoint VS Code)

      onUpdate({
        ...node,
        name,
        content,
        tags,
      });

      setHasChanges(false);
      setIsSaving(false);

      if (!isAutoSave) {
        toast.success("Catatan berhasil disimpan");
      }
    },
    [node, name, content, tags, onUpdate, isSaving],
  );

  // Shortcut Keyboard Global Tab Catatan (Ctrl+Z & Ctrl+Y)
  useEffect(() => {
    const handleGlobalUndoRedo = (e: KeyboardEvent) => {
      if (editorMode === "reading") return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        (target?.tagName === "TEXTAREA" && !target.closest(".cm-editor"));
      if (isInput) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) {
          redoActiveEditor();
        } else {
          undoActiveEditor();
        }
        refreshHistoryStatus();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redoActiveEditor();
        refreshHistoryStatus();
      }
    };

    window.addEventListener("keydown", handleGlobalUndoRedo);
    return () => window.removeEventListener("keydown", handleGlobalUndoRedo);
  }, [editorMode, refreshHistoryStatus]);

  // Inisialisasi data saat node berubah
  useEffect(() => {
    if (node) {
      if (lastNodeIdRef.current !== node.id) {
        setName(node.name);
        setContent(node.content);
        setTags(node.tags || []);
        setHasChanges(false);
        lastNodeIdRef.current = node.id;
      }
    }
  }, [node?.id]);

  // Update dari props saat ada perubahan eksternal
  useEffect(() => {
    if (node && lastNodeIdRef.current === node.id && !hasChanges) {
      setName(node.name);
      setContent(node.content);
      setTags(node.tags || []);
    }
  }, [node]);

  // Lacak perubahan lokal
  useEffect(() => {
    if (node && lastNodeIdRef.current === node.id) {
      const hasNameChange = name !== node.name;
      const hasContentChange = content !== node.content;
      const hasTagsChange = JSON.stringify(tags) !== JSON.stringify(node.tags || []);
      setHasChanges(hasNameChange || hasContentChange || hasTagsChange);
    }
  }, [name, content, tags, node]);

  // // Handler Simpan
  // const handleSave = useCallback(
  //   (isAutoSave = false) => {
  //     if (!node || isSaving) return;

  //     setIsSaving(true);
  //     onUpdate({
  //       ...node,
  //       name,
  //       content,
  //       tags,
  //     });
  //     setHasChanges(false);
  //     setIsSaving(false);

  //     if (!isAutoSave) {
  //       toast.success("Catatan berhasil disimpan");
  //     }
  //   },
  //   [node, name, content, tags, onUpdate, isSaving],
  // );

  // Auto-save debounce
  useEffect(() => {
    if (hasChanges && node && autoSaveDelay > 0) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, autoSaveDelay);

      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }
  }, [hasChanges, name, content, tags, autoSaveDelay, handleSave, node]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleDelete = () => {
    if (!node) return;
    onDelete(node.id);
    onClose();
    toast.success("Catatan dihapus");
  };

  const copyEmbedLink = () => {
    if (!node) return;
    const embedSyntax = node.mediaType === "image" ? `![[${node.name}]]` : `[[${node.name}]]`;
    navigator.clipboard.writeText(embedSyntax);
    toast.success("Tautan disalin ke clipboard");
  };

  // Shortcut simpan keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges) handleSave(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasChanges, handleSave]);

  if (!node) return null;

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header Notion Minimalis: Breadcrumb kiri, kontrol aksi kanan */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border/40 bg-muted/10 gap-2 shrink-0">
        <NodeBreadcrumbBar
          node={node}
          hasChanges={hasChanges}
          isSaving={isSaving}
          onBreadcrumbClick={onBreadcrumbClick}
        />

        {/* Action Controls Kanan: Tombol Share Terpadu + Menu Dropdown ··· */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tombol Terpadu "Share" (Kolaborasi, Web Publish, & VCS) */}
          {node.type === "file" && (
            <DocumentSharePopover
              noteId={node.id}
              noteTitle={node.name}
              currentContent={content}
              onContentRestore={(restoredContent) => {
                setContent(restoredContent);
                setHasChanges(true);
              }}
            />
          )}

          {/* Action Dropdown Sentral '···' (Tampilan Lokal & Aksi Dokumen) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Pengaturan Tampilan & Berkas"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 shadow-lg">
              {/* Seksi Tampilan & Format */}
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                Tampilan & Format
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={() => setLayoutMode((prev) => (prev === "wide" ? "narrow" : "wide"))}
                className="text-xs"
              >
                {layoutMode === "wide" ? (
                  <>
                    <Minimize className="w-3.5 h-3.5 mr-2" />
                    <span>Narrow</span>
                  </>
                ) : (
                  <>
                    <Maximize className="w-3.5 h-3.5 mr-2" />
                    <span>Full Width</span>
                  </>
                )}
              </DropdownMenuItem>

              {node.type === "file" && (
                <DropdownMenuItem
                  onClick={() =>
                    setEditorMode((prev) => (prev === "editor" ? "reading" : "editor"))
                  }
                  className="text-xs"
                >
                  {editorMode === "editor" ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5 mr-2 text-primary" />
                      <span>Reading</span>
                    </>
                  ) : (
                    <>
                      <PenLine className="w-3.5 h-3.5 mr-2 text-primary" />
                      <span>Editing</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}

              {/* Seksi Aksi Dokumen */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                Aksi Dokumen
              </DropdownMenuLabel>

              {node.type === "media" && (
                <DropdownMenuItem onClick={copyEmbedLink} className="text-xs">
                  <Link2 className="w-3.5 h-3.5 mr-2" />
                  Salin Tautan Embed
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => {
                  useNodeStore.getState().setSelectedNode(node as any);
                  openGraphCanvas("graph");
                }}
                className="text-xs cursor-pointer"
              >
                <Network className="w-3.5 h-3.5 mr-2 text-primary" />
                <span>Buka di Tab Graph</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleSave(false)}
                disabled={!hasChanges}
                className="text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                Simpan Perubahan
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleDelete}
                className="text-xs text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Hapus Dokumen
              </DropdownMenuItem>

              {/* SEKSI UNDO & REDO - SPLIT ROW COMPACT DI PALING BAWAH */}
              {node.type === "file" && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-1 pt-0.5">
                    <div className="flex items-center gap-1">
                      {/* Tombol Undo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          undoActiveEditor();
                          refreshHistoryStatus();
                        }}
                        disabled={!historyStatus.canUndo || editorMode === "reading"}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-1 rounded text-xs select-none transition-all",
                          historyStatus.canUndo && editorMode !== "reading"
                            ? "text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer active:scale-95"
                            : "text-muted-foreground/35 cursor-not-allowed opacity-50",
                        )}
                        title="Batal perubahan (Ctrl+Z)"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span className="font-medium">Undo</span>
                      </button>

                      {/* Tombol Redo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          redoActiveEditor();
                          refreshHistoryStatus();
                        }}
                        disabled={!historyStatus.canRedo || editorMode === "reading"}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-1 rounded text-xs select-none transition-all",
                          historyStatus.canRedo && editorMode !== "reading"
                            ? "text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer active:scale-95"
                            : "text-muted-foreground/35 cursor-not-allowed opacity-50",
                        )}
                        title="Ulang perubahan (Ctrl+Y)"
                      >
                        <span className="font-medium">Redo</span>
                        <Redo2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Konten Utama: Responsif Edge-to-Edge dengan Proteksi Overflow Radix */}
      <ScrollArea className="flex-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]>div]:!min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!max-w-full">
        <div
          className={cn(
            "mx-auto transition-all duration-200 w-full min-w-0 max-w-full overflow-hidden",
            layoutMode === "wide"
              ? "max-w-none px-2.5 sm:px-6 py-2 sm:py-2"
              : "max-w-3xl px-3 sm:px-6 py-2 sm:py-2",
          )}
        >
          {/* Input Judul Responsif (Mobile: text-xl, Tablet: text-2xl, Laptop: text-3xl/2rem) */}
          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <Input
              ref={titleInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={node.type === "folder" ? "Untitled folder" : "Untitled"}
              className="w-full min-w-0 max-w-full text-xl sm:text-2xl md:text-3xl lg:text-[2rem] font-bold tracking-tight bg-transparent border-0 border-none shadow-none px-0 h-auto placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none focus:ring-0 selection:bg-primary/20 truncate"
            />
          </div>

          <div className="h-px bg-border/40 my-2" />

          {/* Media Preview */}
          {node.type === "media" && node.dataUrl && (
            <div className="mb-8">
              <NodeMediaPreview node={node} />
            </div>
          )}

          {/* Konten Markdown View (Tanpa Banner yang Memotong Tulisan) */}
          {node.type === "file" && (
            <div className="flex-1 min-h-0 flex flex-col">
              <MarkdownView
                value={content}
                onChange={setContent}
                showProperties
                mode={editorMode === "reading" ? "reading" : "live"}
                placeholder="Write '/' or start writing..."
                onWikilinkClick={onWikilinkClick}
                onTagClick={onTagClick}
                onSave={() => handleSave(false)}
              />
            </div>
          )}

          {/* Folder Description (Akan digantikan oleh Notion Folder Editor di Tahap 2) */}
          {/* Dedicated Folder Editor View (Notion Database Table & Bulk Publish) */}
          {node.type === "folder" && (
            <FolderOverviewEditor
              folderNode={node}
              onUpdateFolder={onUpdate}
              onDeleteFolder={onDelete}
            />
          )}

          {/* Media Notes */}
          {node.type === "media" && (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tambahkan catatan untuk media ini..."
              className="w-full min-h-[150px] bg-transparent border-none shadow-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/30 focus:outline-none focus-visible:ring-0 focus-visible:outline-none px-1 py-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            />
          )}

          {/* 1. Citations & Footnotes (Ditempatkan di atas Backlinks) */}
          {(node.type === "file" || node.type === "media") && (
            <NodeCitationsSection
              content={content || node.content || ""}
              onContentChange={setContent}
              onChange={setContent}
              onCitationClick={(label) => {
                const targetDef = document.getElementById(`citation-def-${label}`);
                if (targetDef) {
                  targetDef.scrollIntoView({ behavior: "smooth", block: "center" });
                  targetDef.classList.add("ring-1", "ring-primary", "bg-primary/15");
                  setTimeout(() => {
                    targetDef.classList.remove("ring-1", "ring-primary", "bg-primary/15");
                  }, 1200);
                }
              }}
            />
          )}

          {/* 2. Backlinks (Ditempatkan di bawah Citations & Footnotes) */}
          {(node.type === "file" || node.type === "media") && (
            <NodeBacklinksSection
              backlinks={backlinks}
              onBacklinkClick={onBacklinkClick || (() => {})}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
