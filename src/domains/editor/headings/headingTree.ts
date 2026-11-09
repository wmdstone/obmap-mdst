/**
 * Shared heading parser — single source of truth for the floating TOC,
 * CodeMirror fold ranges and reading-mode section folding.
 */

export interface HeadingNode {
  id: string;
  level: number;
  label: string;
  /** 0-based line index of the heading itself. */
  line: number;
  /** Character offset of the heading line start. */
  from: number;
  /** Character offset of the end of the section (exclusive). */
  to: number;
  /** End offset of the heading line itself. */
  headingEnd: number;
  /** 0-based line index of the last line belonging to this section. */
  endLine: number;
  children: HeadingNode[];
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "heading"
  );
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
    .replace(/[*_`~]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/** Flat list of headings, ignoring fenced code blocks. */
export function parseHeadings(source: string): HeadingNode[] {
  const lines = source.split("\n");
  const flat: HeadingNode[] = [];
  const used = new Map<string, number>();

  let offset = 0;
  let inFence = false;
  let fenceMarker = "";

  lines.forEach((line, index) => {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
    }

    if (!inFence) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const label = cleanLabel(match[2]) || "Untitled";
        const base = slugify(label);
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        flat.push({
          id: seen === 0 ? base : `${base}-${seen}`,
          level: match[1].length,
          label,
          line: index,
          from: offset,
          headingEnd: offset + line.length,
          to: offset + line.length,
          endLine: index,
          children: [],
        });
      }
    }

    offset += line.length + 1;
  });

  const total = source.length;
  flat.forEach((heading, i) => {
    let end = total;
    let endLine = lines.length - 1;
    for (let j = i + 1; j < flat.length; j += 1) {
      if (flat[j].level <= heading.level) {
        end = Math.max(heading.headingEnd, flat[j].from - 1);
        endLine = flat[j].line - 1;
        break;
      }
    }
    heading.to = end;
    heading.endLine = endLine;
  });

  return flat;
}

/** Nested heading tree built from the flat list. */
export function buildHeadingTree(source: string): HeadingNode[] {
  const flat = parseHeadings(source).map((h) => ({ ...h, children: [] }));
  const roots: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  flat.forEach((node) => {
    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  });

  return roots;
}
