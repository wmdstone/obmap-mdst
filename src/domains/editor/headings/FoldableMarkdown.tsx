/**
 * Reading-mode renderer with per-heading collapsible sections. Folding is
 * local to the rendered note and reconciled whenever the headings change.
 * Titik tiga lipatan (...) diselaraskan 1:1 identik dengan editing mode:
 * inline di samping teks judul, tanpa border, tanpa box-fill, dan interaktif.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "@/domains/graph/components/MarkdownRenderer";
import { buildHeadingTree, type HeadingNode } from "./headingTree";
import { cn } from "@/shared/lib";

interface FoldableMarkdownProps {
  content: string;
  definitionsMap?: Map<string, string>;
  onSaveFootnote?: (label: string, newText: string) => void;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}

// 1. Tipografi murni tanpa margin luar agar tidak mendorong judul terpisah dari chevron
const HEADING_TYPOGRAPHY: Record<number, string> = {
  1: "text-xl sm:text-2xl md:text-[1.75rem] font-bold tracking-tight leading-tight",
  2: "text-lg sm:text-xl md:text-[1.375rem] font-bold tracking-tight leading-snug",
  3: "text-base sm:text-lg md:text-[1.15rem] font-semibold tracking-tight leading-snug",
  4: "text-sm sm:text-base font-semibold leading-normal",
  5: "text-xs sm:text-sm font-semibold text-foreground/90 leading-normal",
  6: "text-xs font-medium uppercase tracking-wider text-muted-foreground leading-normal",
};

// 2. Margin vertikal diterapkan pada level kontainer baris heading (chevron + teks bergerak bersama)
const HEADING_MARGIN: Record<number, string> = {
  1: "mt-6 mb-2.5",
  2: "mt-5 mb-2",
  3: "mt-4 mb-1.5",
  4: "mt-3 mb-1",
  5: "mt-2.5 mb-1",
  6: "mt-2 mb-0.5",
};

// 3. Penyelarasan vertikal mikro agar ikon chevron berada tepat di titik tengah baris pertama judul
const CHEVRON_ALIGN_CLASS: Record<number, string> = {
  1: "pt-[3px]",
  2: "pt-[2.5px]",
  3: "pt-[2px]",
  4: "pt-[1.5px]",
  5: "pt-[1px]",
  6: "pt-0",
};

function sliceLines(lines: string[], from: number, to: number): string {
  if (to < from) return "";
  return lines
    .slice(from, to + 1)
    .join("\n")
    .trim();
}



interface SectionProps {
  node: HeadingNode;
  lines: string[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  definitionsMap?: Map<string, string>;
  onSaveFootnote?: (label: string, newText: string) => void;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
}

const Section = ({
  node,
  lines,
  collapsed,
  toggle,
  definitionsMap,
  onSaveFootnote,
  onWikilinkClick,
  onTagClick,
}: SectionProps) => {
  const isCollapsed = collapsed.has(node.id);
  const firstChildLine = node.children[0]?.line ?? node.endLine + 1;
  const own = sliceLines(lines, node.line + 1, firstChildLine - 1);
  const Tag = `h${node.level}` as "h1";

  return (
    <section className="scroll-mt-16 min-w-0">
      <div className={cn("group flex items-start -ml-6 select-none", HEADING_MARGIN[node.level])}>
        <div
          className={cn(
            "w-6 shrink-0 flex items-center justify-center select-none",
            CHEVRON_ALIGN_CLASS[node.level],
          )}
        >
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Buka bagian ${node.label}` : `Lipat bagian ${node.label}`}
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 rounded-[4px] cursor-pointer transition-colors duration-150",
              "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isCollapsed
                ? "text-foreground opacity-100"
                : "text-muted-foreground/60 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 stroke-[2] transition-transform duration-200 ease-out",
                !isCollapsed && "rotate-90 text-muted-foreground/80",
              )}
            />
          </button>
        </div>

        <Tag
          id={node.id}
          data-heading-id={node.id}
          className={cn(
            "flex-1 !m-0 !p-0 text-foreground flex items-baseline flex-wrap gap-x-1.5 select-text",
            HEADING_TYPOGRAPHY[node.level],
          )}
        >
          <span>{node.label}</span>
          {isCollapsed && (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-label={`Buka lipatan ${node.label}`}
              title="Klik untuk membuka lipatan"
              className="inline-flex items-baseline bg-transparent border-0 p-0 m-0 ml-1 text-muted-foreground/60 hover:text-foreground cursor-pointer select-none font-mono text-sm tracking-wider transition-colors focus:outline-none"
            >
              ...
            </button>
          )}
        </Tag>
      </div>

      {!isCollapsed && (
        <div className="w-full">
          {own && (
            <MarkdownRenderer
              content={own}
              definitionsMap={definitionsMap}
              onSaveFootnote={onSaveFootnote}
              onWikilinkClick={onWikilinkClick}
              onTagClick={onTagClick}
            />
          )}
          {node.children.map((child) => (
            <Section
              key={child.id}
              node={child}
              lines={lines}
              collapsed={collapsed}
              toggle={toggle}
              definitionsMap={definitionsMap}
              onSaveFootnote={onSaveFootnote}
              onWikilinkClick={onWikilinkClick}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      )}
    </section>
  );
};


export const FoldableMarkdown = ({
  content,
  definitionsMap,
  onSaveFootnote,
  onWikilinkClick,
  onTagClick,
  className,
}: FoldableMarkdownProps) => {
  const lines = useMemo(() => content.split("\n"), [content]);
  const tree = useMemo(() => buildHeadingTree(content), [content]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const idKey = useMemo(() => {
    const ids: string[] = [];
    const walk = (nodes: HeadingNode[]) =>
      nodes.forEach((n) => {
        ids.push(n.id);
        walk(n.children);
      });
    walk(tree);
    return ids.join("|");
  }, [tree]);

  useEffect(() => {
    const valid = new Set(idKey.split("|"));
    setCollapsed((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idKey]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const preamble = useMemo(() => {
    const first = tree[0]?.line ?? lines.length;
    return sliceLines(lines, 0, first - 1);
  }, [tree, lines]);

  if (tree.length === 0) {
    return (
      <MarkdownRenderer
        content={content}
        definitionsMap={definitionsMap}
        onSaveFootnote={onSaveFootnote}
        onWikilinkClick={onWikilinkClick}
        onTagClick={onTagClick}
        className={className}
      />
    );
  }

  return (
    <div className={cn("pl-6 pr-2", className)}>
      {preamble && (
        <MarkdownRenderer
          content={preamble}
          definitionsMap={definitionsMap}
          onSaveFootnote={onSaveFootnote}
          onWikilinkClick={onWikilinkClick}
          onTagClick={onTagClick}
        />
      )}
      {tree.map((node) => (
        <Section
          key={node.id}
          node={node}
          lines={lines}
          collapsed={collapsed}
          toggle={toggle}
          definitionsMap={definitionsMap}
          onSaveFootnote={onSaveFootnote}
          onWikilinkClick={onWikilinkClick}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
};
