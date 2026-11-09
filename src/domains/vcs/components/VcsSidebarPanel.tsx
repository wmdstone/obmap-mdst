import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  History,
  Plus,
  Shield,
  RotateCcw,
  CheckCircle,
  Download,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { useVcsStore } from "../stores/useVcsStore";
import { VcsCloudService } from "../services/VcsCloudService";
import { BranchSelector } from "./BranchSelector";
import { VcsCreateBranchModal } from "./VcsCreateBranchModal";
import { VcsCreateMergeRequestModal } from "./VcsCreateMergeRequestModal";
import { VcsCommit, VcsMergeRequest } from "../types/vcs";
import { toast } from "sonner";

export const VcsSidebarPanel: React.FC = () => {
  const { user } = useAuth();
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const permissions = useVaultPermission();
  const canManage =
    permissions.role === "owner" ||
    permissions.role === "superadmin" ||
    permissions.role === "admin";

  const { branches, activeBranchId, activeBranchName, loadBranches } = useVcsStore();

  const [activeTab, setActiveTab] = useState<"branches" | "history" | "merges">("branches");
  const [commits, setCommits] = useState<VcsCommit[]>([]);
  const [mergeRequests, setMergeRequests] = useState<VcsMergeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Muat data saat tab aktif berubah
  useEffect(() => {
    if (!currentVaultId || !user) return;
    loadBranches(currentVaultId, user.id);
  }, [currentVaultId, user?.id]);

  useEffect(() => {
    if (!currentVaultId || !activeBranchId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === "history") {
          const list = await VcsCloudService.listCommitHistory({
            vaultId: currentVaultId,
            branchId: activeBranchId,
            limit: 40,
          });
          setCommits(list);
        }
      } catch (err) {
        console.warn("Gagal memuat riwayat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab, currentVaultId, activeBranchId]);

  const handleRevertCommit = async (commitId: string) => {
    if (!currentVaultId || !activeBranchId || !user) return;
    if (
      !confirm(
        "Revert commit ini? Sistem akan membuat commit baru yang mengembalikan konten ke versi tersebut.",
      )
    ) {
      return;
    }

    try {
      await VcsCloudService.revertCommit({
        targetCommitId: commitId,
        vaultId: currentVaultId,
        branchId: activeBranchId,
        authorId: user.id,
      });

      toast.success("Revert berhasil dieksekusi sebagai commit baru");
      const updated = await VcsCloudService.listCommitHistory({
        vaultId: currentVaultId,
        branchId: activeBranchId,
        limit: 40,
      });
      setCommits(updated);
    } catch (err: any) {
      toast.error(err.message || "Gagal merevert commit");
    }
  };

  const handleExportAuditTrail = () => {
    if (commits.length === 0) {
      toast.info("Belum ada riwayat commit untuk diekspor");
      return;
    }

    const jsonStr = JSON.stringify(commits, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vcs-audit-${activeBranchName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit trail berhasil diunduh sebagai JSON");
  };

  if (!currentVaultId || !user) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        Pilih atau buka sebuah vault terlebih dahulu untuk mengaktifkan Version Control.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Header Cabang Aktif */}
      <div className="p-2.5 border-b border-sidebar-border bg-sidebar-accent/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BranchSelector onCreateBranchClick={() => setIsBranchModalOpen(true)} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsBranchModalOpen(true)}
          className="h-7 text-xs px-2 shrink-0 gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Branch
        </Button>
      </div>

      {/* Tabs Pusat Kendali */}
      <Tabs
        value={activeTab}
        onValueChange={(v: any) => setActiveTab(v)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-2 pt-1.5 border-b border-sidebar-border">
          <TabsList className="grid grid-cols-3 h-7 w-full p-0.5 bg-sidebar-accent/40">
            <TabsTrigger value="branches" className="text-[11px] px-1 py-0.5">
              Branches
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] px-1 py-0.5">
              History
            </TabsTrigger>
            <TabsTrigger value="merges" className="text-[11px] px-1 py-0.5">
              Merges
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: BRANCHES */}
        <TabsContent value="branches" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full p-2.5">
            <div className="space-y-1.5">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className={`p-2 rounded-md border text-xs transition-colors flex items-center justify-between ${
                    b.id === activeBranchId
                      ? "border-primary/40 bg-primary/5"
                      : "border-sidebar-border/60 bg-sidebar/50 hover:bg-sidebar-accent/30"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium truncate">{b.name}</span>
                      {b.isDefault && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          default
                        </Badge>
                      )}
                      {b.isProtected && (
                        <span title="Protected" className="inline-flex items-center">
                          <Shield className="w-3 h-3 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Dibuat {new Date(b.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {b.id !== activeBranchId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => useVcsStore.getState().setActiveBranch(b.id, b.name)}
                      className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                    >
                      Beralih
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* TAB 2: COMMIT HISTORY */}
        <TabsContent value="history" className="flex-1 min-h-0 m-0 flex flex-col">
          <div className="p-2 border-b border-sidebar-border flex items-center justify-between shrink-0">
            <span className="text-[11px] text-muted-foreground">
              {commits.length} commit di{" "}
              <span className="font-mono font-medium">{activeBranchName}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportAuditTrail}
              className="h-6 text-[11px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
              title="Ekspor Jejak Audit JSON"
            >
              <Download className="w-3 h-3" />
              Audit
            </Button>
          </div>

          <ScrollArea className="flex-1 p-2.5">
            {isLoading ? (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Memuat riwayat...
              </div>
            ) : commits.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Belum ada explicit commit pada cabang ini.
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 rounded-md border border-sidebar-border bg-sidebar/50 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-medium text-foreground break-words line-clamp-2">
                        {c.message}
                      </span>
                      <Badge variant="outline" className="font-mono text-[9px] px-1 shrink-0">
                        {c.commitHash.substring(0, 7)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-sidebar-border/40">
                      <span>{c.author?.displayName || "Pengguna"}</span>
                      <div className="flex items-center gap-1.5">
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        {canManage && !c.isRevert && (
                          <button
                            onClick={() => handleRevertCommit(c.id)}
                            className="text-amber-500 hover:text-amber-400 p-0.5 rounded transition-colors"
                            title="Revert Commit Ini"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* TAB 3: MERGE REQUESTS */}
        <TabsContent value="merges" className="flex-1 min-h-0 m-0 flex flex-col p-2.5">
          <div className="mb-2">
            <Button
              size="sm"
              onClick={() => setIsMergeModalOpen(true)}
              className="w-full h-7 text-xs gap-1.5"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              Ajukan Merge Request
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center p-4 border border-dashed border-sidebar-border rounded-md">
            Gunakan tombol di atas untuk mengajukan penggabungan cabang ke cabang utama (main).
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Pembuatan Cabang */}
      <VcsCreateBranchModal
        open={isBranchModalOpen}
        onOpenChange={setIsBranchModalOpen}
        vaultId={currentVaultId}
        userId={user.id}
        canManageProtection={canManage}
      />

      {/* Modal Pengajuan Merge Request */}
      <VcsCreateMergeRequestModal
        open={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        vaultId={currentVaultId}
        userId={user.id}
      />
    </div>
  );
};
