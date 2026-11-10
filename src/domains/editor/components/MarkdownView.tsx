// src/domains/editor/components/MarkdownView.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { cn } from "@/global/utils";
import { PropertiesPanel } from "@/domains/editor/frontmatter/PropertiesPanel";
import {
  createEditorExtensions,
  appearanceTheme,
  appearanceCompartment,
} from "@/domains/editor/cm/setup";
import { createEditorApi } from "@/domains/editor/cm/state/editorApi";
import { setActiveEditor } from "@/domains/editor/services/activeEditor";
import {
  countWords,
  splitDocument,
  replaceBody,
} from "@/domains/editor/cm/extensions/frontmatterField";
import type { SuggestSource } from "@/domains/editor/suggest/suggestions";
import type { EditorApi, EditorMode } from "@/domains/editor/types";
import { useNodeStore } from "@/shared/stores";
import { useEditorSettingsStore } from "@/domains/editor/stores/useEditorSettingsStore";
import { FoldableMarkdown } from "@/domains/editor/headings/FoldableMarkdown";
import {
  splitDocumentFootnotes,
  assembleDocumentWithFootnotes,
  upsertFootnoteDefinition,
} from "@/domains/editor/footnotes/footnoteParser";
import { FootnotePopover } from "@/domains/editor/components/FootnotePopover";
import { Popover, PopoverAnchor } from "@/global/ui/popover";

interface MarkdownViewProps {
  value: string;
  onChange: (next: string) => void;
  mode?: EditorMode;
  placeholder?: string;
  showToolbar?: boolean;
  showProperties?: boolean;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
  onSave?: () => void;
  className?: string;
  sideBySide?: boolean;
}

