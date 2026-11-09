// src/domains/editor/cm/extensions/cmFootnoteWidget.ts
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class FootnoteSuperscriptWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

// src/domains/editor/cm/extensions/cmFootnoteWidget.ts
  toDOM(view: EditorView): HTMLElement {
    const sup = document.createElement("sup");
    sup.className = "cm-footnote-superscript";
    sup.textContent = `[${this.label}]`;
    sup.title = `Klik untuk mengedit catatan kaki [^${this.label}]`;

    // Cegah CodeMirror merebut event mouse sebelum event click terpicu
    sup.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });

    // Klik memancarkan event popover interaktif
    sup.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = sup.getBoundingClientRect();
      view.dom.dispatchEvent(
        new CustomEvent("open-footnote-popover", {
          detail: { label: this.label, rect },
          bubbles: true,
        })
      );
    });

    return sup;
  }

  ignoreEvent(): boolean {
    return true; // Cegah event klik memindahkan kursor teks ke dalam widget
  }
}

const INLINE_FOOTNOTE_REGEX = /\[\^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\](?!\:)/g;

export function footnoteLivePreview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const sel = view.state.selection.main;

        for (const { from, to } of view.visibleRanges) {
          const text = view.state.sliceDoc(from, to);
          INLINE_FOOTNOTE_REGEX.lastIndex = 0;
          let m: RegExpExecArray | null;

          while ((m = INLINE_FOOTNOTE_REGEX.exec(text))) {
            const matchFrom = from + m.index;
            const matchTo = matchFrom + m[0].length;
            const label = m[1];

            // Jika kursor berada di dalam [^n], biarkan teks Markdown terbuka untuk diedit labelnya
            const cursorInside = sel.from <= matchTo && sel.to >= matchFrom;

            if (!cursorInside) {
              builder.add(
                matchFrom,
                matchTo,
                Decoration.replace({
                  widget: new FootnoteSuperscriptWidget(label),
                })
              );
            }
          }
        }

        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}