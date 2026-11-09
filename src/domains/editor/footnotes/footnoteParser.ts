// src/domains/editor/footnotes/footnoteParser.ts
import React from "react";

export interface FootnoteReference {
  label: string;
  index: number;
  offset: number;
}

export interface FootnoteDefinition {
  label: string;
  number: number;
  text: string;
  url?: string;
  raw: string;
}

export interface ParsedFootnotes {
  references: FootnoteReference[];
  definitions: FootnoteDefinition[];
  unresolved: FootnoteReference[];
  nextNumber: number;
}

const INLINE_FOOTNOTE_REGEX = /\[\^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\](?!\:)/g;
const URL_REGEX = /(https?:\/\/[^\s)]+|doi:[^\s)]+)/i;
const DEF_START_REGEX = /^\[\^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\]:\s*(.*)$/;

/** Ekstrak teks murni dari VDOM Children untuk mencegah [object Object] */
export function extractTextContent(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join("");
  if (React.isValidElement(node)) {
    return extractTextContent((node.props as { children?: React.ReactNode })?.children);
  }
  return "";
}

/** 
 * Pisahkan isi teks utama dari definisi footnote secara deterministik (line-by-line).
 * Mencegah kebocoran regex state dan membersihkan semua baris [^n]: ...
 */
export function splitDocumentFootnotes(content: string): {
  cleanBody: string;
  definitionsMap: Map<string, string>;
} {
  if (!content) return { cleanBody: "", definitionsMap: new Map() };

  const lines = content.split("\n");
  const definitionsMap = new Map<string, string>();
  const cleanLines: string[] = [];
  let currentLabel: string | null = null;
  let currentText: string[] = [];

  const flush = () => {
    if (currentLabel !== null) {
      definitionsMap.set(currentLabel, currentText.join("\n").trim());
      currentLabel = null;
      currentText = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(DEF_START_REGEX);

    if (match) {
      flush();
      currentLabel = match[1].trim();
      currentText = [match[2]];
    } else if (currentLabel !== null) {
      // Baris lanjutan berinden
      if (/^(?: {2,}|\t)(.*)$/.test(line)) {
        currentText.push(line.trim());
      } else if (line.trim() === "") {
        let isContinuation = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === "") continue;
          if (/^(?: {2,}|\t)/.test(lines[j])) isContinuation = true;
          break;
        }
        if (isContinuation) {
          currentText.push("");
        } else {
          flush();
          cleanLines.push(line);
        }
      } else {
        flush();
        cleanLines.push(line);
      }
    } else {
      cleanLines.push(line);
    }
  }
  flush();

  const cleanBody = cleanLines.join("\n").trimEnd();
  return { cleanBody, definitionsMap };
}

/** 
 * Gabungkan kembali teks dengan definisi footnote.
 * IDEMPOTENT: Selalu bersihkan cleanBody terlebih dahulu agar tidak pernah terjadi duplikasi berulang.
 */
export function assembleDocumentWithFootnotes(
  cleanBody: string,
  definitionsMap: Map<string, string>
): string {
  // Membersihkan cleanBody dari kemungkinan baris footnote yang tertinggal
  const { cleanBody: pureCleanBody } = splitDocumentFootnotes(cleanBody);
  const trimmed = pureCleanBody.trimEnd();

  if (definitionsMap.size === 0) return trimmed;

  const defLines: string[] = [];
  definitionsMap.forEach((text, label) => {
    if (text !== undefined && text !== null && text.trim() !== "") {
      defLines.push(`[^${label}]: ${text.trim()}`);
    }
  });

  if (defLines.length === 0) return trimmed;
  return trimmed ? `${trimmed}\n\n${defLines.join("\n")}` : defLines.join("\n");
}

export function upsertFootnoteDefinition(
  doc: string,
  label: string,
  newText: string
): string {
  const { cleanBody, definitionsMap } = splitDocumentFootnotes(doc);
  if (newText.trim() === "") {
    definitionsMap.delete(label);
  } else {
    definitionsMap.set(label, newText.trim());
  }
  return assembleDocumentWithFootnotes(cleanBody, definitionsMap);
}

export const updateFootnoteDefinition = upsertFootnoteDefinition;

export function deleteFootnoteDefinition(doc: string, label: string): string {
  const { cleanBody, definitionsMap } = splitDocumentFootnotes(doc);
  definitionsMap.delete(label);
  return assembleDocumentWithFootnotes(cleanBody, definitionsMap);
}

export function parseFootnotes(content: string): ParsedFootnotes {
  if (!content) {
    return { references: [], definitions: [], unresolved: [], nextNumber: 1 };
  }

  const { definitionsMap } = splitDocumentFootnotes(content);
  const references: FootnoteReference[] = [];
  INLINE_FOOTNOTE_REGEX.lastIndex = 0;
  let refMatch: RegExpExecArray | null;
  let order = 1;

  while ((refMatch = INLINE_FOOTNOTE_REGEX.exec(content)) !== null) {
    references.push({
      label: refMatch[1].trim(),
      index: order++,
      offset: refMatch.index,
    });
  }

  const definitions: FootnoteDefinition[] = [];
  const processedLabels = new Set<string>();
  let highestNumeric = 0;

  references.forEach((ref) => {
    if (processedLabels.has(ref.label)) return;
    processedLabels.add(ref.label);

    const num = parseInt(ref.label, 10);
    if (!isNaN(num) && num > highestNumeric) highestNumeric = num;

    const text = definitionsMap.get(ref.label) || "";
    const urlMatch = text.match(URL_REGEX);
    definitions.push({
      label: ref.label,
      number: !isNaN(num) ? num : definitions.length + 1,
      text,
      url: urlMatch ? urlMatch[0] : undefined,
      raw: `[^${ref.label}]: ${text}`,
    });
  });

  const unresolved = references.filter(
    (ref) => !definitionsMap.has(ref.label) || !definitionsMap.get(ref.label)?.trim()
  );

  return {
    references,
    definitions,
    unresolved,
    nextNumber: highestNumeric + 1,
  };
}