import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Share2,
  Globe,
  ExternalLink,
  Copy,
  Check,
  GitCommit,
  History,
  GitBranch,
  Eye,
  Send,
  CheckCircle,
  Clock,
  CloudOff,
  RefreshCw,
  Lock,
  GlobeLock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/untypedSupabase";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { useVcsStore } from "@/domains/vcs/stores/useVcsStore";
import { NoteService } from "@/domains/vault/services/NoteService";
import { NoteRecord } from "@/types/collaboration";
import { getPublicNoteUrl } from "@/domains/collaboration/utils/publicUrlHelper";
import { VcsCoPresenceAvatars } from "@/domains/vcs/components/VcsCoPresenceAvatars";
import { VcsCloudService } from "@/domains/vcs/services/VcsCloudService";
import { VcsMicroRevisionService } from "@/domains/vcs/services/VcsMicroRevisionService";
import { VcsSyncQueueService } from "@/domains/vcs/services/VcsSyncQueueService";
import { VcsCommit, LocalMicroRevision } from "@/domains/vcs/types/vcs";
import { TwoStageLinterModal } from "@/domains/collaboration/components/TwoStageLinterModal";
import { DiffViewer } from "@/domains/collaboration/components/DiffViewer";
import { ClaimUsernameModal } from "@/domains/settings/profile/components/ClaimUsernameModal";

export interface DocumentSharePopoverProps {
  noteId: string;
  noteTitle: string;
  currentContent: string;
  onContentRestore: (newContent: string) => void;
}

