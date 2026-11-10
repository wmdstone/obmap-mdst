import React, { useState, useEffect } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/global/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/global/ui/dialog";
import { Badge } from "@/global/ui/badge";
import { NoteRecord } from "@/types/collaboration";
import { NoteService } from "@/domains/vault/services/NoteService";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { TwoStageLinterModal } from "@/domains/collaboration/components/TwoStageLinterModal";
import { DiffViewer } from "@/domains/collaboration/components/DiffViewer";
import {
  Globe,
  Send,
  Eye,
  ExternalLink,
  CheckCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { ClaimUsernameModal } from "@/domains/settings/profile/components/ClaimUsernameModal";
import { getPublicNoteUrl } from "@/domains/collaboration/utils/publicUrlHelper";


export interface NoteWorkflowMenuSectionProps {
  nodeId: string;
  nodeTitle: string;
  currentContent: string;
}

export const NoteWorkflowMenuSection: React.FC<NoteWorkflowMenuSectionProps> = ({
  nodeId,
  nodeTitle,
  currentContent,
}) => {
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const permissions = useVaultPermission();
  const [noteRecord, setNoteRecord] = useState<NoteRecord | null>(null);
  const [publishedContent, setPublishedContent] = useState<string>("");
  const [linterOpen, setLinterOpen] = useState(false);
  const [linterAction, setLinterAction] = useState<"publish" | "review">("publish");
  const [diffOpen, setDiffOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
   const { profile } = useAuth();
   const [claimModalOpen, setClaimModalOpen] = useState(false);

  useEffect(() => {
    if (!currentVaultId || !nodeId) return;

    let isMounted = true;
    const loadNoteData = async () => {
      try {
        const existing = await NoteService.findNoteInVault(
          currentVaultId,
          nodeId,
          nodeTitle,
        );
        if (!isMounted) return;

        if (existing) {
          setNoteRecord(existing);
          if (existing.published_at) {
            const revisions = await NoteService.getRevisions(existing.id);
            const pubTime = new Date(existing.published_at).getTime();
            const lastPub =
              revisions.find((r) => new Date(r.created_at).getTime() <= pubTime) ??
              revisions[0];
            if (lastPub && isMounted) {
              setPublishedContent(lastPub.content);
            }
          }
        } else {
          setNoteRecord({
            id: nodeId,
            vault_id: currentVaultId,
            author_id: "",
            title: nodeTitle || "Untitled",
            slug: NoteService.slugify(nodeTitle || nodeId) || "untitled",
            content: currentContent,
            frontmatter: { local_node_id: nodeId },
            status: "draft",
            version: 1,
            published_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setPublishedContent("");
        }
      } catch {
        if (isMounted) {
          setNoteRecord({
            id: nodeId,
            vault_id: currentVaultId,
            author_id: "",
            title: nodeTitle || "Untitled",
            slug: NoteService.slugify(nodeTitle || nodeId) || "untitled",
            content: currentContent,
            frontmatter: { local_node_id: nodeId },
            status: "draft",
            version: 1,
            published_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    };

    loadNoteData();
    return () => {
      isMounted = false;
    };
  }, [nodeId, currentVaultId, nodeTitle, currentContent]);

  if (!currentVaultId || !noteRecord) return null;

  const isPublished = noteRecord.status === "published";
  const hasDiff =
    Boolean(publishedContent) &&
    publishedContent.trim() !== currentContent.trim();
      const handleStartPublish = () => {
    // Jika akun belum punya username, minta klaim terlebih dahulu
    if (!profile?.username) {
      setClaimModalOpen(true);
      return;
    }
    setLinterAction("publish");
    setLinterOpen(true);
  };

  const handlePublishExecution = async (bundledContent: string) => {
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
      toast.success(`Catatan "${updated.title}" berhasil dipublikasikan ke Web!`, {
        action: {
          label: "Buka Pembaca",
          onClick: async () => {
            const url = await getPublicNoteUrl(currentVaultId, updated.slug);
            window.open(url, "_blank");
          },
        },
      });
    } catch (err: any) {
      toast.error(err?.message || "Gagal mempublikasikan catatan.");
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewSubmission = async (bundledContent: string) => {
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

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
        Publikasi Web
      </DropdownMenuLabel>

      {/* Baris Status Publikasi */}
      <div className="flex items-center justify-between px-2 py-1.5 text-xs">
        <span className="text-muted-foreground">Status</span>
        {isPublished ? (
          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] px-1.5 py-0 font-medium gap-1">
            <CheckCircle className="w-2.5 h-2.5" />
            Terbit v{noteRecord.version}
          </Badge>
        ) : noteRecord.status === "in_review" ? (
          <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] px-1.5 py-0 font-medium gap-1">
            <Clock className="w-2.5 h-2.5" />
            In Review
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            Draf Lokal
          </Badge>
        )}
      </div>

      {/* Aksi Diff jika konten telah berubah dari versi terbit */}
      {hasDiff && (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setDiffOpen(true);
          }}
          className="text-xs"
        >
          <Eye className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
          Bandingkan Perubahan (Diff)
        </DropdownMenuItem>
      )}

      {/* Aksi Publish bagi yang memiliki izin */}
      {permissions.canPublish && (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setLinterAction("publish");
            setLinterOpen(true);
          }}
          disabled={processing}
          className="text-xs font-medium text-primary focus:text-primary"
        >
          <Globe className="w-3.5 h-3.5 mr-2" />
          {isPublished ? "Perbarui di Web..." : "Publikasikan ke Web..."}
        </DropdownMenuItem>
      )}

      {/* Aksi Ajukan Review bagi Contributor */}
      {!permissions.isReadOnly &&
        !permissions.canPublish &&
        permissions.canEdit &&
        noteRecord.status !== "in_review" && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setLinterAction("review");
              setLinterOpen(true);
            }}
            disabled={processing}
            className="text-xs"
          >
            <Send className="w-3.5 h-3.5 mr-2 text-amber-500" />
            Ajukan Review...
          </DropdownMenuItem>
        )}

      {/* Aksi Buka Halaman Publik jika sudah terbit */}
      {isPublished && (
        <DropdownMenuItem
          onSelect={async () => {
            const url = await getPublicNoteUrl(currentVaultId, noteRecord.slug);
            window.open(url, "_blank");
          }}
          className="text-xs"
        >
          <BookOpen className="h-3.5 w-3.5 mr-2 text-primary" />
          Buka Halaman Web
        </DropdownMenuItem>
      )}

      {/* Modal Linter */}
      <TwoStageLinterModal
        open={linterOpen}
        onOpenChange={setLinterOpen}
        vaultId={currentVaultId}
        noteId={noteRecord.id}
        noteTitle={noteRecord.title}
        content={currentContent}
        actionType={linterAction}
        onConfirmPublish={
          linterAction === "publish"
            ? handlePublishExecution
            : handleReviewSubmission
        }
      />

      {/* Modal Diff Viewer Terbungkus Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tinjauan Perubahan: {noteRecord.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden py-2">
            <DiffViewer
              originalContent={publishedContent}
              modifiedContent={currentContent}
            />
          </div>
        </DialogContent>
      </Dialog>

            <ClaimUsernameModal
        open={claimModalOpen}
        onOpenChange={setClaimModalOpen}
        onSuccess={() => {
          // Setelah username berhasil diklaim, langsung lanjutkan alur linter/publish
          setLinterAction("publish");
          setLinterOpen(true);
        }}
      />
    </>
  );
};