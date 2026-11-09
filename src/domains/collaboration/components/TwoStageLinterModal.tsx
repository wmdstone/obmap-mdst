import React, { useState, useEffect } from "react";
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
import {
  AssetBundlerService,
  PrePublishAuditResult,
} from "@/domains/vault/services/AssetBundlerService";
import { CheckCircle2, AlertTriangle, Image as ImageIcon, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface TwoStageLinterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  noteId: string;
  noteTitle: string;
  content: string;
  onConfirmPublish: (bundledContent: string) => Promise<void>;
  actionType?: "publish" | "review";
}

export const TwoStageLinterModal: React.FC<TwoStageLinterModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  noteId,
  noteTitle,
  content,
  onConfirmPublish,
  actionType = "publish",
}) => {
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(true);
  const [auditResult, setAuditResult] = useState<PrePublishAuditResult | null>(null);

  useEffect(() => {
    if (open) {
      setAuditing(true);
      AssetBundlerService.auditNoteForPublishing(vaultId, content)
        .then((result) => {
          setAuditResult(result);
        })
        .finally(() => setAuditing(false));
    }
  }, [open, vaultId, content]);

  const handleExecute = async () => {
    setLoading(true);
    try {
      // 1. Bundel dan unggah aset media lokal ke Supabase Storage (vault-media)
      const { bundledContent } = await AssetBundlerService.bundleAndUploadAssets(
        vaultId,
        noteId,
        content
      );

      // 2. Jalankan publikasi ke database
      await onConfirmPublish(bundledContent);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[TwoStageLinter] Gagal mempublikasikan:", err);
      toast.error(err?.message || "Gagal memproses publikasi. Pastikan Anda telah masuk (login).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Verifikasi Pra-Publikasi (Linter Gate)</span>
          </DialogTitle>
          <DialogDescription>
            Pemeriksaan otomatis aset media dan integritas tautan untuk catatan{" "}
            <strong>"{noteTitle}"</strong>.
          </DialogDescription>
        </DialogHeader>

        {auditing ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memindai media dan tautan catatan...</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* 1. Status Gambar & Media Lokal */}
            <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>Aset Media Lokal</span>
                </div>
                <Badge variant={auditResult?.localAssetsCount ? "secondary" : "outline"}>
                  {auditResult?.localAssetsCount ?? 0} Aset
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {auditResult?.localAssetsCount
                  ? `${auditResult.localAssetsCount} gambar lokal akan diunggah otomatis ke Cloud Storage publik (vault-media).`
                  : "Semua media telah tersimpan di cloud atau tidak ada gambar lokal."}
              </p>
            </div>

            {/* 2. Status Wikilinks */}
            <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  <span>Audit Tautan Internal (Wikilinks)</span>
                </div>
                <Badge
                  variant={auditResult?.ghostLinksCount ? "outline" : "default"}
                  className={auditResult?.ghostLinksCount ? "text-amber-500 border-amber-500/30" : ""}
                >
                  {auditResult?.ghostLinksCount
                    ? `${auditResult.ghostLinksCount} Tautan Draf`
                    : "Semua Tautan Terbit"}
                </Badge>
              </div>
              {auditResult?.ghostLinksCount ? (
                <div className="text-xs text-amber-500 flex items-start gap-1.5 mt-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Tautan ke catatan yang belum terbit akan ditampilkan redup (*graceful ghost link*)
                    tanpa memicu 404 pada portal pembaca.
                  </span>
                </div>
              ) : (
                <div className="text-xs text-emerald-500 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tidak ada tautan rusak yang terdeteksi.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleExecute} disabled={loading || auditing}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {actionType === "publish" ? "Unggah Aset & Publikasikan" : "Kirim untuk Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};