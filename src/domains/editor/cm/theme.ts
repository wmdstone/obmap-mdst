import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/** Editor chrome themed with the app's semantic design tokens. */
export const editorTheme = EditorView.theme({
  "&": {
    color: "hsl(var(--foreground))",
    backgroundColor: "transparent",
    fontSize: "0.95rem",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.7",
    overflow: "auto",
    overflowX: "hidden",
  },
  ".cm-content": {
    // Padding vertikal minimal & padding horizontal nol agar presisi dengan mode baca
    padding: "0.25rem 0 1.5rem",
    caretColor: "hsl(var(--primary))",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 1px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "hsl(var(--primary))" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "hsl(var(--primary) / 0.22)",
  },
  ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.35)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "hsl(var(--muted-foreground) / 0.5)",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-placeholder": { color: "hsl(var(--muted-foreground) / 0.4)" },

  // Live preview heading sizing ala Notion / Obsidian (responsif relatif thd base font)
  ".cm-md-h1": {
    fontSize: "1.75em",
    fontWeight: "700",
    lineHeight: "1.25",
    letterSpacing: "-0.02em",
  },
  ".cm-md-h2": {
    fontSize: "1.38em",
    fontWeight: "700",
    lineHeight: "1.3",
    letterSpacing: "-0.015em",
  },
  ".cm-md-h3": {
    fontSize: "1.18em",
    fontWeight: "650",
    lineHeight: "1.35",
    letterSpacing: "-0.01em",
  },
  ".cm-md-h4": {
    fontSize: "1.05em",
    fontWeight: "600",
    lineHeight: "1.4",
  },
  ".cm-md-h5": {
    fontSize: "0.95em",
    fontWeight: "600",
    lineHeight: "1.4",
    opacity: "0.9",
  },
  ".cm-md-h6": {
    fontSize: "0.85em",
    fontWeight: "600",
    lineHeight: "1.4",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-md-strong": { fontWeight: "700" },
  ".cm-md-em": { fontStyle: "italic" },
  ".cm-md-strike": { textDecoration: "line-through", opacity: "0.7" },
  ".cm-md-code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
    backgroundColor: "hsl(var(--muted) / 0.6)",
    borderRadius: "4px",
    padding: "0.1em 0.3em",
  },
  ".cm-md-fenced": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
  },
  ".cm-md-quote": { color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
  ".cm-md-wikilink": {
    color: "hsl(var(--primary))",
    cursor: "pointer",
    textDecoration: "none",
  },
  ".cm-md-wikilink:hover": { textDecoration: "underline" },
  ".cm-md-tag": {
    color: "hsl(var(--primary))",
    backgroundColor: "hsl(var(--primary) / 0.1)",
    borderRadius: "999px",
    padding: "0.05em 0.45em",
  },
  ".cm-md-task": {
    marginRight: "0.4em",
    verticalAlign: "middle",
    accentColor: "hsl(var(--primary))",
  },

  // Fold placeholder
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "hsl(var(--muted-foreground))",
    borderRadius: "0",
    padding: "0 0.45em",
    margin: "0 0.25em 0 0.65em",
    cursor: "pointer",
  },
  ".cm-foldPlaceholder:hover": {
    backgroundColor: "transparent",
    boxShadow: "none",
  },

  // Popup Menu Autocomplete Bergaya Notion
  ".cm-tooltip": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border) / 0.8)",
    borderRadius: "0.5rem",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
    overflow: "hidden",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    width: "280px",
    maxWidth: "90vw",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    maxHeight: "22rem",
    padding: "0.3rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "0.25rem 0.35rem",
    borderRadius: "0.375rem",
    margin: "0.1rem 0",
    cursor: "pointer",
    transition: "background-color 120ms ease, color 120ms ease",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "hsl(var(--accent))",
    color: "hsl(var(--accent-foreground))",
  },

  // Gutter lipat heading CodeMirror: lebar stabil 22px di dalam alur scroller agar tidak terpotong
  ".cm-foldGutter": {
    width: "22px",
    display: "flex",
    flexDirection: "column",
  },
  ".cm-foldGutter .cm-gutterElement": {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "5px", // Sejajar presisi dengan baris pertama teks judul
    width: "22px",
    boxSizing: "border-box",
  },

  // Tombol chevron CodeMirror: ukuran konsisten 18x18, mudah diklik dan tampak elegan
  ".cm-heading-fold-chevron": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    borderRadius: "4px",
    color: "hsl(var(--muted-foreground) / 0.65)",
    cursor: "pointer",
    transition: "color 150ms ease, background-color 150ms ease",
  },
  ".cm-heading-fold-chevron:hover": {
    color: "hsl(var(--foreground))",
    backgroundColor: "hsl(var(--muted) / 0.5)",
  },
  ".cm-heading-fold-chevron .cm-chevron-icon": {
    transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
    transformOrigin: "center",
  },
  // Animasi rotasi 90 derajat saat terbuka (pointing down = open, pointing right = folded)
  ".cm-heading-fold-chevron.is-open .cm-chevron-icon": {
    transform: "rotate(90deg)",
    color: "hsl(var(--muted-foreground) / 0.85)",
  },
// src/domains/editor/cm/theme.ts
  ".cm-footnote-superscript": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    verticalAlign: "baseline",
    position: "relative",
    top: "-0.32em",
    height: "1.25em",
    fontSize: "0.72em",
    lineHeight: "1",
    fontWeight: "600",
    color: "hsl(var(--primary))",
    backgroundColor: "hsl(var(--primary) / 0.12)",
    padding: "0 3.5px",
    margin: "0 1.5px",
    borderRadius: "3px",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 120ms ease, color 120ms ease",
    "&:hover": {
      backgroundColor: "hsl(var(--primary) / 0.22)",
    },
  },
});

export const markdownHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading, fontWeight: "700" },
    { tag: t.strong, fontWeight: "700" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: "hsl(var(--primary))" },
    { tag: t.url, color: "hsl(var(--primary))", opacity: 0.7 },
    { tag: t.monospace, color: "hsl(var(--foreground))" },
    { tag: t.quote, color: "hsl(var(--muted-foreground))" },
    { tag: t.list, color: "hsl(var(--primary))" },
    { tag: t.comment, color: "hsl(var(--muted-foreground))" },
  ]),
);
