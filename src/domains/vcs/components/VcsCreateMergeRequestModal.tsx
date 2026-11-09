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
import { Textarea } from '@/shared/ui/textarea';
import { GitPullRequest, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VcsCloudService } from '../services/VcsCloudService';
import { useVcsStore } from '../stores/useVcsStore';

interface VcsCreateMergeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  userId: string;
  onCreated?: () => void;
}

export const VcsCreateMergeRequestModal: React.FC<VcsCreateMergeRequestModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  userId,
  onCreated,
}) => {
  const { branches, activeBranchId } = useVcsStore();
  const defaultTarget = branches.find((b) => b.isDefault)?.id || branches[0]?.id || '';

  const [sourceBranchId, setSourceBranchId] = useState(activeBranchId || '');
  const [targetBranchId, setTargetBranchId] = useState(defaultTarget);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Judul merge request wajib diisi');
      return;
    }
    if (sourceBranchId === targetBranchId) {
      toast.error('Cabang sumber dan cabang tujuan tidak boleh sama');
      return;
    }

    setIsSubmitting(true);
    try {
      await VcsCloudService.createMergeRequest({
        vaultId,
        sourceBranchId,
        targetBranchId,
        title: title.trim(),
        description: description.trim() || undefined,
        authorId: userId,
      });

      toast.success('Permintaan penggabungan cabang (Merge Request) berhasil diajukan');
      setTitle('');
      setDescription('');
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengajukan merge request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GitPullRequest className="w-4 h-4 text-primary" />
            Ajukan Merge Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Pemilihan Cabang Sumber -> Tujuan */}
          <div className="grid grid-cols-5 items-center gap-2 bg-muted/30 p-2.5 rounded border border-border/50">
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground block mb-1">Sumber (Dari)</label>
              <select
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
                className="w-full h-7 rounded border border-border bg-background px-2 text-xs font-mono"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center pt-3">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground block mb-1">Tujuan (Ke)</label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full h-7 rounded border border-border bg-background px-2 text-xs font-mono"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isProtected ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1 font-medium">Judul</label>
            <Input
              placeholder="contoh: Integrasi catatan riset ke main"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs font-sans"
              autoFocus
            />
          </div>

          <div>
            <label className="text-muted-foreground block mb-1 font-medium">Deskripsi Perubahan (Opsional)</label>
            <Textarea
              placeholder="Rangkuman perubahan penting atau catatan untuk peninjau..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-20 text-xs font-sans resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="h-8 text-xs gap-1.5">
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
            Ajukan Permintaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};