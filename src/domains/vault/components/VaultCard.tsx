import { useState, useEffect, useRef } from "react";
import {
  HardDrive,
  Cloud,
  Clock,
  Network,
  FileText,
  FolderOpen,
  Tag,
  Link2,
  Pencil,
  Check,
  X,
  History,
  Download,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Users,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import type { VaultLocation } from "@/domains/vault/types";
import { VaultLocationBadge } from "./VaultStorageControls";
import { VaultMemberSection } from "./VaultMemberSection";
import type { VaultMemberRole } from "@/types/collaboration";
import { VaultValidationService } from "../services/VaultValidationService";

export interface VaultCardProps {
  id: string;
  name: string;
  location: VaultLocation;
  cloudSync: boolean;
  nodeCount: number;
  linkCount: number;
  lastModified: number;
  isActive: boolean;
  isAuthenticated?: boolean;
  currentUserId?: string;
  userRole?: VaultMemberRole | "owner" | "superadmin" | "none";
  onSelect: () => void;
  onDelete: () => void;
  onLeaveVault?: () => void;
  onRename?: (newName: string) => void;
  onCloudSyncChange?: (enabled: boolean) => void;
  onAttachFolder?: () => void;
  onOpenBackups?: () => void;
  onExportToFileSystem?: () => void;
  backupCount?: number;
  stats?: {
    fileCount: number;
    folderCount: number;
    tagCount: number;
    orphanedNodes: number;
    avgConnections: number;
  };
}

export const VaultCard = ({
  id,
  name,
  location,
  cloudSync,
  nodeCount,
  linkCount,
  lastModified,
  isActive,
  isAuthenticated = false,
  currentUserId,
  userRole = "owner",
  onSelect,
  onDelete,
  onLeaveVault,
  onRename,
  onCloudSyncChange,
  onAttachFolder,
  onOpenBackups,
  onExportToFileSystem,
  backupCount = 0,
  stats,
}: VaultCardProps) => {
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const [validationState, setValidationState] = useState<{
    status: "idle" | "checking" | "valid" | "duplicate" | "invalid";
    message?: string;
    slug?: string;
  }>({ status: "idle" });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isOwner = userRole === "owner" || userRole === "superadmin";
  const isOwnerOrAdmin = isOwner || userRole === "admin";
  const isCollaborator = !isOwner && userRole !== "none";

  // Reset input jika prop name dari luar berubah
  useEffect(() => {
    setNewName(name);
  }, [name]);

  // Real-Time Inline Checker dengan debounce 300ms
  useEffect(() => {
    if (!isRenaming) {
      setValidationState({ status: "idle" });
      return;
    }

    const trimmed = newName.trim();
    if (trimmed === name.trim()) {
      setValidationState({ status: "idle" });
      return;
    }

    if (!trimmed) {
      setValidationState({
        status: "invalid",
        message: "Nama tidak boleh kosong.",
      });
      return;
    }

    setValidationState({ status: "checking" });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const res = await VaultValidationService.checkAvailability({
        name: trimmed,
        excludeVaultId: id,
        currentUserId,
      });

      if (res.available) {
        setValidationState({
          status: "valid",
          slug: res.slug,
          message: `Tersedia: /p/.../${res.slug}`,
        });
      } else {
        setValidationState({
          status: "duplicate",
          slug: res.slug,
          message: res.reason || "Nama atau slug vault sudah digunakan.",
        });
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [newName, isRenaming, name, id, currentUserId]);

  const canSave = newName.trim() !== name && validationState.status === "valid";

  const handleRename = () => {
    if (!canSave) return;
    if (onRename) {
      onRename(newName.trim());
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setNewName(name);
    setValidationState({ status: "idle" });
    setIsRenaming(false);
  };

  return (
    <div
      className={`
        group relative flex flex-col overflow-hidden rounded-xl border bg-card/60 backdrop-blur-xs
        transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5
        ${isActive ? "border-primary/70 ring-1 ring-primary/40 bg-card" : "border-border/80"}
      `}
    >
      {/* Active Top Accent Line */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />
      )}

      {/* Main Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        {/* Header: Identity + Quick Action / Context Menu */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                location === "folder"
                  ? "bg-primary/10 text-primary"
                  : "bg-blue-500/10 text-blue-400"
              }`}
            >
              {location === "folder" ? (
                <HardDrive className="w-4 h-4" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <div className="flex flex-col gap-1 w-full max-w-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canSave) handleRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        className={`h-7 pr-7 text-xs font-medium transition-colors ${
                          validationState.status === "valid"
                            ? "border-emerald-500/80 focus-visible:ring-emerald-500/30"
                            : validationState.status === "duplicate" ||
                                validationState.status === "invalid"
                              ? "border-destructive focus-visible:ring-destructive/30"
                              : ""
                        }`}
                        placeholder="Nama vault..."
                        autoFocus
                      />
                      {/* Indikator Status di Ujung Input */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        {validationState.status === "checking" && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        )}
                        {validationState.status === "valid" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {(validationState.status === "duplicate" ||
                          validationState.status === "invalid") && (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-500 hover:text-emerald-400 disabled:opacity-40"
                      onClick={handleRename}
                      disabled={!canSave}
                      title={canSave ? "Simpan nama baru" : "Nama belum valid atau duplikat"}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelRename}
                      title="Batal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Feedback Message & URL Slug Preview */}
                  {validationState.message && (
                    <div
                      className={`text-[11px] flex items-center gap-1 leading-tight ${
                        validationState.status === "valid"
                          ? "text-emerald-500 font-medium"
                          : "text-destructive font-medium"
                      }`}
                    >
                      {validationState.status === "valid" ? (
                        <Globe className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{validationState.message}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3
                    className="font-semibold text-xs sm:text-sm text-foreground truncate"
                    title={name}
                  >
                    {name}
                  </h3>
                  {isActive && (
                    <Badge
                      variant="default"
                      className="text-[10px] h-4.5 px-1.5 font-medium shrink-0"
                    >
                      Aktif
                    </Badge>
                  )}
                  {isCollaborator && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4.5 px-1.5 font-medium shrink-0 capitalize"
                    >
                      {userRole}
                    </Badge>
                  )}
                </div>
              )}

              {!isRenaming && (
                <div className="flex items-center gap-2 mt-1">
                  <VaultLocationBadge location={location} cloudSync={cloudSync} />
                </div>
              )}
            </div>
          </div>

          {/* Action Header Buttons: Open + Context Menu (···) */}
          <div className="flex items-center gap-1 shrink-0">
            {!isActive && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={onSelect}>
                Buka
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                {isOwnerOrAdmin && onRename && (
                  <DropdownMenuItem
                    onClick={() => setIsRenaming(true)}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Ubah Nama
                  </DropdownMenuItem>
                )}
                {onOpenBackups && (
                  <DropdownMenuItem onClick={onOpenBackups} className="gap-2 cursor-pointer">
                    <History className="w-3.5 h-3.5" /> Cadangan ({backupCount})
                  </DropdownMenuItem>
                )}
                {onExportToFileSystem && (
                  <DropdownMenuItem onClick={onExportToFileSystem} className="gap-2 cursor-pointer">
                    <Download className="w-3.5 h-3.5" /> Ekspor Berkas
                  </DropdownMenuItem>
                )}
                {isOwner && onCloudSyncChange && isAuthenticated && (
                  <DropdownMenuItem
                    onClick={() => onCloudSyncChange(!cloudSync)}
                    className="gap-2 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {cloudSync ? "Matikan Cloud Sync" : "Aktifkan Cloud Sync"}
                  </DropdownMenuItem>
                )}
                {isOwner && onAttachFolder && (
                  <DropdownMenuItem onClick={onAttachFolder} className="gap-2 cursor-pointer">
                    <FolderPlus className="w-3.5 h-3.5" /> Tautkan Folder Lokal
                  </DropdownMenuItem>
                )}

                {/* Kolaborator: Opsi Tinggalkan Vault */}
                {isCollaborator && onLeaveVault && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onLeaveVault}
                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Tinggalkan Vault
                    </DropdownMenuItem>
                  </>
                )}

                {/* Pemilik: Opsi Hapus Vault */}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Vault
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Minimal Summary Metrics Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Network className="w-3 h-3 text-primary" /> {nodeCount}{" "}
              <span className="font-normal text-muted-foreground">catatan</span>
            </span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Link2 className="w-3 h-3 text-primary" /> {linkCount}{" "}
              <span className="font-normal text-muted-foreground">tautan</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(lastModified, { addSuffix: true })}</span>
          </div>
        </div>

        {/* Accordion 1: Detail Statistik */}
        {stats && (
          <div className="pt-1 border-t border-border/40">
            <button
              type="button"
              onClick={() => setIsStatsExpanded(!isStatsExpanded)}
              className="flex items-center justify-between w-full py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>
                {isStatsExpanded ? "Sembunyikan Statistik Rinci" : "Detail Statistik Vault"}
              </span>
              {isStatsExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {isStatsExpanded && (
              <div className="grid grid-cols-4 gap-1.5 pt-2 text-[10px] animate-in fade-in duration-150">
                <div className="flex flex-col items-center p-1.5 rounded-md bg-secondary/40 border border-border/40">
                  <FileText className="w-3 h-3 text-muted-foreground mb-0.5" />
                  <span className="font-semibold text-foreground">{stats.fileCount}</span>
                  <span className="text-[9px] text-muted-foreground">Berkas</span>
                </div>
                <div className="flex flex-col items-center p-1.5 rounded-md bg-secondary/40 border border-border/40">
                  <FolderOpen className="w-3 h-3 text-muted-foreground mb-0.5" />
                  <span className="font-semibold text-foreground">{stats.folderCount}</span>
                  <span className="text-[9px] text-muted-foreground">Folder</span>
                </div>
                <div className="flex flex-col items-center p-1.5 rounded-md bg-secondary/40 border border-border/40">
                  <Tag className="w-3 h-3 text-muted-foreground mb-0.5" />
                  <span className="font-semibold text-foreground">{stats.tagCount}</span>
                  <span className="text-[9px] text-muted-foreground">Tag</span>
                </div>
                <div className="flex flex-col items-center p-1.5 rounded-md bg-secondary/40 border border-border/40">
                  <Network className="w-3 h-3 text-muted-foreground mb-0.5" />
                  <span className="font-semibold text-foreground">
                    {stats.avgConnections.toFixed(1)}
                  </span>
                  <span className="text-[9px] text-muted-foreground">Rata Tautan</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion 2: Akses & Kolaborator Vault (RBAC Per-Vault) */}
        <div className="pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => setIsMembersExpanded(!isMembersExpanded)}
            className="flex items-center justify-between w-full py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Users className="w-3 h-3 text-primary" />
              {isMembersExpanded ? "Tutup Akses & Kolaborator" : "Akses & Kolaborator Vault"}
            </span>
            {isMembersExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {isMembersExpanded && (
            <div className="pt-1 animate-in fade-in duration-150">
              <VaultMemberSection
                vaultId={id}
                vaultName={name}
                isCloud={location === "cloud" || cloudSync}
                currentUserId={currentUserId}
                isOwnerOrAdmin={isOwnerOrAdmin}
                onCloudSyncEnable={() => onCloudSyncChange?.(true)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
