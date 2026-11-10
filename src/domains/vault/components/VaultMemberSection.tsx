import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Edit3,
  Eye,
  Trash2,
  Loader2,
  Cloud,
  ArrowUpRight,
  Search,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/global/ui/avatar";
import { Badge } from "@/global/ui/badge";
import { Button } from "@/global/ui/button";
import { Input } from "@/global/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/global/ui/select";
import { toast } from "sonner";
import { VaultMemberService, type UserSearchResult } from "@/domains/vault/services/VaultMemberService";
import type { VaultMemberRole } from "@/types/collaboration";
import type { VaultMemberWithProfile } from "@/types/admin";

interface VaultMemberSectionProps {
  vaultId: string;
  vaultName: string;
  isCloud: boolean;
  currentUserId?: string;
  isOwnerOrAdmin: boolean;
  onCloudSyncEnable?: () => void;
}

const ROLE_CONFIG: Record<VaultMemberRole, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    desc: "Kelola anggota, sunting, dan hapus catatan",
  },
  editor: {
    label: "Editor",
    icon: Edit3,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    desc: "Sunting, buat, dan publikasikan catatan",
  },
  contributor: {
    label: "Contributor",
    icon: Shield,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    desc: "Buat draft dan ajukan review catatan",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "bg-muted text-muted-foreground border-border",
    desc: "Hanya dapat membaca catatan graf",
  },
};

