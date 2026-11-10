// src/domains/graph/components/MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { cn } from "@/global/utils";
import { InteractiveTable } from "@/domains/editor/table/InteractiveTable";
import { extractTableDataFromHastNode } from "@/domains/editor/table/tableParser";
import { FootnotePopover } from "@/domains/editor/components/FootnotePopover";
import {
  parseFootnotes,
  extractTextContent,
} from "@/domains/editor/footnotes/footnoteParser";

interface MarkdownRendererProps {
  content: string;
  definitionsMap?: Map<string, string>;
  onSaveFootnote?: (label: string, newText: string) => void;
  onWikilinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}

export const MarkdownRenderer = ({
  content,
  definitionsMap,
  onSaveFootnote,
  onWikilinkClick,
  onTagClick,
  className,
}: MarkdownRendererProps) => {
  // 1. Process wikilinks
  const processedContent = content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target, alias) => {
      const displayText = alias || target;
      return `<span class="wikilink" data-target="${target.trim()}">${displayText}</span>`;
    },
  );

  // 2. Process tags
  const processedWithTags = processedContent.replace(/#([\w-]+)/g, (match, tag) => {
    return `<span class="hashtag" data-tag="${tag}">${match}</span>`;
  });

  // 3. Process inline footnote citations: [^label] (yang bukan baris definisi [^label]:)
  // Menjamin mode reading SELALU merender badge [n] interaktif meskipun tanpa baris definisi
  const processedWithFootnotes = processedWithTags.replace(
    /\[\^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\](?!\:)/g,
    (_, label) => {
      return `<sup class="footnote-ref" data-footnote-label="${label}">[${label}]</sup>`;
    }
  );

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains("wikilink")) {
      e.preventDefault();
      const linkTarget = target.getAttribute("data-target");
      if (linkTarget && onWikilinkClick) {
        onWikilinkClick(linkTarget);
      }
    }

    if (target.classList.contains("hashtag")) {
      e.preventDefault();
      const tag = target.getAttribute("data-tag");
      if (tag && onTagClick) {
        onTagClick(tag);
      }
    }
  };

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none break-words", className)}
      onClick={handleClick}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          table: ({ node, children, ...props }) => {
            const extractedData = node ? extractTableDataFromHastNode(node) : null;

            if (extractedData && extractedData.columns.length > 0) {
              return (
                <InteractiveTable tableData={extractedData} readOnly={true} className="w-full" />
              );
            }

            return (
              <div className="w-full max-w-full my-3 overflow-x-auto">
                <table {...props} className="w-full min-w-full border-collapse text-left text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead: ({ children, ...props }) => (
            <thead
              {...props}
              className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b border-border text-foreground font-semibold"
            >
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody {...props} className="divide-y divide-border/20">
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr {...props} className="transition-colors hover:bg-muted/15">
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="px-3.5 py-2.5 font-semibold text-foreground whitespace-nowrap border-r border-border/30 last:border-r-0"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              {...props}
              className="px-3.5 py-2 text-foreground/90 align-top border-r border-border/20 last:border-r-0 break-words"
            >
              {children}
            </td>
          ),
          input: ({ node, ...props }) => {
            if (props.type === "checkbox") {
              return <input {...props} className="mr-2 rounded border-border" disabled />;
            }
            return <input {...props} />;
          },
          p: ({ node, children, ...props }) => (
            <p {...props} className="break-words">
              {children}
            </p>
          ),

          // Sembunyikan bagian catatan kaki konvensional di akhir catatan
          section: ({ node, children, ...props }) => {
            if (props["data-footnotes"]) {
              return null;
            }
            return <section {...props}>{children}</section>;
          },

          // Custom Superscript Interaktif dengan Popover & Posisi Bebas Tabrakan
          sup: ({ node, children, ...props }) => {
            const labelFromProp =
              (node?.properties?.dataFootnoteLabel as string) || props["data-footnote-label"];
            const rawLabel =
              labelFromProp ||
              extractTextContent(children).replace(/[^\w-]/g, "") ||
              "1";

            // Ambil teks definisi dari definitionsMap atau parse teks saat ini
            const defText =
              definitionsMap?.get(rawLabel) ??
              parseFootnotes(content).definitions.find((d) => d.label === rawLabel)?.text ??
              "";

            return (
              <FootnotePopover
                label={rawLabel}
                initialText={defText}
                onSave={(newText) => {
                  onSaveFootnote?.(rawLabel, newText);
                }}
                onJumpToSection={() => {
                  window.dispatchEvent(
                    new CustomEvent("jump-to-citation-section", { detail: { label: rawLabel } }),
                  );
                }}
              >
                <sup
                  {...props}
                  id={`fnref-${rawLabel}`}
                  className="inline-flex items-center justify-center align-baseline relative -top-[0.32em] h-[1.25em] text-[0.72em] leading-none font-mono font-semibold text-primary px-1 py-0 mx-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer select-none"
                >
                  [{rawLabel}]
                </sup>
              </FootnotePopover>
            );
          },

          a: ({ href, children, ...props }) => {
            if (props["data-footnote-backref"]) {
              return (
                <a
                  href={href}
                  {...props}
                  className="inline-block ml-1 text-primary hover:scale-125 transition-transform font-bold"
                  title="Kembali ke teks"
                >
                  ↩
                </a>
              );
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes("language-");
            return isInline ? (
              <code {...props} className="bg-muted px-1.5 py-0.5 rounded text-sm">
                {children}
              </code>
            ) : (
              <code {...props} className="block bg-muted p-4 rounded-lg overflow-x-auto max-w-full">
                {children}
              </code>
            );
          },
        }}
      >
        {processedWithFootnotes}
      </ReactMarkdown>
    </div>
  );
};