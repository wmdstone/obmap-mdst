import { StateField, EditorState } from "@codemirror/state";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { FrontmatterProperty, FrontmatterPropertyType } from "@/features/editor/types";

export interface FrontmatterInfo {
  /** Raw YAML block without the --- fences. */
  raw: string;
  /** Character range of the whole block including fences (null when absent). */
  range: { from: number; to: number } | null;
  properties: FrontmatterProperty[];
  error: string | null;
}

const EMPTY: FrontmatterInfo = { raw: "", range: null, properties: [], error: null };

function inferType(value: unknown): FrontmatterPropertyType {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "text";
}

export function parseFrontmatter(doc: string): FrontmatterInfo {
  if (!doc.startsWith("---")) return EMPTY;
  const end = doc.indexOf("\n---", 3);
  if (end === -1) return EMPTY;

  const raw = doc.slice(doc.indexOf("\n") + 1, end);
  const closing = doc.indexOf("\n", end + 1);
  const to = closing === -1 ? doc.length : closing;

  try {
    const parsed = (parseYaml(raw) ?? {}) as Record<string, unknown>;
    const properties: FrontmatterProperty[] = Object.entries(parsed).map(([key, value]) => ({
      key,
      value,
      type: key === "tags" ? "tags" : inferType(value),
    }));
    return { raw, range: { from: 0, to }, properties, error: null };
  } catch (e) {
    return { raw, range: { from: 0, to }, properties: [], error: (e as Error).message };
  }
}

/** Serialize properties back into a document, leaving the body untouched. */
export function writeFrontmatter(doc: string, properties: FrontmatterProperty[]): string {
  const info = parseFrontmatter(doc);
  const body = info.range ? doc.slice(info.range.to).replace(/^\n/, "") : doc;

  const record: Record<string, unknown> = {};
  properties.forEach((p) => {
    if (p.key.trim()) record[p.key] = p.value;
  });

  if (Object.keys(record).length === 0) return body;

  const yaml = stringifyYaml(record).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}

export const frontmatterField = StateField.define<FrontmatterInfo>({
  create: (state: EditorState) => parseFrontmatter(state.doc.toString()),
  update: (value, tr) => (tr.docChanged ? parseFrontmatter(tr.newDoc.toString()) : value),
});

export const wordCountField = StateField.define<number>({
  create: (state) => countWords(state.doc.toString()),
  update: (value, tr) => (tr.docChanged ? countWords(tr.newDoc.toString()) : value),
});

export function countWords(text: string): number {
  const body = text.replace(/^---[\s\S]*?\n---/, "");
  const words = body.trim().match(/[\p{L}\p{N}'’-]+/gu);
  return words ? words.length : 0;
}
