import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { PublicReaderService } from "@/domains/public-reader/services/PublicReaderService";
import { cn } from "@/shared/lib";
import { Lock, FileText } from "lucide-react";
import { InteractiveTable } from "@/domains/editor/table/InteractiveTable";
import { extractTableDataFromHastNode } from "@/domains/editor/table/tableParser";

interface PublicMarkdownReaderProps {
  content: string;
  username: string;
  vaultSlug: string;
  publishedSlugMap: Map<string, string>; // Map: slug -> title
  className?: string;
}

export const PublicMarkdownReader: React.FC<PublicMarkdownReaderProps> = ({
  content,
  username,
  vaultSlug,
  publishedSlugMap,
  className,
}) => {
  // Parsing token [[wikilink]] menjadi representasi struktural
  const renderableElements = useMemo(() => {
    if (!content) return [];

    const wikilinkRegex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
    const parts: Array<
      | { type: "text"; text: string }
      | { type: "wikilink"; targetSlug: string; displayText: string; isPublished: boolean }
    > = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = wikilinkRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push({
          type: "text",
          text: content.slice(lastIndex, matchIndex),
        });
      }

      const rawTarget = match[1].trim();
      const alias = match[2]?.trim();
      const targetSlug = PublicReaderService.slugify(rawTarget);
      const isPublished = publishedSlugMap.has(targetSlug);
      const displayText = alias || publishedSlugMap.get(targetSlug) || rawTarget;

      parts.push({
        type: "wikilink",
        targetSlug,
        displayText,
        isPublished,
      });

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        text: content.slice(lastIndex),
      });
    }

    return parts;
  }, [content, publishedSlugMap]);

  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none break-words leading-relaxed",
        "prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl",
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border",
        "prose-img:rounded-xl prose-img:shadow-sm prose-img:border prose-img:border-border",
        className,
      )}
    >
      {renderableElements.map((item, index) => {
        if (item.type === "text") {
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
              components={{
                p: ({ children }) => <span>{children}</span>,
                table: ({ node, children, ...props }) => {
                  const extractedData = extractTableDataFromHastNode(node);

                  if (extractedData) {
                    return (
                      <InteractiveTable
                        tableData={extractedData}
                        readOnly={true}
                      />
                    );
                  }

                  return (
                    <div className="my-4 w-full max-w-full overflow-x-auto rounded-lg border border-border/60">
                      <table {...props} className="w-full min-w-full border-collapse text-left">
                        {children}
                      </table>
                    </div>
                  );
                },

                th: ({ children, ...props }) => (
                  <th
                    {...props}
                    className="border-b border-border/60 bg-muted/30 px-3.5 py-2 font-semibold text-foreground text-xs whitespace-nowrap"
                  >
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td
                    {...props}
                    className="border-b border-border/20 px-3.5 py-2 text-foreground/90 text-xs"
                  >
                    {children}
                  </td>
                ),
              }}
            >
              {item.text}
            </ReactMarkdown>
          );
        }

        // Tautan ke catatan yang SUDAH TERBIT dalam vault ini
        if (item.isPublished) {
          return (
            <Link
              key={index}
              to={`/p/${username}/${vaultSlug}/${item.targetSlug}`}
              className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors px-1 py-0.5 rounded hover:bg-primary/10"
            >
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span>{item.displayText}</span>
            </Link>
          );
        }

        // GHOST LINK: Tautan ke catatan yang MASIH DRAF / BELUM TERBIT
        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-muted-foreground/80 border-b border-dashed border-muted-foreground/50 cursor-not-allowed select-none px-1 py-0.5 rounded bg-muted/40 text-sm">
                <Lock className="w-3 h-3 shrink-0 opacity-60" />
                <span>{item.displayText}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="text-xs bg-popover text-popover-foreground border border-border shadow-md"
            >
              Catatan ini belum dipublikasikan oleh penulis
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
