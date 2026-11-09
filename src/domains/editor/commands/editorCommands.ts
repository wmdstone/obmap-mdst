import { commandRegistry, type Command } from "@/domains/workspace/commands/CommandRegistry";
import type { EditorApi } from "@/domains/editor/types";
import { parseFootnotes } from "@/domains/editor/footnotes/footnoteParser";

const withEditor = (fn: (editor: EditorApi) => void) => (ctx: { editor: EditorApi | null }) => {
  if (ctx.editor) fn(ctx.editor);
};

const needsEditor = (ctx: { editor: EditorApi | null }) => ctx.editor !== null;

export const editorCommands: Command[] = [
  // Formatting
  {
    id: "editor:bold",
    name: "Bold",
    section: "Format",
    hotkey: "Mod-B",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("**")),
  },
  {
    id: "editor:italic",
    name: "Italic",
    section: "Format",
    hotkey: "Mod-I",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("*")),
  },
  {
    id: "editor:strikethrough",
    name: "Strikethrough",
    section: "Format",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("~~")),
  },
  {
    id: "editor:highlight",
    name: "Highlight",
    section: "Format",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("==")),
  },
  {
    id: "editor:inline-code",
    name: "Inline code",
    section: "Format",
    hotkey: "Mod-E",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("`")),
  },

  // Headings
  ...[1, 2, 3, 4, 5, 6].map<Command>((level) => ({
    id: `editor:heading-${level}`,
    name: `Heading ${level}`,
    section: "Headings",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleLinePrefix(`${"#".repeat(level)} `)),
  })),

  // Blocks
  {
    id: "editor:bullet-list",
    name: "Bullet list",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleLinePrefix("- ")),
  },
  {
    id: "editor:numbered-list",
    name: "Numbered list",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleLinePrefix("1. ")),
  },
  {
    id: "editor:task-list",
    name: "Task list",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleLinePrefix("- [ ] ")),
  },
  {
    id: "editor:quote",
    name: "Blockquote",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleLinePrefix("> ")),
  },
  {
    id: "editor:callout",
    name: "Callout",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.insertBlock("> [!note]\n> ")),
  },
  {
    id: "editor:code-block",
    name: "Code block",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.insertBlock("```\n\n```")),
  },
  {
    id: "editor:table",
    name: "Table",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.insertBlock("| Column | Column |\n| --- | --- |\n|  |  |")),
  },
  {
    id: "editor:divider",
    name: "Horizontal rule",
    section: "Blocks",
    isEnabled: needsEditor,
    run: withEditor((e) => e.insertBlock("---")),
  },

  // Links & math
  {
    id: "editor:internal-link",
    name: "backlinks",
    section: "Insert",
    hotkey: "Mod-K",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("[[", "]]")),
  },
  {
    id: "editor:embed",
    name: "Embed note or media",
    section: "Insert",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("![[", "]]")),
  },
  {
    id: "editor:inline-math",
    name: "Inline math",
    section: "Insert",
    isEnabled: needsEditor,
    run: withEditor((e) => e.toggleWrap("$")),
  },
  {
    id: "editor:block-math",
    name: "Math block",
    section: "Insert",
    isEnabled: needsEditor,
    run: withEditor((e) => e.insertBlock("$$\n\n$$")),
  },
  {
    id: "editor:footnote",
    name: "Insert Footnote",
    section: "Insert",
    hotkey: "Mod-Shift-F",
    isEnabled: needsEditor,
    run: withEditor((e) => {
      const doc = e.getValue();
      const parsed = parseFootnotes(doc);
      // Sisipkan [^n] pada posisi kursor saja (bebas looping, tanpa baris konvensional di editor)
      e.replaceSelection(`[^${parsed.nextNumber}]`);
    }),
  },
  {
    id: "editor:citation",
    name: "Insert Citation",
    section: "Insert",
    isEnabled: needsEditor,
    run: withEditor((e) => {
      const doc = e.getValue();
      const parsed = parseFootnotes(doc);
      e.replaceSelection(`[^${parsed.nextNumber}]`);
    }),
  },
  // Tambahkan di dalam array editorCommands pada src/domains/editor/commands/editorCommands.ts:
  {
    id: "editor:undo",
    name: "Undo",
    section: "Edit",
    hotkey: "Mod-Z",
    isEnabled: (ctx) => (ctx.editor?.canUndo ? ctx.editor.canUndo() : ctx.editor !== null),
    run: withEditor((e) => e.undo?.()),
  },
  {
    id: "editor:redo",
    name: "Redo",
    section: "Edit",
    hotkey: "Mod-Y",
    isEnabled: (ctx) => (ctx.editor?.canRedo ? ctx.editor.canRedo() : ctx.editor !== null),
    run: withEditor((e) => e.redo?.()),
  },
];

let registered = false;

export function registerEditorCommands(): void {
  if (registered) return;
  registered = true;
  commandRegistry.registerMany(editorCommands);
}
