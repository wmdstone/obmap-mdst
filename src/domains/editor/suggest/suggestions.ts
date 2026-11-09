import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { fuzzyScore } from "@/shared/lib/fuzzy";
import { commandRegistry, type Command } from "@/domains/workspace/commands/CommandRegistry";
import { getActiveEditor } from "@/domains/editor/services/activeEditor";

export interface SuggestSource {
  /** Note / media titles used by `[[` wikilink completion. */
  files: Array<{ name: string; path?: string; type?: string }>;
  /** Known tags used by `#` completion. */
  tags: string[];
  /** Frontmatter property keys used inside the YAML block. */
  properties?: string[];
}

type SourceGetter = () => SuggestSource;

/** `[[wikilink]]` completion, ranked by fuzzy score. */
export function wikilinkCompletion(getSource: SourceGetter) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/\[\[([^\]\n]*)$/);
    if (!before) return null;
    if (before.from === before.to && !context.explicit) return null;

    const query = before.text.replace("[[", "");
    const { files } = getSource();

    const options = files
      .map((f) => ({ file: f, score: fuzzyScore(query, f.name) }))
      .filter((o) => o.score !== null)
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, 30)
      .map(({ file }) => ({
        label: file.name,
        detail: file.path && file.path !== file.name ? file.path : file.type,
        type: file.type === "media" ? "variable" : "text",
        apply: (view: EditorView, _c: Completion, from: number, to: number) => {
          const rest = view.state.sliceDoc(to, to + 2) === "]]" ? 2 : 0;
          view.dispatch({
            changes: { from, to: to + rest, insert: `${file.name}]]` },
            selection: { anchor: from + file.name.length + 2 },
          });
        },
      }));

    return {
      from: before.from + 2,
      options,
      filter: false,
      validFor: /^[^\]\n]*$/,
    };
  };
}

/** `#tag` completion. */
export function tagCompletion(getSource: SourceGetter) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/(?:^|\s)#([\w/-]*)$/);
    if (!before) return null;

    const hashIndex = before.text.indexOf("#");
    const query = before.text.slice(hashIndex + 1);
    const { tags } = getSource();

    const options = tags
      .map((tag) => ({ tag, score: fuzzyScore(query, tag) }))
      .filter((o) => o.score !== null)
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, 30)
      .map(({ tag }) => ({ label: `#${tag}`, apply: `#${tag}`, type: "keyword" }));

    if (!options.length) return null;

    return {
      from: before.from + hashIndex,
      options,
      filter: false,
      validFor: /^#[\w/-]*$/,
    };
  };
}

/** Frontmatter property-key completion inside the YAML block. */
export function propertyCompletion(getSource: SourceGetter) {
  return (context: CompletionContext): CompletionResult | null => {
    const doc = context.state.doc.toString();
    if (!doc.startsWith("---")) return null;
    const end = doc.indexOf("\n---", 3);
    if (end === -1 || context.pos > end) return null;

    const before = context.matchBefore(/^[\w-]*$/);
    if (!before) return null;

    const keys = getSource().properties ?? [
      "title",
      "tags",
      "aliases",
      "created",
      "updated",
      "status",
      "author",
    ];

    return {
      from: before.from,
      options: keys.map((key) => ({ label: key, apply: `${key}: `, type: "property" })),
    };
  };
}

// Ganti fungsi slashCommandCompletion di src/domains/editor/suggest/suggestions.ts:

