/**
 * Reading-mode renderer with per-heading collapsible sections. Folding is
 * local to the rendered note and reconciled whenever the headings change.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "@/core/graph/MarkdownRenderer";
import { buildHeadingTree, type HeadingNode } from "./headingTree";
import { cn } from "@/shared/lib";

interface FoldableMarkdownProps {
  content: string;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-2xl font-semibold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-medium text-muted-foreground",
};

function sliceLines(lines: string[], from: number, to: number): string {
  if (to < from) return "";
  return lines.slice(from, to + 1).join("\n").trim();
}

interface SectionProps {
  node: HeadingNode;
  lines: string[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
}

const Section = ({
  node,
  lines,
  collapsed,
  toggle,
  onWikilinkClick,
  onTagClick,
}: SectionProps) => {
  const isCollapsed = collapsed.has(node.id);
  const firstChildLine = node.children[0]?.line ?? node.endLine + 1;
  const own = sliceLines(lines, node.line + 1, firstChildLine - 1);
  const Tag = `h${node.level}` as "h1";

  return (
    <section className="scroll-mt-16">
      <div className="group flex items-start gap-1">
        <button
          type="button"
          onClick={() => toggle(node.id)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}
          className="mt-[0.35em] rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <Tag
          id={node.id}
          data-heading-id={node.id}
          className={cn("mb-2 mt-4 flex-1", HEADING_CLASS[node.level])}
        >
          {node.label}
        </Tag>
      </div>

      {isCollapsed ? (
        <div className="pl-10 text-sm text-muted-foreground/40"> masalahnya disini …</div>
      ) : (
        <div className="pl-5">
          {own && (
            <MarkdownRenderer
              content={own}
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
  onWikilinkClick,
  onTagClick,
  className,
}: FoldableMarkdownProps) => {
  const lines = useMemo(() => content.split("\n"), [content]);
  const tree = useMemo(() => buildHeadingTree(content), [content]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Reconcile collapse state when headings change.
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
        onWikilinkClick={onWikilinkClick}
        onTagClick={onTagClick}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      {preamble && (
        <MarkdownRenderer
          content={preamble}
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
          onWikilinkClick={onWikilinkClick}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
};
