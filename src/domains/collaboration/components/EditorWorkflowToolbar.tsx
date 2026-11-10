import React, { useState } from "react";
import { Button } from "@/global/ui/button";
import { Badge } from "@/global/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/global/ui/dialog";
import { NoteRecord, NoteStatus } from "@/types/collaboration";
import { TwoStageLinterModal } from "@/domains/collaboration/components/TwoStageLinterModal";
import { DiffViewer } from "@/domains/collaboration/components/DiffViewer";
import { NoteService } from "@/domains/vault/services/NoteService";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { toast } from "sonner";
import {
  Globe,
  Send,
  Eye,
  FileCheck,
  Archive,
  Clock,
  CheckCircle,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { getPublicNoteUrl } from "@/domains/collaboration/utils/publicUrlHelper";


export interface EditorWorkflowToolbarProps {
  note: NoteRecord;
  vaultId: string;
  publishedRevisionContent?: string;
  currentContent: string;
  onNoteUpdated: (updatedNote: NoteRecord) => void;
}

export const EditorWorkflowToolbar: React.FC<EditorWorkflowToolbarProps> = ({
  note,
  vaultId,
  publishedRevisionContent = "",
  currentContent,
  onNoteUpdated,
}) => {
  const permissions = useVaultPermission();
  const [linterOpen, setLinterOpen] = useState(false);
  const [linterAction, setLinterAction] = useState<"publish" | "review">("publish");
  const [diffOpen, setDiffOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const renderStatusBadge = (status: NoteStatus) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 gap-1.5 font-medium px-2 py-0.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Terbit ke Web
          </Badge>
        );
      case "in_review":
        return (
          <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 gap-1.5 font-medium px-2 py-0.5">
            <Clock className="w-3.5 h-3.5" />
            Menunggu Review
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Archive className="w-3 h-3" />
            Arsip
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge variant="secondary" className="gap-1 font-medium text-muted-foreground">
            Draf Lokal
          </Badge>
        );
    }
  };

  const handlePublishExecution = async (bundledContent: string) => {
    setProcessing(true);
    try {
      const updated = await NoteService.publishOrUpdateNote({
        vaultId,
        nodeId: note.id,
        title: note.title,
        content: bundledContent,
        status: "published",
        frontmatter: note.frontmatter as Record<string, any>,
      });

      onNoteUpdated(updated);
      toast.success(`Catatan "${updated.title}" berhasil dipublikasikan ke Web!`, {
        action: {
          label: "Buka Halaman Web",
          onClick: async () => {
            const url = await getPublicNoteUrl(vaultId, updated.slug);
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
        vaultId,
        nodeId: note.id,
        title: note.title,
        content: bundledContent,
        status: "in_review",
        frontmatter: note.frontmatter as Record<string, any>,
      });

      onNoteUpdated(updated);
      toast.success("Catatan berhasil diajukan untuk ditinjau editor.");
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengajukan review.");
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const isPublished = note.status === "published";

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/95 backdrop-blur">
      {/* Sisi Kiri: Status, Versi, & Tautan Web */}
      <div className="flex items-center gap-2">
        {renderStatusBadge(note.status)}
        <span className="text-xs text-muted-foreground font-mono">v{note.version}</span>

        {isPublished && (
          <button
            type="button"
            onClick={async () => {
              const url = await getPublicNoteUrl(vaultId, note.slug);
              window.open(url, "_blank");
            }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2 bg-transparent border-0 cursor-pointer p-0"
          >
            Buka di Web
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Sisi Kanan: Aksi Kontekstual Sesuai useVaultPermission */}
      <div className="flex items-center gap-2">
        {publishedRevisionContent && publishedRevisionContent !== currentContent && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDiffOpen(true)}
            className="text-xs gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            Bandingkan Diff
          </Button>
        )}

        {/* 1. Mode Viewer (Hanya Baca) */}
        {permissions.isReadOnly && (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground py-1">
            <BookOpen className="w-3.5 h-3.5" />
            Mode Hanya Baca
          </Badge>
        )}

        {/* 2. Mode Contributor (Hanya Bisa Mengajukan Review) */}
        {!permissions.isReadOnly && !permissions.canPublish && permissions.canEdit && note.status !== "in_review" && (
          <Button
            size="sm"
            variant="default"
            disabled={processing}
            onClick={() => {
              setLinterAction("review");
              setLinterOpen(true);
            }}
            className="text-xs gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Ajukan Review
          </Button>
        )}

        {/* 3. Mode Editor / Admin / Owner / Superadmin (Dapat Menerbitkan Langsung) */}
        {permissions.canPublish && (
          <Button
            size="sm"
            variant={isPublished ? "outline" : "default"}
            disabled={processing}
            onClick={() => {
              setLinterAction("publish");
              setLinterOpen(true);
            }}
            className="text-xs gap-1.5"
          >
            {note.status === "in_review" ? (
              <>
                <FileCheck className="w-3.5 h-3.5" />
                Setujui & Terbitkan
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                {isPublished ? "Perbarui Publikasi" : "Publikasikan ke Web"}
              </>
            )}
          </Button>
        )}
      </div>

      <TwoStageLinterModal
        open={linterOpen}
        onOpenChange={setLinterOpen}
        vaultId={vaultId}
        noteId={note.id}
        noteTitle={note.title}
        content={currentContent}
        actionType={linterAction}
        onConfirmPublish={
          linterAction === "publish"
            ? handlePublishExecution
            : handleReviewSubmission
        }
      />

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tinjauan Perubahan Catatan</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden py-2">
            <DiffViewer
              originalContent={publishedRevisionContent}
              modifiedContent={currentContent}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