export const MarkdownView = ({
  value,
  onChange,
  mode = "live",
  placeholder,
  showToolbar = true,
  showProperties = false,
  onWikilinkClick,
  onTagClick,
  onSave,
  className,
  sideBySide = false,
}: MarkdownViewProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const changeRef = useRef(onChange);
  const saveRef = useRef(onSave);
  const handlersRef = useRef({ onWikilinkClick, onTagClick });
  const [api, setApi] = useState<EditorApi | null>(null);

  valueRef.current = value;
  changeRef.current = onChange;
  saveRef.current = onSave;
  handlersRef.current = { onWikilinkClick, onTagClick };

  // 1. Ekstrak cleanBody murni (tanpa frontmatter dan tanpa baris [^n]: ...)
  const { cleanBody, definitionsMap } = useMemo(() => {
    const { body: rawBody } = splitDocument(value);
    return splitDocumentFootnotes(rawBody);
  }, [value]);

  const cleanBodyRef = useRef(cleanBody);
  cleanBodyRef.current = cleanBody;

  const definitionsMapRef = useRef(definitionsMap);
  definitionsMapRef.current = definitionsMap;

  const nodes = useNodeStore((state) => state.nodes);
  const suggestRef = useRef<SuggestSource>({ files: [], tags: [] });
  suggestRef.current = useMemo<SuggestSource>(() => {
    const tags = new Set<string>();
    nodes.forEach((n) => n.tags?.forEach((t) => tags.add(t)));
    return {
      files: nodes.filter((n) => n.type !== "folder").map((n) => ({ name: n.name, type: n.type })),
      tags: Array.from(tags).sort(),
      properties: ["title", "tags", "aliases", "created", "updated", "status"],
    };
  }, [nodes]);

  const isReading = mode === "reading";

  const appearance = useEditorSettingsStore((s) => s.appearance);
  const behavior = useEditorSettingsStore((s) => s.behavior);
  const suggestions = useEditorSettingsStore((s) => s.suggestions);
  const toolbarSettings = useEditorSettingsStore((s) => s.toolbar);

  const settingsRef = useRef({ appearance, behavior, suggestions });
  settingsRef.current = { appearance, behavior, suggestions };

  // 2. State untuk Popover saat berada di Editing Mode (Live Preview)
  const [editingPopover, setEditingPopover] = useState<{
    isOpen: boolean;
    label: string;
    virtualElement: { getBoundingClientRect: () => DOMRect } | null;
  }>({ isOpen: false, label: "", virtualElement: null });

  // 3. Listener event custom dari CodeMirror widget
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const handleOpenPopover = (e: Event) => {
      const customEvt = e as CustomEvent<{ label: string; rect: DOMRect }>;
      const { label, rect } = customEvt.detail;
      setEditingPopover({
        isOpen: true,
        label,
        virtualElement: {
          getBoundingClientRect: () => rect,
        },
      });
    };

    host.addEventListener("open-footnote-popover", handleOpenPopover);
    return () => {
      host.removeEventListener("open-footnote-popover", handleOpenPopover);
    };
  }, []);

  const structuralKey = JSON.stringify({
    behavior,
    suggestions,
    lineNumbers: appearance.showLineNumbers,
    activeLine: appearance.highlightActiveLine,
    selectionMatches: appearance.highlightSelectionMatches,
  });

  // 4. Inisialisasi CodeMirror HANYA dengan cleanBody murni
  useEffect(() => {
    if (isReading || !hostRef.current) return;

    const editorApi = createEditorApi(() => viewRef.current);
    const state = EditorState.create({
      doc: cleanBodyRef.current, // Menggunakan cleanBody (tanpa definisi di bagian akhir)
      extensions: createEditorExtensions({
        mode: mode === "live" ? "live" : "source",
        placeholder,
        settings: settingsRef.current,
        getSuggestSource: () => suggestRef.current,
        handlers: {
          onWikilinkClick: (t) => handlersRef.current.onWikilinkClick?.(t),
          onTagClick: (t) => handlersRef.current.onTagClick?.(t),
        },
        onChange: (nextCleanBody) => {
          cleanBodyRef.current = nextCleanBody;
          // Satukan kembali clean body dengan definisi footnote di bagian akhir berkas
          const bodyWithFootnotes = assembleDocumentWithFootnotes(
            nextCleanBody,
            definitionsMapRef.current,
          );
          const doc = replaceBody(valueRef.current, bodyWithFootnotes);
          valueRef.current = doc;
          changeRef.current(doc);
        },
        onSave: () => saveRef.current?.(),
      }),
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    setApi(editorApi);
    setActiveEditor(editorApi);

    return () => {
      view.destroy();
      viewRef.current = null;
      setApi(null);
      setActiveEditor(null);
    };
  }, [mode, isReading, placeholder, structuralKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: appearanceCompartment.reconfigure(appearanceTheme(appearance)),
    });
  }, [appearance]);

 const isInternalChangeRef = useRef(false);

   useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    
    // Jangan lakukan dispatch jika teks sama ATAU perubahan berasal dari pengetikan internal
    if (current === cleanBody) {
      isInternalChangeRef.current = false;
      return;
    }

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    // Hanya lakukan dispatch jika memang ada perubahan dokumen eksternal nyata (misal ganti file)
    view.dispatch({
      changes: { from: 0, to: current.length, insert: cleanBody },
    });
  }, [cleanBody]);

  const words = useMemo(() => countWords(value), [value]);

  const editorSurface = (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden">
      <div
        ref={hostRef}
        className="min-h-[50vh] w-full min-w-0 max-w-full text-sm"
        onFocus={() => api && setActiveEditor(api)}
      />
    </div>
  );

  // 6. Preview Reading Mode diberikan cleanBody (Sehingga baris konvensional otomatis tersembunyi!)
  const previewSurface = (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden">
      {cleanBody ? (
        <FoldableMarkdown
          content={cleanBody}
          definitionsMap={definitionsMap}
          onSaveFootnote={(label, newText) => {
            const updatedDoc = upsertFootnoteDefinition(valueRef.current, label, newText);
            changeRef.current(updatedDoc);
          }}
          onWikilinkClick={onWikilinkClick}
          onTagClick={onTagClick}
        />
      ) : (
        <p className="text-muted-foreground/30 text-sm italic">Nothing to preview</p>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-2 w-full min-w-0 max-w-full overflow-hidden", className)}>
      {showProperties && toolbarSettings.showProperties && (
        <PropertiesPanel value={value} onChange={onChange} />
      )}

      {/* Floating Popover untuk CodeMirror Editing Mode (Tanpa Nested Popover Collision) */}
      {editingPopover.isOpen && editingPopover.virtualElement && (
        <FootnotePopover
          label={editingPopover.label}
          initialText={definitionsMap.get(editingPopover.label) || ""}
          onSave={(newText) => {
            const updatedDoc = upsertFootnoteDefinition(
              valueRef.current,
              editingPopover.label,
              newText,
            );
            changeRef.current(updatedDoc);
          }}
          onJumpToSection={() => {
            window.dispatchEvent(
              new CustomEvent("jump-to-citation-section", {
                detail: { label: editingPopover.label },
              }),
            );
          }}
          open={editingPopover.isOpen}
          onOpenChange={(open) => setEditingPopover((prev) => ({ ...prev, isOpen: open }))}
          virtualElement={editingPopover.virtualElement}
        />
      )}

      {isReading ? (
        <div className="prose-container min-h-[50vh] w-full min-w-0 max-w-full overflow-hidden">
          <FoldableMarkdown
            content={cleanBody}
            definitionsMap={definitionsMap}
            onSaveFootnote={(label, newText) => {
              const updatedDoc = upsertFootnoteDefinition(valueRef.current, label, newText);
              changeRef.current(updatedDoc);
            }}
            onWikilinkClick={onWikilinkClick}
            onTagClick={onTagClick}
          />
        </div>
      ) : (
        editorSurface
      )}

      {toolbarSettings.showWordCount && (
        <div className="px-1 text-[11px] text-muted-foreground/60">
          {words} {words === 1 ? "word" : "words"}
        </div>
      )}
    </div>
  );
};
