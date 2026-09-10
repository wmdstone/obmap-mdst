import { EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  drawSelection,
  highlightActiveLine,
  placeholder as placeholderExt,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput } from "@codemirror/language";

import { editorTheme, markdownHighlight } from "./theme";
import { livePreview, sourceHighlighting } from "./extensions/livePreview";
import { wikilinkExtension, type LinkHandlers } from "./extensions/wikilinkField";
import { frontmatterField, wordCountField } from "./extensions/frontmatterField";
import {
  wikilinkCompletion,
  tagCompletion,
  propertyCompletion,
  type SuggestSource,
} from "@/features/editor/suggest/suggestions";

export interface EditorSetupOptions {
  mode: "source" | "live";
  placeholder?: string;
  getSuggestSource: () => SuggestSource;
  handlers: LinkHandlers;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export function createEditorExtensions(options: EditorSetupOptions): Extension[] {
  return [
    history(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    EditorView.lineWrapping,
    placeholderExt(options.placeholder ?? "Start writing..."),
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
    markdownHighlight,
    editorTheme,
    frontmatterField,
    wordCountField,
    autocompletion({
      activateOnTyping: true,
      icons: false,
      override: [
        wikilinkCompletion(options.getSuggestSource),
        tagCompletion(options.getSuggestSource),
        propertyCompletion(options.getSuggestSource),
      ],
    }),
    ...wikilinkExtension(options.handlers),
    ...(options.mode === "live" ? livePreview() : sourceHighlighting()),
    keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          options.onSave?.();
          return true;
        },
      },
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...defaultKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
    }),
  ];
}

export function createEditorState(doc: string, extensions: Extension[]): EditorState {
  return EditorState.create({ doc, extensions });
}
