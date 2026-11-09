import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { GitBranch, Check, Plus, Shield, ShieldAlert, Archive } from "lucide-react";
import { useVcsStore } from "../stores/useVcsStore";
import { VcsBranchStashService } from "../services/VcsBranchStashService";
import { useNodeStore, useVaultStore } from "@/shared/stores";
import { toast } from "sonner";

interface BranchSelectorProps {
  onCreateBranchClick?: () => void;
  className?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  onCreateBranchClick,
  className,
}) => {
  const { branches, activeBranchId, activeBranchName, setActiveBranch } = useVcsStore();
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const nodes = useNodeStore((s) => s.nodes);

  const handleSwitchBranch = async (targetBranchId: string, targetBranchName: string) => {
    if (targetBranchId === activeBranchId || !currentVaultId) return;

    try {
      // 1. Smart Auto-Stash: Simpan dokumen yang belum di-commit di branch aktif saat ini (P10)
      const dirtyNodes = nodes
        .filter((n) => n.type === "file" && n.content)
        .map((n) => ({
          noteId: n.id,
          path: `${n.name}.md`,
          title: n.name,
          content: n.content,
        }));

      if (activeBranchId && dirtyNodes.length > 0) {
        await VcsBranchStashService.stashBranchChanges({
          vaultId: currentVaultId,
          branchId: activeBranchId,
          stashedAt: Date.now(),
          items: dirtyNodes,
        });
      }

      // 2. Berpindah ke branch baru
      setActiveBranch(targetBranchId, targetBranchName);

      // 3. Cek apakah branch tujuan memiliki stash sebelumnya untuk di-restore
      const restoredStash = await VcsBranchStashService.popBranchStash(
        currentVaultId,
        targetBranchId,
      );

      if (restoredStash && restoredStash.items.length > 0) {
        toast.info(
          `Beralih ke branch "${targetBranchName}". Auto-stash (${restoredStash.items.length} perubahan) dipulihkan.`,
        );
      } else {
        toast.success(`Beralih ke branch "${targetBranchName}"`);
      }
    } catch (err: any) {
      toast.error(`Gagal beralih branch: ${err.message}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 px-2.5 text-xs font-mono gap-1.5 border-sidebar-border bg-sidebar hover:bg-sidebar-accent transition-colors ${className || ""}`}
        >
          <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[120px] font-medium">{activeBranchName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 shadow-lg">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
          Cabang Vault (Branches)
        </DropdownMenuLabel>

        {branches.map((b) => {
          const isSelected = b.id === activeBranchId;
          return (
            <DropdownMenuItem
              key={b.id}
              onClick={() => handleSwitchBranch(b.id, b.name)}
              className="text-xs flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 shrink-0" />
                )}
                <span
                  className={isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}
                >
                  {b.name}
                </span>
                {b.isDefault && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                    default
                  </Badge>
                )}
              </div>
              {b.isProtected && (
                <span title="Protected Branch" className="inline-flex items-center">
                  <Shield className="w-3 h-3 text-amber-500 shrink-0 ml-1" />
                </span>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        {onCreateBranchClick && (
          <DropdownMenuItem
            onClick={onCreateBranchClick}
            className="text-xs text-primary font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Buat Cabang Baru...
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
