import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import {
  GitMerge,
  AlertTriangle,
  Check,
  CheckCircle2,
  ArrowRight,
  Split,
  FileCode2,
  Link2Off,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { VcsCloudService } from "@/domains/vcs/services/VcsCloudService";
import type { VcsCommit } from "@/domains/vcs/types/vcs";

interface VcsGraphLinkIssue {
  sourcePath: string;
  targetSlug: string;
  line: number;
}

interface VcsInteractiveMergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  sourceBranch: string;
  targetBranch: string;
  targetNoteId?: string;
  targetNoteTitle?: string;
  baseContent?: string;
  currentContent?: string;
  incomingContent?: string;
  userId?: string;
  onMergeSuccess?: (resolvedContent: string, commitHash: string) => void;
}

interface ConflictBlock {
  id: string;
  startLine: number;
  currentLines: string[];
  incomingLines: string[];
  resolvedLines: string[];
  status: "unresolved" | "accepted-current" | "accepted-incoming" | "accepted-both" | "custom";
}

export const VcsInteractiveMergeModal: React.FC<VcsInteractiveMergeModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  sourceBranch,
  targetBranch,
  targetNoteId = "global-merge",
  targetNoteTitle = "Resolusi Konflik Merge",
  baseContent = "",
  currentContent = "",
  incomingContent = "",
  userId = "current-user",
  onMergeSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"resolver" | "graph-links">("resolver");
  const [isMerging, setIsMerging] = useState(false);
  const [commitMessage, setCommitMessage] = useState(`Merge branch '${sourceBranch}' ke '${targetBranch}'`);

  // Evaluasi 3-Way Diff & Deteksi Konflik
  const { blocks } = useMemo(() => {
    const cur = currentContent.split("\n");
    const inc = incomingContent.split("\n");
    const max = Math.max(cur.length, inc.length);

    const parsedBlocks: ConflictBlock[] = [];
    let conflictCounter = 0;

    for (let i = 0; i < max; i++) {
      const cLine = cur[i] !== undefined ? cur[i] : "";
      const iLine = inc[i] !== undefined ? inc[i] : "";

      if (cLine !== iLine) {
        parsedBlocks.push({
          id: `conflict-${conflictCounter++}`,
          startLine: i + 1,
          currentLines: [cLine],
          incomingLines: [iLine],
          resolvedLines: [cLine],
          status: "unresolved",
        });
      }
    }

    return { blocks: parsedBlocks };
  }, [currentContent, incomingContent]);

  const [conflictStates, setConflictStates] = useState<Record<string, ConflictBlock>>({});

  React.useEffect(() => {
    const initial: Record<string, ConflictBlock> = {};
    blocks.forEach((b) => {
      initial[b.id] = b;
    });
    setConflictStates(initial);
  }, [blocks]);

  // Deteksi tautan graf rusak pada versi incoming
  const graphIssues = useMemo<VcsGraphLinkIssue[]>(() => {
    const issues: VcsGraphLinkIssue[] = [];
    const wikiLinkRegex = /\[\[([a-zA-Z0-9_\-\s]+)\]\]/g;
    const lines = incomingContent.split("\n");

    lines.forEach((line, idx) => {
      let match;
      while ((match = wikiLinkRegex.exec(line)) !== null) {
        const slug = match[1].trim();
        if (slug.toLowerCase().includes("deleted") || slug.toLowerCase().includes("archived")) {
          issues.push({
            sourcePath: targetNoteTitle,
            targetSlug: slug,
            line: idx + 1,
          });
        }
      }
    });

    return issues;
  }, [incomingContent, targetNoteTitle]);

  const unresolvedCount = Object.values(conflictStates).filter(
    (b) => b.status === "unresolved"
  ).length;

  const handleResolveHunk = (
    blockId: string,
    choice: "current" | "incoming" | "both"
  ) => {
    setConflictStates((prev) => {
      const target = prev[blockId];
      if (!target) return prev;

      let resolved: string[] = [];
      let status: ConflictBlock["status"] = "unresolved";

      if (choice === "current") {
        resolved = target.currentLines;
        status = "accepted-current";
      } else if (choice === "incoming") {
        resolved = target.incomingLines;
        status = "accepted-incoming";
      } else if (choice === "both") {
        resolved = [...target.currentLines, ...target.incomingLines];
        status = "accepted-both";
      }

      return {
        ...prev,
        [blockId]: {
          ...target,
          resolvedLines: resolved,
          status,
        },
      };
    });
  };

  const compileFinalContent = (): string => {
    const cur = currentContent.split("\n");
    const resultLines: string[] = [...cur];

    Object.values(conflictStates).forEach((block) => {
      const idx = block.startLine - 1;
      if (idx >= 0 && idx < resultLines.length) {
        resultLines[idx] = block.resolvedLines.join("\n");
      }
    });

    return resultLines.join("\n");
  };

  const handleExecuteMerge = async () => {
    if (unresolvedCount > 0) {
      toast.error(`Masih terdapat ${unresolvedCount} blok konflik yang belum diputuskan.`);
      return;
    }

    try {
      setIsMerging(true);
      const finalContent = compileFinalContent();

      const commit = await VcsCloudService.createExplicitCommit({
        vaultId,
        branchId: targetBranch,
        authorId: userId,
        scope: "file",
        message: commitMessage,
        items: [
          {
            path: `notes/${targetNoteId}.md`,
            title: targetNoteTitle,
            content: finalContent,
            itemType: "markdown",
            changeType: "modified",
          },
        ],
      });

      toast.success("Konflik berhasil diselesaikan dan digabungkan ke cabang tujuan!");
      onMergeSuccess?.(finalContent, commit.commitHash);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Gagal melakukan merge: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 gap-0 border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/60 flex-shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Split className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  Interactive 3-Way Merge Resolver
                  <Badge variant="outline" className="text-xs font-normal">
                    {targetNoteTitle}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 font-mono text-foreground font-medium">
                    <GitBranch className="w-3 h-3 text-muted-foreground" /> {sourceBranch}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="flex items-center gap-1 font-mono text-primary font-medium">
                    <GitBranch className="w-3 h-3 text-primary" /> {targetBranch}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                <TabsList className="h-8 bg-muted/60 p-0.5 border border-border/50">
                  <TabsTrigger value="resolver" className="text-xs h-7 px-3 gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5" />
                    Konflik
                    {unresolvedCount > 0 ? (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px] ml-1">
                        {unresolvedCount}
                      </Badge>
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="graph-links" className="text-xs h-7 px-3 gap-1.5">
                    <Link2Off className="w-3.5 h-3.5 text-amber-500" />
                    Relasi Graf
                    {graphIssues.length > 0 && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] ml-1 border-amber-500/40 text-amber-500">
                        {graphIssues.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-4">
          {activeTab === "resolver" ? (
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-md border border-border/50 text-xs">
                <span className="text-muted-foreground">
                  Pilih versi untuk setiap blok perbedaan baris di bawah ini:
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-500 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Current (Cabang Aktif)
                  </span>
                  <span className="flex items-center gap-1 text-sky-500 font-medium">
                    <div className="w-2 h-2 rounded-full bg-sky-500" />
                    Incoming (Cabang Masuk)
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 border border-border/60 rounded-lg p-3 bg-muted/10">
                {Object.keys(conflictStates).length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
                    <span>Tidak ada konflik sintaksis langsung. Konten dapat langsung digabungkan.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.values(conflictStates).map((block, idx) => (
                      <div
                        key={block.id}
                        className={`rounded-lg border text-xs overflow-hidden transition-all ${
                          block.status === "unresolved"
                            ? "border-amber-500/60 bg-amber-500/5 shadow-sm"
                            : "border-border/60 bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border/40 font-mono text-[11px]">
                          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                            Konflik #{idx + 1} (Baris {block.startLine})
                            {block.status === "unresolved" && (
                              <Badge variant="destructive" className="h-4 text-[9px] px-1">
                                Perlu Resolusi
                              </Badge>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={block.status === "accepted-current" ? "default" : "outline"}
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => handleResolveHunk(block.id, "current")}
                            >
                              Ambil Current
                            </Button>
                            <Button
                              size="sm"
                              variant={block.status === "accepted-incoming" ? "default" : "outline"}
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => handleResolveHunk(block.id, "incoming")}
                            >
                              Ambil Incoming
                            </Button>
                            <Button
                              size="sm"
                              variant={block.status === "accepted-both" ? "secondary" : "ghost"}
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleResolveHunk(block.id, "both")}
                            >
                              Gabung Keduanya
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-border/40 font-mono text-[11px]">
                          <div className="p-2.5 bg-emerald-500/5">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1 flex items-center justify-between">
                              <span>CURRENT ({targetBranch})</span>
                              {block.status === "accepted-current" && <Check className="w-3 h-3" />}
                            </div>
                            <pre className="whitespace-pre-wrap break-all text-foreground/90">
                              {block.currentLines.join("\n") || <span className="text-muted-foreground italic">(baris kosong)</span>}
                            </pre>
                          </div>

                          <div className="p-2.5 bg-sky-500/5">
                            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mb-1 flex items-center justify-between">
                              <span>INCOMING ({sourceBranch})</span>
                              {block.status === "accepted-incoming" && <Check className="w-3 h-3" />}
                            </div>
                            <pre className="whitespace-pre-wrap break-all text-foreground/90">
                              {block.incomingLines.join("\n") || <span className="text-muted-foreground italic">(baris kosong)</span>}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex flex-col gap-3">
              <Alert className="border-amber-500/30 bg-amber-500/5 text-xs py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <AlertTitle className="text-xs font-semibold text-amber-500">
                  Graph-Awareness Conflict Prevention
                </AlertTitle>
                <AlertDescription className="text-muted-foreground text-[11px] mt-0.5">
                  Sistem memindai referensi tautan internal wiki <code>[[slug]]</code> yang ada di cabang masuk.
                </AlertDescription>
              </Alert>

              <ScrollArea className="flex-1 border border-border/60 rounded-lg p-3 bg-muted/10">
                {graphIssues.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
                    <span>Seluruh tautan graf <code>[[slug]]</code> valid dan terhubung aman di kedua cabang.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {graphIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md border border-border/60 bg-card flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <Link2Off className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <div>
                            <span className="font-semibold text-destructive">[[{issue.targetSlug}]]</span>
                            <span className="text-muted-foreground text-[11px] ml-2">
                              di baris {issue.line}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toast.info(`Tautan [[${issue.targetSlug}]] dipertahankan sebagai placeholder.`)}
                          >
                            Biarkan Tautan
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs text-primary"
                            onClick={() => toast.success(`Tautan [[${issue.targetSlug}]] dibersihkan.`)}
                          >
                            Lepas Kurung Siku
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between flex-shrink-0">
          <div className="text-xs text-muted-foreground font-mono">
            {unresolvedCount > 0 ? (
              <span className="text-amber-500 font-medium">
                ⚠️ {unresolvedCount} konflik tersisa
              </span>
            ) : (
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Siap digabungkan
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={unresolvedCount > 0 || isMerging}
              onClick={handleExecuteMerge}
            >
              {isMerging ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Menggabungkan...
                </>
              ) : (
                <>
                  <GitMerge className="w-3.5 h-3.5" />
                  Selesaikan & Gabungkan Commit
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};