import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { GitCommit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VcsCloudService } from '@/domains/vcs/services/VcsCloudService';
import { VcsMicroRevisionService } from '@/domains/vcs/services/VcsMicroRevisionService';
import { VcsSyncQueueService } from '@/domains/vcs/services/VcsSyncQueueService';
import { useVcsStore } from '@/domains/vcs/stores/useVcsStore';

interface VcsQuickCommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  noteId: string;
  noteTitle: string;
  currentContent: string;
  userId: string;
}

export const VcsQuickCommitModal: React.FC<VcsQuickCommitModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  noteId,
  noteTitle,
  currentContent,
  userId,
}) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { activeBranchId, activeBranchName } = useVcsStore();

  const handleCommit = async () => {
    if (!message.trim()) {
      toast.error('Pesan commit wajib diisi');
      return;
    }
    if (!activeBranchId) {
      toast.error('Pilih branch aktif terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      if (navigator.onLine) {
        await VcsCloudService.createExplicitCommit({
          vaultId,
          branchId: activeBranchId,
          message: message.trim(),
          authorId: userId,
          scope: 'file',
          targetPath: `${noteTitle}.md`,
          items: [
            {
              path: `${noteTitle}.md`,
              title: noteTitle,
              content: currentContent,
              itemType: 'markdown',
              changeType: 'modified',
            },
          ],
        });

        // Squash micro-revisions lokal dokumen setelah berhasil commit ke cloud
        await VcsMicroRevisionService.squashRevisionsForNote(vaultId, noteId);
        toast.success(`Commit berhasil disimpan ke branch "${activeBranchName}"`);
      } else {
        // Enqueue ke antrean offline jika koneksi internet terputus
        await VcsSyncQueueService.enqueue({
          vaultId,
          branchId: activeBranchId,
          commitData: {
            id: '',
            vaultId,
            branchId: activeBranchId,
            commitHash: '',
            parentCommitId: null,
            message: message.trim(),
            scope: 'file',
            targetPath: `${noteTitle}.md`,
            authorId: userId,
            isRevert: false,
            revertedCommitId: null,
            createdAt: new Date().toISOString(),
          },
          items: [
            {
              id: '',
              commitId: '',
              path: `${noteTitle}.md`,
              blobHash: '',
              itemType: 'markdown',
              title: noteTitle,
              changeType: 'modified',
              sizeBytes: currentContent.length,
            },
          ],
          blobs: [
            {
              blobHash: '',
              contentText: currentContent,
              mimeType: 'text/markdown',
              sizeBytes: currentContent.length,
            },
          ],
        });

        toast.info('Tersimpan di antrean offline. Akan disinkronkan saat online kembali.');
      }

      setMessage('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan commit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GitCommit className="w-4 h-4 text-primary" />
            Commit Dokumen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground bg-muted/40 p-2 rounded border border-border/50">
            <span>Target Branch:</span>
            <Badge variant="outline" className="font-mono text-[11px] bg-background">
              {activeBranchName}
            </Badge>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1 font-medium">Pesan Commit</label>
            <Input
              placeholder={`Contoh: Perbarui catatan "${noteTitle}"`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-8 text-xs font-sans"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCommit();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Batal
          </Button>
          <Button size="sm" onClick={handleCommit} disabled={isSubmitting} className="h-8 text-xs gap-1.5">
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCommit className="w-3.5 h-3.5" />}
            Simpan Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};