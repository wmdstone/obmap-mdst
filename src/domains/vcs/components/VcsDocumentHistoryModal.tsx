import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/global/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/global/ui/tabs';
import { Button } from '@/global/ui/button';
import { Badge } from '@/global/ui/badge';
import { ScrollArea } from '@/global/ui/scroll-area';
import { DiffViewer } from '@/domains/collaboration/components/DiffViewer';
import { VcsCloudService } from '@/domains/vcs/services/VcsCloudService';
import { VcsMicroRevisionService } from '@/domains/vcs/services/VcsMicroRevisionService';
import { VcsCommit, LocalMicroRevision } from '@/domains/vcs/types/vcs';
import { useVcsStore } from '@/domains/vcs/stores/useVcsStore';
import { History, Cloud, HardDrive, RotateCcw, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VcsDocumentHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  noteId: string;
  noteTitle: string;
  currentContent: string;
  onRestoreContent: (restoredContent: string) => void;
}

export const VcsDocumentHistoryModal: React.FC<VcsDocumentHistoryModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  noteId,
  noteTitle,
  currentContent,
  onRestoreContent,
}) => {
  const { activeBranchId } = useVcsStore();
  const [cloudCommits, setCloudCommits] = useState<VcsCommit[]>([]);
  const [microRevisions, setMicroRevisions] = useState<LocalMicroRevision[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mode pratinjau diff
  const [diffViewContent, setDiffViewContent] = useState<string | null>(null);
  const [diffLabel, setDiffLabel] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setDiffViewContent(null);
      return;
    }

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        // 1. Ambil micro-revisi lokal dari IndexedDB
        const localRevs = await VcsMicroRevisionService.getNoteRevisions(vaultId, noteId);
        setMicroRevisions(localRevs);

        // 2. Ambil commit cloud jika online dan branch ada
        if (activeBranchId && navigator.onLine) {
          const commits = await VcsCloudService.listCommitHistory({
            vaultId,
            branchId: activeBranchId,
            scope: 'file',
            targetPath: `${noteTitle}.md`,
            limit: 30,
          });
          setCloudCommits(commits);
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat dokumen:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [open, vaultId, noteId, noteTitle, activeBranchId]);

  const handleInspectCommit = async (commit: VcsCommit) => {
    setIsLoading(true);
    try {
      const items = await VcsCloudService.getCommitItems(commit.id);
      const targetItem = items.find((i) => i.path === `${noteTitle}.md`) || items[0];
      if (targetItem) {
        const text = (await VcsCloudService.getBlobContent(targetItem.blobHash)) || '';
        setDiffViewContent(text);
        setDiffLabel(`Commit: ${commit.message} (${commit.commitHash.substring(0, 7)})`);
      } else {
        toast.error('Konten catatan tidak ditemukan dalam commit ini');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat pratinjau commit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = (content: string, source: string) => {
    onRestoreContent(content);
    toast.success(`Konten dipulihkan dari ${source}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[75vh] flex flex-col p-4">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="w-4 h-4 text-primary" />
              Riwayat Versi: {noteTitle}
            </DialogTitle>
            {diffViewContent !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDiffViewContent(null)}
                className="h-7 text-xs gap-1 text-muted-foreground"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Daftar
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Jika sedang mode diff pratinjau */}
        {diffViewContent !== null ? (
          <div className="flex-1 flex flex-col min-h-0 pt-2">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-muted-foreground truncate max-w-sm">
                {diffLabel}
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleRestore(diffViewContent, diffLabel)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Pulihkan Versi Ini
              </Button>
            </div>
            <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
              <DiffViewer
                originalContent={diffViewContent}
                modifiedContent={currentContent}
                originalLabel="Versi Dipilih (Riwayat)"
                modifiedLabel="Versi Saat Ini (Editor)"
                className="h-full border-none shadow-none"
              />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="cloud" className="flex-1 flex flex-col min-h-0 pt-2">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="cloud" className="text-xs gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                Cloud Commits ({cloudCommits.length})
              </TabsTrigger>
              <TabsTrigger value="local" className="text-xs gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                Micro-Revisi Lokal ({microRevisions.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB: Cloud Explicit Commits */}
            <TabsContent value="cloud" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-[52vh] pr-2">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Memuat riwayat cloud...
                  </div>
                ) : cloudCommits.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    Belum ada explicit commit untuk catatan ini pada branch aktif.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cloudCommits.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-md border border-border/50 bg-card hover:bg-muted/40 transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{c.message}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {c.commitHash.substring(0, 7)}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{c.author?.displayName || 'Kolaborator'}</span>
                            <span>•</span>
                            <span>{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInspectCommit(c)}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Bandingkan
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* TAB: Local Micro-Revisions */}
            <TabsContent value="local" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-[52vh] pr-2">
                {microRevisions.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    Belum ada riwayat snapshot lokal tersimpan (retensi 6 hari).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {microRevisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2.5 rounded-md border border-border/50 bg-card hover:bg-muted/40 transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            Snapshot Otomatis ({new Date(rev.timestamp).toLocaleTimeString()})
                          </span>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(rev.timestamp).toLocaleDateString()} • {rev.content.length} karakter
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDiffViewContent(rev.content);
                            setDiffLabel(`Snapshot Lokal: ${new Date(rev.timestamp).toLocaleString()}`);
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Bandingkan
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};