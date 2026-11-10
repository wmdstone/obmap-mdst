import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/global/ui/dialog';
import { Button } from '@/global/ui/button';
import { Input } from '@/global/ui/input';
import { GitBranch, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VcsCloudService } from '@/domains/vcs/services/VcsCloudService';
import { useVcsStore } from '@/domains/vcs/stores/useVcsStore';

interface VcsCreateBranchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  userId: string;
  canManageProtection?: boolean;
}

export const VcsCreateBranchModal: React.FC<VcsCreateBranchModalProps> = ({
  open,
  onOpenChange,
  vaultId,
  userId,
  canManageProtection = false,
}) => {
  const [name, setName] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [autoDeleteOnMerge, setAutoDeleteOnMerge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loadBranches, setActiveBranch } = useVcsStore();

  const handleCreate = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) {
      toast.error('Nama branch wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const newBranch = await VcsCloudService.createBranch({
        vaultId,
        name: trimmed,
        isProtected: canManageProtection ? isProtected : false,
        autoDeleteOnMerge,
        createdBy: userId,
      });

      await loadBranches(vaultId, userId);
      setActiveBranch(newBranch.id, newBranch.name);
      toast.success(`Cabang "${newBranch.name}" berhasil dibuat dan diaktifkan`);
      setName('');
      setIsProtected(false);
      setAutoDeleteOnMerge(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GitBranch className="w-4 h-4 text-primary" />
            Buat Cabang Baru (New Branch)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="text-muted-foreground block mb-1 font-medium">Nama Cabang</label>
            <Input
              placeholder="contoh: fitur-alur-kerja atau riset-ai"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Format otomatis: huruf kecil tanpa spasi (dipisahkan tanda hubung).
            </span>
          </div>

          {canManageProtection && (
            <div className="flex items-center justify-between p-2.5 rounded border border-border/50 bg-muted/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  Kunci Cabang (Branch Protection)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Hanya Admin & Owner yang dapat menggabungkan perubahan ke cabang ini.
                </div>
              </div>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 rounded border border-border/50 bg-muted/20">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">Hapus Otomatis Pasca-Merge</div>
              <div className="text-[11px] text-muted-foreground">
                Arsipkan cabang ini secara otomatis setelah berhasil digabungkan.
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoDeleteOnMerge}
              onChange={(e) => setAutoDeleteOnMerge(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Batal
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={isSubmitting} className="h-8 text-xs gap-1.5">
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
            Buat Cabang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};