export const VaultMemberSection: React.FC<VaultMemberSectionProps> = ({
  vaultId,
  vaultName,
  isCloud,
  currentUserId,
  isOwnerOrAdmin,
  onCloudSyncEnable,
}) => {
  const [members, setMembers] = useState<VaultMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // State Input & Auto-suggestion
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<VaultMemberRole>("editor");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Muat daftar anggota
  const loadMembers = async () => {
    if (!isCloud || !vaultId) return;
    setLoading(true);
    try {
      const data = await VaultMemberService.getVaultMembers(vaultId);
      setMembers(data);
    } catch (err) {
      console.error("[VaultMemberSection] Gagal memuat anggota:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [vaultId, isCloud]);

  // Handle outside click untuk menutup auto-suggestion popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced auto-suggestion
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || selectedUser) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const existingUserIds = members.map((m) => m.user_id);
      if (currentUserId) existingUserIds.push(currentUserId);

      const results = await VaultMemberService.searchUsers(searchQuery, existingUserIds);
      setSuggestions(results);
      setShowSuggestions(true);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, members, currentUserId, selectedUser]);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.email || user.display_name || user.id);
    setShowSuggestions(false);
  };

  const handleInvite = async () => {
    if (!selectedUser || !currentUserId) {
      toast.error("Pilih pengguna dari daftar saran terlebih dahulu");
      return;
    }

    setIsSubmitting(true);
    const result = await VaultMemberService.addOrUpdateMember(
      vaultId,
      selectedUser.id,
      selectedRole,
      currentUserId
    );
    setIsSubmitting(false);

    if (result.success) {
      toast.success(`${selectedUser.display_name || selectedUser.email} ditambahkan sebagai ${selectedRole}`);
      setSelectedUser(null);
      setSearchQuery("");
      loadMembers();
    } else {
      toast.error(result.error || "Gagal mengundang anggota");
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: VaultMemberRole) => {
    if (!currentUserId) return;
    const res = await VaultMemberService.addOrUpdateMember(vaultId, memberUserId, newRole, currentUserId);
    if (res.success) {
      toast.success("Peran anggota diperbarui");
      loadMembers();
    } else {
      toast.error("Gagal memperbarui peran");
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!currentUserId) return;
    const res = await VaultMemberService.removeMember(vaultId, memberUserId, currentUserId);
    if (res.success) {
      toast.success("Akses anggota dicabut");
      loadMembers();
    } else {
      toast.error("Gagal mencabut akses");
    }
  };

  // 1. Kondisi jika Local Vault: Tampilkan Ajakan Cloud Sync yang Ramah
  if (!isCloud) {
    return (
      <div className="p-3.5 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center space-y-2">
        <div className="w-8 h-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Cloud className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Kolaborasi Khusus Cloud Vault</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Aktifkan Sinkronisasi Cloud untuk mengundang kolaborator ke vault ini.
          </p>
        </div>
        {onCloudSyncEnable && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onCloudSyncEnable}>
            <Cloud className="w-3.5 h-3.5" />
            Aktifkan Cloud Sync Sekarang
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 text-xs">
      {/* Form Tambah Anggota (Khusus Owner/Admin) */}
      {isOwnerOrAdmin && (
        <div className="p-2.5 rounded-lg border border-border/70 bg-secondary/20 space-y-2">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            <span>Undang Kolaborator ke {vaultName}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Input Pencarian dengan Floating Popover */}
            <div ref={searchBoxRef} className="relative flex-1">
              <div className="relative">
                <Input
                  placeholder="Ketik Gmail atau User ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedUser) setSelectedUser(null);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  className="h-8 text-xs pl-8 pr-7 bg-background"
                />
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground absolute right-2.5 top-2.5" />
                )}
              </div>

              {/* Floating Dropdown Autocomplete */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-50">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted text-xs transition-colors"
                    >
                      <Avatar className="w-5 h-5 shrink-0">
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback className="text-[9px]">
                          {(user.display_name || user.email || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {user.display_name || "Pengguna Terdaftar"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email || user.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showSuggestions && !isSearching && suggestions.length === 0 && searchQuery.length >= 2 && (
                <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover p-2 text-center text-[11px] text-muted-foreground shadow-md">
                  Tidak ada pengguna cocok ditemukan.
                </div>
              )}
            </div>

            {/* Pemilih Peran */}
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as VaultMemberRole)}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-32 bg-background shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["admin", "editor", "contributor", "viewer"] as VaultMemberRole[]).map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const Icon = cfg.icon;
                  return (
                    <SelectItem key={r} value={r} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Tombol Undang */}
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={!selectedUser || isSubmitting}
              className="h-8 text-xs px-3 shrink-0 gap-1"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Undang</span>
            </Button>
          </div>
        </div>
      )}

      {/* Daftar Anggota Aktif */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
          <span>Anggota Vault ({members.length})</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>

        {members.length === 0 && !loading ? (
          <p className="text-[11px] text-muted-foreground text-center py-2 bg-muted/10 rounded-md border border-border/40">
            Belum ada kolaborator luar yang ditambahkan ke vault ini.
          </p>
        ) : (
          <div className="divide-y divide-border/40 rounded-md border border-border/50 bg-background/50 overflow-hidden">
            {members.map((member) => {
              const isOwnerRow = member.id.startsWith("owner-");
              const cfg = isOwnerRow 
                ? { label: "Pemilik", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" }
                : (ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer);
              const isSelf = member.user_id === currentUserId;

              return (
                <div key={member.id} className="flex items-center justify-between p-2 gap-2 hover:bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="w-6 h-6 shrink-0">
                      <AvatarImage src={member.avatar_url || ""} />
                      <AvatarFallback className="text-[9px]">
                        {(member.display_name || member.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-[11px]">
                        {member.display_name || member.email || "Anggota"}
                        {isSelf && <span className="ml-1 text-[10px] text-muted-foreground">(Anda)</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{member.email || member.user_id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Jika ini baris Pemilik Utama, selalu tampilkan badge statis */}
                    {isOwnerRow ? (
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium ${cfg.color}`}>
                        Pemilik Utama
                      </Badge>
                    ) : isOwnerOrAdmin && !isSelf ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(val) => handleRoleChange(member.user_id, val as VaultMemberRole)}
                        >
                          <SelectTrigger className="h-6 text-[10px] px-2 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["admin", "editor", "contributor", "viewer"] as VaultMemberRole[]).map((r) => (
                              <SelectItem key={r} value={r} className="text-[11px]">
                                {ROLE_CONFIG[r].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveMember(member.user_id)}
                          title="Cabut Akses"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};