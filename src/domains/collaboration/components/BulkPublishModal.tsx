// Ganti baris import di awal file:
import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Progress } from "@/shared/ui/progress";
import { supabase } from "@/integrations/supabase/client"; // <--- TAMBAHKAN IMPORT INI
import {
  BulkPublishService,
  type BulkPublishItemState,
  type BulkPublishProgress,
} from "../services/BulkPublishService";
import { getPublicNoteUrl } from "../utils/publicUrlHelper";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { ClaimUsernameModal } from "@/domains/settings/profile/components/ClaimUsernameModal";
import type { ExplorerNode } from "@/domains/workspace/sidebar/FileExplorerTree";
import {
  Folder,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCw,
  Globe,
  ExternalLink,
  UploadCloud,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export interface BulkPublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderNode: ExplorerNode | null;
  allNodes: ExplorerNode[];
  currentVaultId: string | null;
}

export const BulkPublishModal: React.FC<BulkPublishModalProps> = ({
  open,
  onOpenChange,
  folderNode,
  allNodes,
  currentVaultId,
}) => {
  const { user } = useAuth();

  // State Pipeline
  const [items, setItems] = useState<BulkPublishItemState[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BulkPublishProgress>({
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    percent: 0,
  });

  // Guard: Klaim Username jika pengguna lama belum memilikinya
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [publicReaderUrl, setPublicReaderUrl] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Ganti blok useEffect inisialisasi catatan (sekitar baris 74-90):
  useEffect(() => {
    if (open && folderNode) {
      // Mengumpulkan folder ini beserta seluruh sub-folder dan file di dalamnya
      const allDescendants = BulkPublishService.collectDescendantsRecursive(
        folderNode.id,
        allNodes,
        true, // sertakan folder induk juga
      );
      const initial = BulkPublishService.initializeItems(allDescendants);
      setItems(initial);
      setProgress({
        total: initial.length,
        completed: 0,
        succeeded: 0,
        failed: 0,
        percent: 0,
      });
      setIsRunning(false);
      setPublicReaderUrl(null);
    }
  }, [open, folderNode, allNodes]);

  const hasFailures = useMemo(() => items.some((i) => i.status === "failed"), [items]);
  const hasSuccesses = useMemo(() => items.some((i) => i.status === "success"), [items]);
  const allCompleted = items.length > 0 && items.every((i) => i.status === "success");

  // Periksa apakah pengguna sudah memiliki username sebelum mempublikasikan
  const verifyUsernameBeforeAction = async (): Promise<boolean> => {
    if (!user) {
      toast.error("Anda harus masuk (login) terlebih dahulu.");
      return false;
    }

    const { data: profile } = await (supabase.from("profiles") as any)
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.username) {
      setShowClaimModal(true);
      return false;
    }

    return true;
  };

  // Jalankan Publikasi Massal
  const handleStartPublish = async () => {
    if (!currentVaultId) {
      toast.error("Vault aktif tidak teridentifikasi.");
      return;
    }

    const canProceed = await verifyUsernameBeforeAction();
    if (!canProceed) return;

    setIsRunning(true);
    abortControllerRef.current = new AbortController();

    try {
      const finalItems = await BulkPublishService.runBulkPublish(
        currentVaultId,
        items,
        (prog, currentList) => {
          setProgress(prog);
          setItems([...currentList]);
        },
        abortControllerRef.current.signal,
      );

      // Ambil tautan publik catatan pertama yang berhasil terbit
      const firstSuccess = finalItems.find((i) => i.status === "success" && i.publishedSlug);
      if (firstSuccess && firstSuccess.publishedSlug) {
        const url = await getPublicNoteUrl(currentVaultId, firstSuccess.publishedSlug);
        setPublicReaderUrl(url);
      }

      if (finalItems.every((i) => i.status === "success")) {
        toast.success(`Berhasil mempublikasikan ${finalItems.length} catatan dalam subfolder!`);
      } else {
        const failedCount = finalItems.filter((i) => i.status === "failed").length;
        toast.warning(`${failedCount} catatan mengalami kendala. Anda dapat mencoba lagi.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat memproses publikasi massal.");
    } finally {
      setIsRunning(false);
    }
  };

  // Retry Satu Catatan Spesifik (Inline Retry)
  const handleRetrySingle = async (nodeId: string) => {
    if (!currentVaultId || isRunning) return;

    const itemIndex = items.findIndex((i) => i.nodeId === nodeId);
    if (itemIndex === -1) return;

    const targetItem = items[itemIndex];

    const updated = await BulkPublishService.publishSingleNote(
      currentVaultId,
      targetItem,
      (state) => {
        setItems((prev) => {
          const next = [...prev];
          next[itemIndex] = state;
          return next;
        });
      },
    );

    // Update progress
    setItems((prev) => {
      const next = [...prev];
      next[itemIndex] = updated;

      const completed = next.filter((r) => r.status === "success" || r.status === "failed").length;
      const succeeded = next.filter((r) => r.status === "success").length;
      const failed = next.filter((r) => r.status === "failed").length;
      setProgress({
        total: next.length,
        completed,
        succeeded,
        failed,
        percent: Math.round((completed / next.length) * 100),
      });

      return next;
    });

    if (updated.status === "success") {
      toast.success(`"${updated.title}" berhasil diterbitkan.`);
      if (!publicReaderUrl && updated.publishedSlug) {
        getPublicNoteUrl(currentVaultId, updated.publishedSlug).then(setPublicReaderUrl);
      }
    }
  };

  // Retry Seluruh Catatan yang Gagal
  const handleRetryAllFailed = async () => {
    if (!currentVaultId || isRunning) return;

    setIsRunning(true);
    abortControllerRef.current = new AbortController();

    const failedIndexes = items
      .map((it, idx) => (it.status === "failed" ? idx : -1))
      .filter((idx) => idx !== -1);

    for (const idx of failedIndexes) {
      if (abortControllerRef.current.signal.aborted) break;

      const item = items[idx];
      const updated = await BulkPublishService.publishSingleNote(currentVaultId, item, (state) => {
        setItems((prev) => {
          const next = [...prev];
          next[idx] = state;
          return next;
        });
      });

      setItems((prev) => {
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    }

    setIsRunning(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!isRunning ? onOpenChange(o) : null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[86vh] flex flex-col p-4 sm:p-6 gap-3.5 sm:gap-5 rounded-2xl bg-card text-foreground shadow-2xl border border-border/80 overflow-hidden">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Publikasi Subfolder: {folderNode?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Menerbitkan seluruh catatan turunan ({items.length} berkas) ke portal publik,
              memperbarui versi yang sudah ada, dan mengunggah gambar pendukung secara otomatis.
            </DialogDescription>
          </DialogHeader>

          {/* Progress Bar & Summary Pill */}
          <div className="space-y-2 bg-muted/30 border border-border/80 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {isRunning
                  ? "Sedang mempublikasikan..."
                  : allCompleted
                    ? "Semua catatan berhasil dipublikasikan!"
                    : hasFailures
                      ? "Beberapa catatan gagal dipublikasikan"
                      : "Siap diterbitkan"}
              </span>
              <span className="font-mono font-semibold">
                {progress.succeeded} / {progress.total} Terbit ({progress.percent}%)
              </span>
            </div>
            <Progress value={progress.percent} className="h-2" />
          </div>

          {/* Warning Banner Bila Ada Catatan Gagal */}
          {hasFailures && !isRunning && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div className="flex-1">
                Beberapa catatan gagal dipublikasikan. Anda dapat menekan ikon{" "}
                <strong>Coba Lagi</strong> pada baris terkait atau menggunakan tombol di bawah.
              </div>
            </div>
          )}

          {/* Scrollable Note List dengan Inline Error & Retry */}
          <ScrollArea className="flex-1 min-h-[200px] max-h-[320px] border border-border rounded-lg p-2 bg-background/50">
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.nodeId}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors text-xs border border-border/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.type === "folder" ? (
                      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="truncate font-medium">{item.title}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                      {item.type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "bundling" && (
                      <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        Bundling aset...
                      </span>
                    )}
                    {item.status === "publishing" && (
                      <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        Menerbitkan...
                      </span>
                    )}
                    {item.status === "success" && (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Terbit
                      </Badge>
                    )}
                    {item.status === "failed" && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="text-[10px]">
                          Gagal
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRetrySingle(item.nodeId)}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          title="Coba lagi catatan ini"
                        >
                          <RotateCw className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Tidak ditemukan catatan teks (.md) di dalam folder ini.
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Modal Footer Actions */}

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border mt-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {publicReaderUrl && (
                <a
                  href={publicReaderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 text-primary"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Buka Web Reader</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Button>
                </a>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={isRunning}
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                {allCompleted ? "Selesai" : "Tutup"}
              </Button>

              {hasFailures && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRunning}
                  onClick={handleRetryAllFailed}
                  className="text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
                  <span>Coba Lagi Yang Gagal</span>
                </Button>
              )}

              {!allCompleted && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={isRunning || items.length === 0}
                  onClick={handleStartPublish}
                  className="text-xs gap-1.5 min-w-[130px]"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{hasSuccesses ? "Lanjutkan Publikasi" : "Mulai Publikasi"}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Wajib Klaim Username jika akun belum punya username */}
      <ClaimUsernameModal
        open={showClaimModal}
        onOpenChange={setShowClaimModal}
        onSuccess={() => {
          setShowClaimModal(false);
          toast.success("Username berhasil dibuat! Silakan lanjutkan publikasi.");
        }}
      />
    </>
  );
};