export const DocumentSharePopover: React.FC<DocumentSharePopoverProps> = ({
  noteId,
  noteTitle,
  currentContent,
  onContentRestore,
}) => {
  const { user, profile } = useAuth();
  const currentVaultId = useVaultStore((state) => state.currentVaultId);
  const permissions = useVaultPermission();
  const { pendingSyncCount, isProcessingSync, activeBranchId, activeBranchName } = useVcsStore();

  // State Kontrol Publikasi
  const [noteRecord, setNoteRecord] = useState<NoteRecord | null>(null);
  const [publishedContent, setPublishedContent] = useState<string>("");
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  // State Inline Commit
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  // State Inline Riwayat
  const [historyTab, setHistoryTab] = useState<"cloud" | "local">("cloud");
  const [cloudCommits, setCloudCommits] = useState<VcsCommit[]>([]);
  const [microRevisions, setMicroRevisions] = useState<LocalMicroRevision[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // State Modal (Khusus Diff Visual & Linter Publikasi)
  const [linterOpen, setLinterOpen] = useState(false);
  const [linterAction, setLinterAction] = useState<"publish" | "review">("publish");
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffViewContent, setDiffViewContent] = useState<string | null>(null);
  const [diffLabel, setDiffLabel] = useState<string>("");
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  // Muat data publikasi dan slug
  const loadNoteData = async () => {
    if (!currentVaultId || !noteId) return;
    try {
      const existing = await NoteService.findNoteInVault(
        currentVaultId,
        noteId,
        noteTitle
      );

      if (existing) {
        setNoteRecord(existing);
        if (existing.published_at) {
          const revisions = await NoteService.getRevisions(existing.id);
          const pubTime = new Date(existing.published_at).getTime();
          const lastPub =
            revisions.find((r) => new Date(r.created_at).getTime() <= pubTime) ??
            revisions[0];
          if (lastPub) {
            setPublishedContent(lastPub.content);
          }
        } else {
          setPublishedContent("");
        }
        const generatedUrl = await getPublicNoteUrl(currentVaultId, existing.slug);
        setPublicUrl(generatedUrl);
      } else {
        setNoteRecord({
          id: noteId,
          vault_id: currentVaultId,
          author_id: user?.id || "",
          title: noteTitle || "Untitled",
          slug: NoteService.slugify(noteTitle || noteId) || "untitled",
          content: currentContent,
          frontmatter: { local_node_id: noteId },
          status: "draft",
          version: 1,
          published_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setPublishedContent("");
      }
    } catch {
      // Fallback draft lokal
      setNoteRecord({
        id: noteId,
        vault_id: currentVaultId,
        author_id: user?.id || "",
        title: noteTitle || "Untitled",
        slug: NoteService.slugify(noteTitle || noteId) || "untitled",
        content: currentContent,
        frontmatter: { local_node_id: noteId },
        status: "draft",
        version: 1,
        published_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setPublishedContent("");
    }
  };

  // Muat riwayat commit cloud & snapshot lokal secara inline
  const loadHistory = async () => {
    if (!currentVaultId || !noteId) return;
    setIsLoadingHistory(true);
    try {
      const localRevs = await VcsMicroRevisionService.getNoteRevisions(currentVaultId, noteId);
      setMicroRevisions(localRevs);

      if (activeBranchId && navigator.onLine) {
        const commits = await VcsCloudService.listCommitHistory({
          vaultId: currentVaultId,
          branchId: activeBranchId,
          scope: "file",
          targetPath: `${noteTitle}.md`,
          limit: 20,
        });
        setCloudCommits(commits);
      }
    } catch (err) {
      console.warn("Gagal memuat riwayat dokumen:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadNoteData();
    loadHistory();
  }, [noteId, currentVaultId, noteTitle, activeBranchId]);

  if (!currentVaultId || !user) return null;

  const isPublished = noteRecord?.status === "published";
  const isInReview = noteRecord?.status === "in_review";
  const hasDiff =
    Boolean(publishedContent) && publishedContent.trim() !== currentContent.trim();

  // Handler Salin Tautan
  const handleCopyLink = async () => {
    if (!publicUrl) return;
    const fullUrl = `${window.location.origin}${publicUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      toast.success("Tautan publik berhasil disalin ke clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin tautan.");
    }
  };

  // Handler Mulai Publikasi
  const handleStartPublish = () => {
    if (!profile?.username) {
      setClaimModalOpen(true);
      return;
    }
    setLinterAction("publish");
    setLinterOpen(true);
  };

  // Eksekusi Publish / Update ke Web
  const handlePublishExecution = async (bundledContent: string) => {
    if (!noteRecord) return;
    setProcessing(true);
    try {
      const updated = await NoteService.publishOrUpdateNote({
        vaultId: currentVaultId,
        nodeId: noteRecord.id,
        title: noteRecord.title,
        content: bundledContent,
        status: "published",
        frontmatter: noteRecord.frontmatter as Record<string, any>,
      });

      setNoteRecord(updated);
      setPublishedContent(updated.content);
      const newUrl = await getPublicNoteUrl(currentVaultId, updated.slug);
      setPublicUrl(newUrl);

      toast.success(`Catatan "${updated.title}" berhasil dipublikasikan!`, {
        action: {
          label: "Buka",
          onClick: () => window.open(newUrl, "_blank"),
        },
      });
    } catch (err: any) {
      toast.error(err?.message || "Gagal mempublikasikan catatan.");
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  // Eksekusi Unpublish (Tarik dari publikasi web)
  const handleUnpublish = async () => {
    if (!noteRecord || !currentVaultId) return;
    setProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("notes")
        .update({
          status: "draft",
          published_at: null,
          updated_at: nowIso,
        })
        .eq("id", noteRecord.id)
        .select()
        .single();

      if (error) throw error;

      const updated = data as NoteRecord;
      setNoteRecord(updated);
      setPublishedContent("");
      toast.success(`Catatan "${noteRecord.title}" ditarik dari web (kembali ke draf privat).`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal membatalkan publikasi catatan.");
    } finally {
      setProcessing(false);
    }
  };

  // Eksekusi Review Submission
  const handleReviewSubmission = async (bundledContent: string) => {
    if (!noteRecord) return;
    setProcessing(true);
    try {
      const updated = await NoteService.publishOrUpdateNote({
        vaultId: currentVaultId,
        nodeId: noteRecord.id,
        title: noteRecord.title,
        content: bundledContent,
        status: "in_review",
        frontmatter: noteRecord.frontmatter as Record<string, any>,
      });

      setNoteRecord(updated);
      toast.success("Catatan berhasil diajukan untuk ditinjau editor.");
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengajukan review.");
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  // Eksekusi Inline Commit Dokumen
  const handleInlineCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error("Pesan commit wajib diisi");
      return;
    }
    if (!activeBranchId) {
      toast.error("Pilih branch aktif terlebih dahulu");
      return;
    }

    setIsCommitting(true);
    try {
      if (navigator.onLine) {
        await VcsCloudService.createExplicitCommit({
          vaultId: currentVaultId,
          branchId: activeBranchId,
          message: commitMessage.trim(),
          authorId: user.id,
          scope: "file",
          targetPath: `${noteTitle}.md`,
          items: [
            {
              path: `${noteTitle}.md`,
              title: noteTitle,
              content: currentContent,
              itemType: "markdown",
              changeType: "modified",
            },
          ],
        });

        await VcsMicroRevisionService.squashRevisionsForNote(currentVaultId, noteId);
        toast.success(`Commit berhasil disimpan ke branch "${activeBranchName || 'main'}"`);
      } else {
        await VcsSyncQueueService.enqueue({
          vaultId: currentVaultId,
          branchId: activeBranchId,
          commitData: {
            id: "",
            vaultId: currentVaultId,
            branchId: activeBranchId,
            commitHash: "",
            parentCommitId: null,
            message: commitMessage.trim(),
            scope: "file",
            targetPath: `${noteTitle}.md`,
            authorId: user.id,
            isRevert: false,
            revertedCommitId: null,
            createdAt: new Date().toISOString(),
          },
          items: [
            {
              id: "",
              commitId: "",
              path: `${noteTitle}.md`,
              blobHash: "",
              itemType: "markdown",
              title: noteTitle,
              changeType: "modified",
              sizeBytes: currentContent.length,
            },
          ],
          blobs: [
            {
              blobHash: "",
              contentText: currentContent,
              mimeType: "text/markdown",
              sizeBytes: currentContent.length,
            },
          ],
        });

        toast.info("Tersimpan di antrean offline. Akan disinkronkan saat online.");
      }

      setCommitMessage("");
      await loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan commit");
    } finally {
      setIsCommitting(false);
    }
  };

  // Pulihkan Versi dari Cloud Commit
  const handleRestoreCloudCommit = async (commit: VcsCommit) => {
    try {
      const items = await VcsCloudService.getCommitItems(commit.id);
      const target = items.find((i) => i.path === `${noteTitle}.md`) || items[0];
      if (target) {
        const text = (await VcsCloudService.getBlobContent(target.blobHash)) || "";
        onContentRestore(text);
        toast.success(`Konten dipulihkan ke commit: "${commit.message}"`);
      } else {
        toast.error("Konten catatan tidak ditemukan dalam commit ini.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memulihkan versi catatan.");
    }
  };

  // Pratinjau Diff Commit Cloud
  const handleInspectCloudCommit = async (commit: VcsCommit) => {
    try {
      const items = await VcsCloudService.getCommitItems(commit.id);
      const target = items.find((i) => i.path === `${noteTitle}.md`) || items[0];
      if (target) {
        const text = (await VcsCloudService.getBlobContent(target.blobHash)) || "";
        setDiffViewContent(text);
        setDiffLabel(`Commit: ${commit.message} (${commit.commitHash.substring(0, 7)})`);
        setDiffOpen(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat perbandingan.");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Popover>
        {/* Trigger Button: Share Button Ramping & Adaptif */}
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 sm:px-2.5 gap-1.5 text-xs font-medium rounded-md border-border/50 bg-background/50 hover:bg-accent/60 transition-colors shadow-none"
            title="Bagikan, Publikasi Web, & Version Control"
          >
            <Share2 className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Share</span>

            {/* Indikator Titik Sinkronisasi Offline */}
            {pendingSyncCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>

        {/* Popover Content: Lebar Adaptif & Anti-Overflow Mobile */}
        <PopoverContent
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="w-[calc(100vw-1.5rem)] sm:w-84 max-w-[340px] p-3 shadow-xl border-border/60 bg-popover/95 backdrop-blur-md rounded-xl z-50 overflow-hidden"
        >
          {/* Header Ringkas: Co-Presence & Target Branch */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <Share2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">
                Bagikan & Versi
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <VcsCoPresenceAvatars vaultId={currentVaultId} noteId={noteId} />
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                <GitBranch className="w-2.5 h-2.5 text-primary" />
                <span className="max-w-[70px] truncate">{activeBranchName || "main"}</span>
              </span>
            </div>
          </div>

          {/* Micro Segmented Tabs: 3 Pilar Utama */}
          <Tabs defaultValue="publish" className="w-full">
            <TabsList className="grid grid-cols-3 h-7.5 p-0.5 bg-muted/60 rounded-lg">
              <TabsTrigger
                value="publish"
                className="text-[11px] h-6.5 px-1 gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Globe className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">Publikasi</span>
              </TabsTrigger>
              <TabsTrigger
                value="commit"
                className="text-[11px] h-6.5 px-1 gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <GitCommit className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">Commit</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="text-[11px] h-6.5 px-1 gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <History className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">Riwayat</span>
                {(cloudCommits.length > 0 || microRevisions.length > 0) && (
                  <span className="text-[9px] font-mono text-muted-foreground ml-0.5">
                    ({cloudCommits.length + microRevisions.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: PUBLIKASI WEB */}
            <TabsContent value="publish" className="mt-2.5 space-y-2.5">
              {/* Status Header */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground font-medium">Status Catatan:</span>
                {isPublished ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] px-1.5 py-0 font-medium gap-1">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Terbit v{noteRecord?.version}
                  </Badge>
                ) : isInReview ? (
                  <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] px-1.5 py-0 font-medium gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    In Review
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    Draf Privat
                  </Badge>
                )}
              </div>

              {/* Tampilan jika Terbit: Link + Tombol Perbarui & Unpublish Berdampingan */}
              {isPublished ? (
                <div className="space-y-2">
                  {/* Link Sharing Box */}
                  <div className="flex items-center gap-1 bg-muted/40 border border-border/50 rounded-md p-1 pl-2">
                    <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">
                      {publicUrl || "Memuat tautan..."}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyLink}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {isCopied ? "Tersalin!" : "Salin Tautan"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(publicUrl, "_blank")}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ExternalLink className="w-3 h-3 text-primary" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Buka Web
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Tombol Berdampingan: Perbarui & Unpublish */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleStartPublish}
                      disabled={processing || !permissions.canPublish}
                      className="h-7 text-xs font-medium gap-1"
                      title="Perbarui versi di web"
                    >
                      <Globe className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">Perbarui</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUnpublish}
                      disabled={processing || !permissions.canPublish}
                      className="h-7 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1"
                      title="Tarik catatan dari publikasi web (kembali ke draf privat)"
                    >
                      <GlobeLock className="w-3 h-3 shrink-0" />
                      <span className="truncate">Unpublish</span>
                    </Button>
                  </div>

                  {/* Indikator Diff jika ada modifikasi lokal yang belum di-publish */}
                  {hasDiff && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDiffViewContent(publishedContent);
                        setDiffLabel("Perbedaan: Versi Terbit Web vs Editan Saat Ini");
                        setDiffOpen(true);
                      }}
                      className="w-full h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1 justify-center border border-dashed border-border/50"
                    >
                      <Eye className="w-2.5 h-2.5 text-primary" />
                      <span>Ada editan belum terbit • Cek Diff</span>
                    </Button>
                  )}
                </div>
              ) : (
                /* Jika Catatan Masih Draf */
                <div className="space-y-2 bg-muted/20 border border-border/40 rounded-lg p-2.5">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Catatan privat. Terbitkan agar dapat dibaca publik via URL resmi.
                  </p>

                  {permissions.canPublish ? (
                    <Button
                      size="sm"
                      onClick={handleStartPublish}
                      disabled={processing}
                      className="w-full h-7 text-xs font-medium gap-1.5"
                    >
                      <Globe className="w-3 h-3" />
                      Publikasikan ke Web
                    </Button>
                  ) : !permissions.isReadOnly && permissions.canEdit && !isInReview ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLinterAction("review");
                        setLinterOpen(true);
                      }}
                      disabled={processing}
                      className="w-full h-7 text-xs font-medium gap-1.5"
                    >
                      <Send className="w-3 h-3 text-amber-500" />
                      Ajukan Review ke Editor
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground py-1">
                      <Lock className="w-3 h-3" />
                      Hanya Editor/Admin yang dapat mempublikasikan
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: INLINE QUICK COMMIT */}
            <TabsContent value="commit" className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/40">
                <span className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-primary" />
                  Target:
                </span>
                <Badge variant="outline" className="font-mono text-[10px] bg-background/80 px-1.5 py-0 h-4.5">
                  {activeBranchName || "main"}
                </Badge>
              </div>

              {/* Input Pesan Commit Inline */}
              <Input
                placeholder={`Pesan commit (misal: Perbarui ${noteTitle})...`}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleInlineCommit();
                  }
                }}
                className="h-7.5 text-xs font-sans placeholder:text-muted-foreground/60"
                disabled={permissions.isReadOnly || isCommitting}
                autoFocus
              />

              {/* Tombol Eksekusi Commit Inline */}
              <Button
                size="sm"
                onClick={handleInlineCommit}
                disabled={isCommitting || permissions.isReadOnly || !commitMessage.trim()}
                className="w-full h-7.5 text-xs font-medium gap-1.5"
              >
                {isCommitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <GitCommit className="w-3 h-3" />
                )}
                <span>Simpan Commit (Enter)</span>
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                {permissions.isReadOnly
                  ? "Peran viewer hanya memiliki akses baca (read-only)."
                  : "Menyimpan snapshot perubahan dokumen ke branch aktif."}
              </p>
            </TabsContent>

            {/* TAB 3: INLINE VERSION HISTORY */}
            <TabsContent value="history" className="mt-2.5 space-y-2">
              {/* Sub-Switch: Cloud vs Lokal */}
              <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground pb-1 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryTab("cloud")}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      historyTab === "cloud"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:text-foreground"
                    }`}
                  >
                    Cloud ({cloudCommits.length})
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("local")}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      historyTab === "local"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:text-foreground"
                    }`}
                  >
                    Lokal ({microRevisions.length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="hover:text-foreground p-0.5"
                  title="Segarkan riwayat"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Area Daftar Riwayat Ber-Scroll Ringkas */}
              <ScrollArea className="h-44 pr-1">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-28 text-xs text-muted-foreground gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    Memuat riwayat...
                  </div>
                ) : historyTab === "cloud" ? (
                  cloudCommits.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-muted-foreground">
                      Belum ada commit cloud pada branch ini.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cloudCommits.map((c) => (
                        <div
                          key={c.id}
                          className="p-1.5 rounded-md border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-1.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-[11px] text-foreground truncate">
                              {c.message}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                              <span>{c.commitHash.substring(0, 6)}</span>
                              <span>•</span>
                              <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInspectCloudCommit(c)}
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title="Bandingkan dengan editan saat ini"
                            >
                              <Eye className="w-2.5 h-2.5 mr-0.5" />
                              Diff
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreCloudCommit(c)}
                              className="h-5 px-1.5 text-[10px] gap-0.5 border-border/60 hover:border-primary/50"
                              title="Pulihkan catatan ke versi ini"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Pulihkan
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : microRevisions.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-muted-foreground">
                    Belum ada snapshot lokal tersimpan (retensi 6 hari).
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {microRevisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-1.5 rounded-md border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[11px] text-foreground truncate">
                            Snapshot {new Date(rev.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(rev.timestamp).toLocaleDateString()} • {rev.content.length} karakter
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDiffViewContent(rev.content);
                              setDiffLabel(`Snapshot: ${new Date(rev.timestamp).toLocaleString()}`);
                              setDiffOpen(true);
                            }}
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-2.5 h-2.5 mr-0.5" />
                            Diff
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onContentRestore(rev.content);
                              toast.success("Catatan dipulihkan dari snapshot lokal.");
                            }}
                            className="h-5 px-1.5 text-[10px] gap-0.5 border-border/60 hover:border-primary/50"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Pulihkan
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* DIALOG DIFF VISUAL (Hanya dibuka saat user ingin melihat perbandingan visual warna merah/hijau) */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-4">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-sm font-semibold">{diffLabel || `Tinjauan Perubahan: ${noteTitle}`}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden py-2 min-h-[300px]">
            <DiffViewer
              originalContent={diffViewContent || publishedContent}
              modifiedContent={currentContent}
              originalLabel="Versi Riwayat / Web"
              modifiedLabel="Versi Saat Ini di Editor"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL LINTER & CLAIM USERNAME */}
      <TwoStageLinterModal
        open={linterOpen}
        onOpenChange={setLinterOpen}
        vaultId={currentVaultId}
        noteId={noteId}
        noteTitle={noteTitle}
        content={currentContent}
        actionType={linterAction}
        onConfirmPublish={
          linterAction === "publish"
            ? handlePublishExecution
            : handleReviewSubmission
        }
      />

      <ClaimUsernameModal
        open={claimModalOpen}
        onOpenChange={setClaimModalOpen}
        onSuccess={() => {
          setLinterAction("publish");
          setLinterOpen(true);
        }}
      />
    </TooltipProvider>
  );
};