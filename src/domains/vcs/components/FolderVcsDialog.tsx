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
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  FolderGit2,
  History,
  RotateCcw,
  Clock,
  GitCommit,
  User,
  Folder,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { VcsCloudService } from "../services/VcsCloudService";
import type { VcsCommit } from "../types/vcs";

interface FolderVcsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  folderId: string;
  folderName: string;
  activeBranch?: string;
  childNoteIds?: string[];
  userId?: string;
}

export const FolderVcsDialog: React.FC<FolderVcsDialogProps> = ({
  open,
  onOpenChange,
  vaultId,
  folderId,
  folderName,
  activeBranch = "main",
  childNoteIds = [],
  userId = "current-user",
}) => {
  const [activeTab, setActiveTab] = useState<"history" | "commit">("history");
  const [commits, setCommits] = useState<VcsCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [isReverting, setIsReverting] = useState(false);

  // Ambil riwayat commit yang mencakup folder ini
  const fetchFolderHistory = async () => {
    try {
      setIsLoading(true);
      const allCommits = await VcsCloudService.listCommitHistory({
        vaultId,
        branchId: activeBranch,
        scope: "folder",
      });

      const relevant = allCommits.filter(
        (c) =>
          c.message.toLowerCase().includes(folderName.toLowerCase()) ||
          c.targetPath === folderName ||
          c.commitHash
      );
      setCommits(relevant);
    } catch (err: any) {
      console.warn("Gagal memuat riwayat folder:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFolderHistory();
    }
  }, [open, vaultId, folderId, activeBranch]);

  // Eksekusi commit eksplisit tingkat folder
  const handleCommitFolder = async () => {
    if (!commitMessage.trim()) {
      toast.error("Pesan commit folder wajib diisi.");
      return;
    }

    try {
      setIsLoading(true);
      const items = childNoteIds.map((noteId) => ({
        path: `notes/${noteId}.md`,
        title: noteId,
        content: `# Catatan di folder ${folderName}`,
        itemType: "markdown" as const,
        changeType: "modified" as const,
      }));

      await VcsCloudService.createExplicitCommit({
        vaultId,
        branchId: activeBranch,
        authorId: userId,
        scope: "folder",
        targetPath: folderName,
        message: `[Folder: ${folderName}] ${commitMessage.trim()}`,
        items: items.length > 0 ? items : [
          {
            path: `folders/${folderId}/.gitkeep`,
            title: folderName,
            content: folderName,
            itemType: "folder",
            changeType: "added",
          },
        ],
      });

      toast.success(`Folder '${folderName}' berhasil di-commit!`);
      setCommitMessage("");
      setActiveTab("history");
      fetchFolderHistory();
    } catch (err: any) {
      toast.error(`Gagal commit folder: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Revert non-destruktif tingkat folder
  const handleRevertFolder = async (targetCommit: VcsCommit) => {
    if (
      !confirm(
        `Pulihkan folder '${folderName}' ke commit '${targetCommit.commitHash.substring(0, 7)}'? Sistem akan membuat commit pemulihan baru.`
      )
    ) {
      return;
    }

    try {
      setIsReverting(true);
      await VcsCloudService.revertCommit({
        targetCommitId: targetCommit.id,
        vaultId,
        branchId: activeBranch,
        authorId: userId,
      });

      toast.success(`Folder '${folderName}' berhasil dipulihkan secara non-destruktif!`);
      fetchFolderHistory();
    } catch (err: any) {
      toast.error(`Gagal melakukan rollback: ${err.message}`);
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  Version Control Folder: {folderName}
                  <Badge variant="outline" className="text-xs font-normal">
                    {childNoteIds.length} berkas
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Cabang Aktif: <span className="font-mono text-foreground font-medium">{activeBranch}</span>
                </DialogDescription>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="h-8 bg-muted/60 p-0.5 border border-border/50">
                <TabsTrigger value="history" className="text-xs h-7 px-2.5 gap-1.5">
                  <History className="w-3.5 h-3.5" /> Riwayat
                </TabsTrigger>
                <TabsTrigger value="commit" className="text-xs h-7 px-2.5 gap-1.5">
                  <GitCommit className="w-3.5 h-3.5" /> Commit Folder
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <div className="p-4">
          {activeTab === "history" ? (
            <ScrollArea className="h-80 pr-2">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs gap-2 py-12">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Memuat riwayat folder...</span>
                </div>
              ) : commits.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 py-12">
                  <Folder className="w-8 h-8 text-muted-foreground/40" />
                  <span>Belum ada commit khusus yang tercatat untuk folder ini.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {commits.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-border/60 bg-card hover:bg-accent/40 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-primary">
                            {c.commitHash.substring(0, 7)}
                          </span>
                          <span className="font-medium text-foreground">{c.message}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {c.author?.displayName || "Pengguna"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 gap-1.5"
                        disabled={isReverting}
                        onClick={() => handleRevertFolder(c)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert Folder
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Pesan Commit Folder
                </label>
                <Input
                  placeholder="Contoh: Perbarui seluruh referensi bab di folder ini"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="text-xs h-9"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-xs text-muted-foreground">
                Commit ini akan membungkus status seluruh {childNoteIds.length} berkas catatan di dalam subfolder <strong>{folderName}</strong> menjadi satu snapshot terpadu.
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  className="text-xs h-8 gap-1.5"
                  disabled={isLoading || !commitMessage.trim()}
                  onClick={handleCommitFolder}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  Commit {childNoteIds.length} Berkas
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-end">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};