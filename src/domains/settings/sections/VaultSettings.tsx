/**
 * Vault Management section of the Unified Settings Hub.
 * Mengorganisasikan pengelolaan vault ke dalam Sub-Tabs:
 * [ Daftar Vault ] • [ Backup & Riwayat ] • [ Impor & Ekspor ]
 * Dilengkapi Sub-Filter Peran: [ Vault Saya ] & [ Dibagikan ke Saya ]
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Plus,
  Database,
  History,
  FileArchive,
  Cloud,
  Laptop,
  Users,
  FolderHeart,
} from "lucide-react";
import { Button } from "@/global/ui/button";
import { Badge } from "@/global/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/global/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/global/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/global/ui/tabs";
import { toast } from "sonner";
import { VaultCard } from "@/domains/vault/components/VaultCard";
import { VaultModeSelector } from "@/domains/vault/components/VaultModeSelector";
import { VaultBackupPanel } from "@/domains/vault/components/VaultBackupPanel";
import { VaultBackupSettingsContent } from "@/domains/vault/components/VaultBackupSettings";
import { ExportToFileSystem } from "@/domains/vault/components/ExportToFileSystem";
import { ImportExportPanel } from "@/domains/workspace/components/ImportExportPanel";
import { useVaultSync } from "@/domains/vault/hooks/useVaultSync";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { supabase } from "@/global/api/untypedSupabase";
import { VaultMemberService } from "@/domains/vault/services/VaultMemberService";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import type { VaultLocation, BackupConfig } from "@/domains/vault/types";
import type { VaultMemberRole } from "@/types/collaboration";

// Tipe Snapshot Backup Lokal
interface BackupSnapshot {
  id: string;
  vaultId: string;
  timestamp: number;
  nodeCount: number;
  linkCount: number;
  description: string;
}

interface VaultEntry {
  id: string;
  name: string;
  location: VaultLocation;
  cloudSync: boolean;
  nodeCount: number;
  linkCount: number;
  lastModified: number;
  stats?: {
    fileCount: number;
    folderCount: number;
    tagCount: number;
    orphanedNodes: number;
    avgConnections: number;
  };
}

// Metadata lokasi vault yang valid ('folder' | 'cloud')
const LOCATION_META: Record<
  VaultLocation,
  { label: string; icon: typeof Database; desc: string }
> = {
  folder: {
    label: "Local folder",
    icon: Laptop,
    desc: "Tersimpan langsung di filesystem perangkat Anda.",
  },
  cloud: {
    label: "Cloud vault",
    icon: Cloud,
    desc: "Tersimpan di akun cloud dan disinkronkan ke seluruh perangkat.",
  },
};

export function VaultSettings() {
  const vaultManager = getVaultManager();
  const { user } = useAuth();
  const { isAuthenticated, syncVaultToCloud } = useVaultSync();

  const [activeTab, setActiveTab] = useState<string>("vaults");
  const [vaultFilter, setVaultFilter] = useState<"mine" | "shared">("mine");
  const [vaults, setVaults] = useState<VaultEntry[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [backupVaultId, setBackupVaultId] = useState<string | null>(null);
  const [settingsVaultId, setSettingsVaultId] = useState<string | null>(null);

  // Pemetaan peran pengguna untuk setiap vault: [vaultId]: 'owner' | VaultMemberRole
  const [vaultRoles, setVaultRoles] = useState<Record<string, VaultMemberRole | "owner" | "none">>({});

  const [backups, setBackups] = useState<Record<string, BackupSnapshot[]>>({});
  const [backupConfigs, setBackupConfigs] = useState<Record<string, BackupConfig>>({});

  const loadVaults = useCallback(async () => {
    const all = vaultManager.getAllVaults();
    const active = vaultManager.getActiveVault();

    setVaults(
      all.map((v) => {
        const graphData = vaultManager.getVaultGraphData(v.id) || {
          nodes: [],
          links: [],
        };
        return {
          id: v.id,
          name: v.name,
          location: v.location,
          cloudSync: v.cloudSync ?? false,
          nodeCount: graphData.nodes.length,
          linkCount: graphData.links.length,
          lastModified: v.lastModified,
          stats: vaultManager.getVaultStats(v.id) || undefined,
        };
      })
    );
    setActiveVaultId(active?.id || null);

    // Muat data peran dari cloud jika pengguna login
    if (user) {
      try {
        const rolesMap: Record<string, VaultMemberRole | "owner" | "none"> = {};

        // 1. Cek kepemilikan mutlak di user_vaults (Owner selalu prioritas tertinggi)
        const { data: ownedVaults } = await supabase
          .from("user_vaults")
          .select("id, user_id")
          .eq("user_id", user.id);

        (ownedVaults || []).forEach((ov) => {
          rolesMap[ov.id] = "owner";
        });

        // 2. Cek keanggotaan kolaborasi di vault_members (Hanya untuk vault bukan milik sendiri)
        const { data: memberRows } = await supabase
          .from("vault_members")
          .select("vault_id, role")
          .eq("user_id", user.id);

        (memberRows || []).forEach((mr) => {
          if (!rolesMap[mr.vault_id]) {
            rolesMap[mr.vault_id] = mr.role as VaultMemberRole;
          }
        });

        setVaultRoles(rolesMap);
      } catch (err) {
        console.warn("[VaultSettings] Gagal memuat peran vault:", err);
      }
    }


    const backupData: Record<string, BackupSnapshot[]> = {};
    const configData: Record<string, BackupConfig> = {};
    for (const vault of all) {
      try {
        backupData[vault.id] = (await vaultManager.getBackups(vault.id)) as BackupSnapshot[];
        configData[vault.id] = vaultManager.getBackupConfig(vault.id);
      } catch (err) {
        console.warn(`[VaultSettings] Gagal memuat backup vault ${vault.id}:`, err);
        backupData[vault.id] = [];
      }
    }
    setBackups(backupData);
    setBackupConfigs(configData);
  }, [vaultManager, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await vaultManager.initialize();
        if (cancelled) return;
        setIsInitialized(true);
        await loadVaults();
      } catch (err) {
        console.error("[VaultSettings] Inisialisasi gagal:", err);
        toast.error("Gagal menginisialisasi sistem vault");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultManager, loadVaults]);

  const activeVault = vaults.find((v) => v.id === activeVaultId) || null;

  // Filter Vault: "Vault Saya" vs "Dibagikan ke Saya"
  const filteredVaults = useMemo(() => {
    return vaults.filter((vault) => {
      const role = vaultRoles[vault.id];
      const isLocal = vault.location === "folder";

      if (vaultFilter === "mine") {
        // Vault lokal selalu milik akun; pada cloud berstatus owner atau default
        return isLocal || role === "owner" || !role;
      } else {
        // Dibagikan ke saya: cloud vault tempat kita terdaftar sebagai anggota kolaborator
        return !isLocal && role && role !== "owner" && role !== "none";
      }
    });
  }, [vaults, vaultRoles, vaultFilter]);

  const handleCreateCloudVault = async (name: string) => {
    const vaultId = await vaultManager.createCloudVault(name);
    vaultManager.startAutoBackup(vaultId);
    await loadVaults();
    if (isAuthenticated) await syncVaultToCloud(vaultId);
    toast.success(`Vault "${name}" berhasil dibuat`);
    return vaultId;
  };

  const handleCreateFolderVault = async (
    handle: FileSystemDirectoryHandle,
    name: string,
    cloudSync: boolean
  ) => {
    const vaultId = await vaultManager.openFolderVault(handle, {
      createSubfolder: name,
      cloudSync: cloudSync && isAuthenticated,
    });
    vaultManager.startAutoBackup(vaultId);
    await loadVaults();
    if (cloudSync && isAuthenticated) await syncVaultToCloud(vaultId);
    toast.success(`Vault "${name}" dibuat di folder lokal Anda`);
    return vaultId;
  };

  const handleOpenFolderVault = async (handle: FileSystemDirectoryHandle) => {
    const vaultId = await vaultManager.openFolderVault(handle);
    vaultManager.startAutoBackup(vaultId);
    await loadVaults();
    toast.success("Vault berhasil dibuka");
    return vaultId;
  };

  const handleSelectVault = async (vaultId: string) => {
    await vaultManager.switchVault(vaultId);
    await loadVaults();
    toast.success("Beralih ke vault baru");
  };

  const handleDeleteVault = async (vaultId: string) => {
    if (!confirm("Hapus vault ini? Seluruh cadangannya juga akan dihapus."))
      return;
    await vaultManager.deleteVault(vaultId);
    await loadVaults();
    toast.success("Vault berhasil dihapus");
  };

  const handleLeaveVault = async (vaultId: string) => {
    if (!user) return;
    if (!confirm("Tinggalkan vault kolaborasi ini? Anda tidak akan dapat mengaksesnya lagi kecuali diundang kembali."))
      return;

    const res = await VaultMemberService.leaveVault(vaultId, user.id);
    if (res.success) {
      toast.success("Anda telah meninggalkan vault kolaborasi ini");
      await loadVaults();
    } else {
      toast.error(res.error || "Gagal meninggalkan vault");
    }
  };

  const handleRenameVault = async (vaultId: string, newName: string) => {
    const res = await vaultManager.renameVault(vaultId, newName, user?.id);
    await loadVaults();
    if (res.success) {
      toast.success(`Nama vault berhasil diubah menjadi "${newName}"`);
    } else {
      toast.error(res.error || "Gagal mengubah nama vault");
    }
  };

  const handleCloudSyncChange = async (vaultId: string, enabled: boolean) => {
    const { needsCloudSync } = await vaultManager.setCloudSync(vaultId, enabled);
    await loadVaults();
    if (needsCloudSync && isAuthenticated) {
      const result = await syncVaultToCloud(vaultId);
      if (result.success) toast.success("Sinkronisasi cloud aktif — vault diunggah");
      else toast.error(`Gagal mengunggah ke cloud: ${result.error}`);
    } else {
      toast.success(enabled ? "Cloud sync aktif" : "Cloud sync dinonaktifkan");
    }
  };

  const handleAttachFolder = async (vaultId: string) => {
    try {
      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      if (!picker) {
        toast.error("Browser tidak mendukung File System Access API");
        return;
      }
      const handle = await picker();
      if (!handle) return;
      const ok = await vaultManager.attachFolder(vaultId, handle);
      await loadVaults();
      if (ok) toast.success("Folder lokal ditautkan — catatan ditulis ke disk");
      else toast.error("Tidak dapat menggunakan folder tersebut");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        toast.error(error.message);
    }
  };

  const handleImportComplete = async () => {
    await loadVaults();
    toast.success("Konten berhasil diimpor");
  };

  const getVaultNodes = (vaultId: string) => {
    return vaultManager.getVaultGraphData(vaultId)?.nodes || [];
  };

  if (!isInitialized) {
    return (
      <p className="py-12 text-sm text-muted-foreground text-center">
        Memuat ruang kerja vault…
      </p>
    );
  }

  const StrategyIcon = activeVault
    ? LOCATION_META[activeVault.location]?.icon || Database
    : Database;

  return (
    <div className="space-y-6">
      {/* Segmented Sub-Tabs Horisontal */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-muted/60">
          <TabsTrigger value="vaults" className="text-xs sm:text-sm font-medium gap-1.5">
            <Database className="w-3.5 h-3.5" />
            Daftar Vault
          </TabsTrigger>
          <TabsTrigger value="backups" className="text-xs sm:text-sm font-medium gap-1.5">
            <History className="w-3.5 h-3.5" />
            Backup & Riwayat
          </TabsTrigger>
          <TabsTrigger value="import-export" className="text-xs sm:text-sm font-medium gap-1.5">
            <FileArchive className="w-3.5 h-3.5" />
            Impor & Ekspor
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: DAFTAR VAULT                                      */}
        {/* ======================================================== */}
        <TabsContent value="vaults" className="mt-4 space-y-4">
          {/* Active Vault Summary Pill */}
          <Card className="border-border shadow-xs bg-muted/10">
            <CardContent className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                  <StrategyIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Vault Aktif Saat Ini</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {activeVault ? activeVault.name : "Belum ada vault aktif"}
                  </p>
                </div>
              </div>

              {activeVault && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[11px] h-5 px-2">
                    {LOCATION_META[activeVault.location]?.label || "Vault"}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {activeVault.nodeCount} catatan · {activeVault.linkCount} tautan
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Header + Tombol Tambah + Sub-Toggle Filter */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Semua Vault</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih ruang kerja, kelola cadangan, atau undang kolaborator.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Segmented Filter Toggle: Personal vs Shared (Tinggi diselaraskan h-8) */}
                <div className="inline-flex h-8 items-center p-0.5 rounded-lg border border-border bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setVaultFilter("mine")}
                    className={`h-full flex items-center gap-1.5 px-3 text-xs rounded-md font-medium transition-colors ${
                      vaultFilter === "mine"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FolderHeart className="w-3.5 h-3.5" />
                    <span>Personal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultFilter("shared")}
                    className={`h-full flex items-center gap-1.5 px-3 text-xs rounded-md font-medium transition-colors ${
                      vaultFilter === "shared"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Shared</span>
                  </button>
                </div>

                {/* Tombol Vault Baru (Tinggi diselaraskan h-8) */}
                <Button size="sm" className="gap-1.5 h-8 px-3 text-xs font-medium shrink-0" onClick={() => setIsSelectorOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Vault Baru
                </Button>
              </div>
            </div>

            {filteredVaults.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center bg-muted/10">
                <Database className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs sm:text-sm text-foreground font-medium">
                  {vaultFilter === "mine" ? "Belum ada vault personal milik Anda." : "Belum ada vault yang dibagikan (shared) kepada Anda."}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {vaultFilter === "mine"
                    ? "Klik 'Vault Baru' di atas untuk membuat ruang kerja pertama Anda."
                    : "Minta rekan Anda mengundang Anda menggunakan User ID atau Gmail Anda."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredVaults.map((vault) => {
                  const role = vaultRoles[vault.id] || "owner";
                  return (
                    <div key={vault.id}>
                      <VaultCard
                        id={vault.id}
                        name={vault.name}
                        location={vault.location}
                        cloudSync={vault.cloudSync}
                        nodeCount={vault.nodeCount}
                        linkCount={vault.linkCount}
                        lastModified={vault.lastModified}
                        isActive={vault.id === activeVaultId}
                        isAuthenticated={isAuthenticated}
                        currentUserId={user?.id}
                        userRole={role}
                        stats={vault.stats}
                        backupCount={backups[vault.id]?.length || 0}
                        onSelect={() => handleSelectVault(vault.id)}
                        onDelete={() => handleDeleteVault(vault.id)}
                        onLeaveVault={() => handleLeaveVault(vault.id)}
                        onRename={(newName) => handleRenameVault(vault.id, newName)}
                        onCloudSyncChange={(enabled) => handleCloudSyncChange(vault.id, enabled)}
                        onAttachFolder={
                          vault.location === "cloud" ? () => handleAttachFolder(vault.id) : undefined
                        }
                        onOpenBackups={() => setBackupVaultId(vault.id)}
                        onExportToFileSystem={() =>
                          document.getElementById(`hub-export-${vault.id}`)?.click()
                        }
                      />
                      <div className="hidden">
                        <ExportToFileSystem
                          vaultName={vault.name}
                          nodes={getVaultNodes(vault.id) as any}
                          trigger={<button id={`hub-export-${vault.id}`} />}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: BACKUP & RIWAYAT                                  */}
        {/* ======================================================== */}
        <TabsContent value="backups" className="mt-4 space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Riwayat Cadangan Snapshot
              </CardTitle>
              <CardDescription className="text-xs">
                {activeVault
                  ? `Mengelola cadangan otomatis dan pemulihan snapshot untuk "${activeVault.name}".`
                  : "Pilih vault di tab Daftar Vault terlebih dahulu."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {activeVaultId ? (
                <VaultBackupPanel
                  vaultId={activeVaultId}
                  backups={backups[activeVaultId] || []}
                  onRestore={async (backupId) => {
                    const ok = await vaultManager.restoreBackup(activeVaultId, backupId);
                    await loadVaults();
                    if (ok) toast.success("Cadangan berhasil dipulihkan");
                    else toast.error("Pemulihan cadangan gagal");
                  }}
                  onDelete={async (backupId) => {
                    await vaultManager.deleteBackup(backupId);
                    await loadVaults();
                    toast.success("Cadangan dihapus");
                  }}
                  onManualBackup={async () => {
                    await vaultManager.createBackup(activeVaultId);
                    await loadVaults();
                    toast.success("Snapshot cadangan baru dibuat");
                  }}
                  onOpenSettings={() => setSettingsVaultId(activeVaultId)}
                />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Tidak ada vault yang sedang aktif. Buka salah satu vault di tab Daftar Vault.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: IMPOR & EKSPOR                                    */}
        {/* ======================================================== */}
        <TabsContent value="import-export" className="mt-4 space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-primary" /> Impor & Ekspor Berkas Markdown
              </CardTitle>
              <CardDescription className="text-xs">
                {activeVault
                  ? `Ekspor atau impor berkas .md dan struktur graf ke dalam vault aktif "${activeVault.name}".`
                  : "Pilih vault terlebih dahulu."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ImportExportPanel
                nodes={(activeVaultId ? getVaultNodes(activeVaultId) : []) as any}
                onImportComplete={handleImportComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog Pembuat Vault Baru */}
      <VaultModeSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onCreateFolderVault={handleCreateFolderVault}
        onOpenFolderVault={handleOpenFolderVault}
        onCreateCloudVault={handleCreateCloudVault}
        onVaultCreated={handleSelectVault}
        isAuthenticated={isAuthenticated}
      />

      {/* Dialog Cadangan */}
      <Dialog open={!!backupVaultId} onOpenChange={() => setBackupVaultId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4 text-primary" /> Cadangan Vault
            </DialogTitle>
          </DialogHeader>
          {backupVaultId && (
            <VaultBackupPanel
              vaultId={backupVaultId}
              backups={backups[backupVaultId] || []}
              onRestore={async (backupId) => {
                const ok = await vaultManager.restoreBackup(backupVaultId, backupId);
                await loadVaults();
                if (ok) toast.success("Cadangan dipulihkan");
                else toast.error("Gagal memulihkan cadangan");
              }}
              onDelete={async (backupId) => {
                await vaultManager.deleteBackup(backupId);
                await loadVaults();
                toast.success("Cadangan dihapus");
              }}
              onManualBackup={async () => {
                await vaultManager.createBackup(backupVaultId);
                await loadVaults();
              }}
              onOpenSettings={() => {
                setSettingsVaultId(backupVaultId);
                setBackupVaultId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Pengaturan Backup Otomatis (Props Valid: config & onSave) */}
      <Dialog open={!!settingsVaultId} onOpenChange={() => setSettingsVaultId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Pengaturan Cadangan Otomatis</DialogTitle>
          </DialogHeader>
          {settingsVaultId && (
            <VaultBackupSettingsContent
              config={
                backupConfigs[settingsVaultId] || {
                  timeIntervalMinutes: 10,
                  changeThreshold: 5,
                  maxSnapshots: 20,
                }
              }
              onSave={async (newConfig) => {
                await vaultManager.setBackupConfig(settingsVaultId, newConfig);
                setBackupConfigs((prev) => ({ ...prev, [settingsVaultId]: newConfig }));
                setSettingsVaultId(null);
                toast.success("Konfigurasi cadangan otomatis disimpan");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}