// Pastikan metadata untuk editor:table memiliki label dan keyword yang lengkap
const NOTION_COMMAND_META: Record<string, { iconSvg: string; desc: string; keywords: string[] }> = {
  "editor:table": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
    desc: "Tabel interaktif dengan kolom fleksibel",
    keywords: ["table", "insert table", "tabel", "grid", "sheet"],
  },
  "editor:heading-1": {
    iconSvg: `<span class="font-bold text-xs">H1</span>`,
    desc: "Judul bagian utama berukuran besar",
    keywords: ["h1", "heading 1", "header 1", "judul"],
  },
  "editor:heading-2": {
    iconSvg: `<span class="font-bold text-xs">H2</span>`,
    desc: "Sub-judul bagian menengah",
    keywords: ["h2", "heading 2", "header 2", "subjudul"],
  },
  "editor:heading-3": {
    iconSvg: `<span class="font-bold text-xs">H3</span>`,
    desc: "Sub-bagian kecil",
    keywords: ["h3", "heading 3", "header 3"],
  },
  "editor:bullet-list": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>`,
    desc: "Daftar poin sederhana",
    keywords: ["bullet", "list", "daftar", "poin"],
  },
  "editor:numbered-list": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
    desc: "Daftar bernomor urut",
    keywords: ["numbered", "nomor", "angka", "list"],
  },
  "editor:task-list": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
    desc: "Daftar to-do checkbox",
    keywords: ["task", "todo", "checkbox"],
  },
  "editor:quote": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6c0 4.5 2 7 3 10Z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v6c0 4.5 2 7 3 10Z"/></svg>`,
    desc: "Kutipan atau blockquote",
    keywords: ["quote", "kutipan", "blockquote"],
  },
  "editor:code-block": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    desc: "Blok kode program",
    keywords: ["code", "kode", "snippet"],
  },
  "editor:divider": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    desc: "Garis pemisah horizontal",
    keywords: ["divider", "garis", "hr", "separator"],
  },
  "editor:bold": {
    iconSvg: `<span class="font-bold text-xs">B</span>`,
    desc: "Teks tebal (**bold**)",
    keywords: ["bold", "tebal"],
  },
  "editor:italic": {
    iconSvg: `<span class="italic font-serif text-xs">I</span>`,
    desc: "Teks miring (*italic*)",
    keywords: ["italic", "miring"],
  },
  "editor:footnote": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    desc: "Sisipkan catatan kaki dengan penomoran otomatis",
    keywords: ["footnote", "catatan kaki", "sup", "superscript", "note"],
  },
  "editor:citation": {
    iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v5h5"/><path d="m9 14 2 2 4-4"/></svg>`,
    desc: "Kutipan pustaka / referensi buku atau jurnal",
    keywords: ["cite", "citation", "kutipan", "pustaka", "referensi", "daftar pustaka"],
  },
};

export function slashCommandCompletion() {
  return (context: CompletionContext): CompletionResult | null => {
    // Tangkap karakter slash dan teks setelahnya
    const before = context.matchBefore(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
    if (!before) return null;

    const slashIndex = before.text.indexOf("/");
    const query = before.text
      .slice(slashIndex + 1)
      .toLowerCase()
      .trim();
    // 'from' berada SETELAH karakter slash agar pencocokan teks dinamis terhadap input query pengguna
    const matchFrom = before.from + slashIndex + 1;
    const replaceFrom = before.from + slashIndex;

    const editor = getActiveEditor();
    const commands = commandRegistry
      .list()
      .filter((c) => (c.isEnabled ? c.isEnabled({ editor }) : true));

    // Perhitungan skor relevansi dinamis
    const options: Completion[] = commands
      .map((command) => {
        const meta = NOTION_COMMAND_META[command.id];
        const nameLower = command.name.toLowerCase();
        let boost = 0;

        if (query) {
          if (nameLower.startsWith(query)) boost += 50;
          else if (nameLower.includes(query)) boost += 20;

          if (meta?.keywords.some((k) => k.startsWith(query))) boost += 40;
          else if (meta?.keywords.some((k) => k.includes(query))) boost += 15;
        }

        const option: any = {
          label: command.name,
          detail: meta?.desc || command.section,
          type: "keyword",
          boost,
          iconSvg: meta?.iconSvg || `<span class="text-xs font-bold">/</span>`,
          apply: (view: EditorView, _c: Completion, _f: number, to: number) => {
            // Hapus teks slash beserta query (misal '/h1') dan posisikan kursor di titik hapus
            view.dispatch({
              changes: { from: replaceFrom, to, insert: "" },
              selection: { anchor: replaceFrom },
            });
            requestAnimationFrame(() => {
              const editor = getActiveEditor();
              if (editor) {
                command.run({ editor });
              }
            });
          },
        };

        return option;
      })
      .filter((opt) => (query ? opt.boost > 0 : true))
      .sort((a, b) => b.boost - a.boost);

    if (!options.length) return null;

    return {
      from: matchFrom,
      options,
      filter: true, // CodeMirror akan secara dinamis menyaring label berdasarkan ketikan pengguna!
    };
  };
}
