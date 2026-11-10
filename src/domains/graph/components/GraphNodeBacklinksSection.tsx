import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/global/ui/collapsible";
import { Badge } from "@/global/ui/badge";
import { ChevronDown, ChevronRight, Link2, FileText, ArrowUpRight } from "lucide-react";

export interface Backlink {
  nodeId: string;
  nodeName: string;
  nodePath?: string;
  isWikilink: boolean;
}

export interface NodeBacklinksSectionProps {
  backlinks: Backlink[];
  onBacklinkClick: (nodeId: string) => void;
}

export const NodeBacklinksSection = ({
  backlinks,
  onBacklinkClick,
}: NodeBacklinksSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const explicitLinks = backlinks.filter((b) => b.isWikilink);
  const mentions = backlinks.filter((b) => !b.isWikilink);

  if (backlinks.length === 0) return null;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-3 pt-2.5 border-t border-border/30"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
        <div className="flex items-center gap-1.5">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 transition-transform" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 transition-transform" />
          )}
          <Link2 className="w-3.5 h-3.5 text-primary/70" />
          <span>Backlinks</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
          {backlinks.length}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3 space-y-2">
        {explicitLinks.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block px-1">
              Linked Mentions ({explicitLinks.length})
            </span>
            <div className="space-y-1.5">
              {explicitLinks.map((link) => (
                <button
                  key={link.nodeId}
                  onClick={() => onBacklinkClick(link.nodeId)}
                  className="flex items-start justify-between gap-2.5 w-full p-2 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors border border-border/20 text-xs text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground/90 truncate">
                        {link.nodeName}
                      </span>
                      {link.nodePath && link.nodePath !== link.nodeName && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {link.nodePath}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {mentions.length > 0 && (
          <div className="space-y-1 pt-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block px-1">
              Unlinked Mentions ({mentions.length})
            </span>
            <div className="space-y-1.5">
              {mentions.map((link) => (
                <button
                  key={link.nodeId}
                  onClick={() => onBacklinkClick(link.nodeId)}
                  className="flex items-start justify-between gap-2.5 w-full p-2 rounded-md bg-muted/15 hover:bg-muted/30 transition-colors border border-border/20 text-xs text-left group opacity-80 hover:opacity-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{link.nodeName}</span>
                      {link.nodePath && link.nodePath !== link.nodeName && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {link.nodePath}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};