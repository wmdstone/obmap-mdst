/**
 * Heading folding for the source / live editor: a fold range spans from the
 * end of a heading line to the last line before the next heading of the same
 * or a higher level. Presentation only — the document text never changes.
 */

import { foldService, foldGutter, codeFolding } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { parseHeadings, type HeadingNode } from "@/core/editor/headings/headingTree";

let cachedDoc = "";
let cachedHeadings: HeadingNode[] = [];

function headingsFor(doc: string): HeadingNode[] {
  if (doc !== cachedDoc) {
    cachedDoc = doc;
    cachedHeadings = parseHeadings(doc);
  }
  return cachedHeadings;
}

function chevron(open: boolean): HTMLElement {
  const span = document.createElement("span");
  span.className = `cm-heading-fold-chevron${open ? " is-open" : ""}`;
  span.setAttribute("aria-hidden", "true");
  span.setAttribute("role", "button");
  span.setAttribute("tabindex", "-1");
  // Menggunakan 1 ikon ChevronRight (Lucide SVG 14x14) identik dengan mode baca & properties
  span.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cm-chevron-icon"><path d="m9 18 6-6-6-6"/></svg>`;
  return span;
}

export function headingFolding(): Extension {
  return [
    codeFolding({
    }),
    foldService.of((state, lineStart, lineEnd) => {
      const doc = state.doc.toString();
      const line = state.doc.lineAt(lineStart);
      const heading = headingsFor(doc).find((h) => h.line === line.number - 1);
      if (!heading) return null;
      const to = Math.min(heading.to, state.doc.length);
      if (to <= lineEnd) return null;
      return { from: lineEnd, to };
    }),
    foldGutter({
      markerDOM: (open) => chevron(open),
    }),
  ];
}
