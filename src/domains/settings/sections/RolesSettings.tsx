import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { VaultMemberService } from "@/domains/vault/services/VaultMemberService";
import { AdminService } from "@/domains/admin/services/AdminService";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import type { VaultMemberRole } from "@/types/collaboration";
import type { VaultMemberWithProfile } from "@/types/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  ExternalLink,
  Mail,
  Loader2,
  Shield,
  Info,
  FolderGit2,
} from "lucide-react";

const ROLE_DEFINITIONS = [
  { name: "Admin", role: "admin", desc: "Kontrol penuh: kelola anggota vault, skema, dan publikasi web." },
  { name: "Editor", role: "editor", desc: "Meninjau draf kontributor, menyetujui perubahan, & menerbitkan catatan." },
  { name: "Contributor", role: "contributor", desc: "Dapat membuat & mengedit draf lokal; mengajukan review ke Editor." },
  { name: "Viewer", role: "viewer", desc: "Hanya dapat membaca catatan; tidak dapat mengubah isi atau menerbitkan." },
];

export function RolesSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const permissions = useVaultPermission();

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [members, setMembers] = useState<VaultMemberWithProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Form Invite State
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<VaultMemberRole>("contributor");
  const [inviting, setInviting] = useState(false);

  // Cek apakah user aktif adalah superadmin
  useEffect(() => {
    AdminService.isCurrentUserSuperadmin().then(setIsSuperadmin);
  }, []);

  // Muat daftar anggota vault aktif
  const loadMembers = async () => {
    if (!currentVaultId) return;
    setLoadingMembers(true);
    const data = await VaultMemberService.getVaultMembers(currentVaultId);
    setMembers(data);
    setLoadingMembers(false);
  };

  useEffect(() => {
    loadMembers();
  }, [currentVaultId]);

  // Tambah / Undang Anggota via Email
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentVaultId || !inviteEmail.trim()) return;

    setInviting(true);
    const targetUser = await VaultMemberService.lookupUserByEmail(inviteEmail.trim());

    if (!targetUser) {
      setInviting(false);
      toast.error(`Pengguna dengan email "${inviteEmail}" tidak ditemukan di sistem.`);
      return;
    }

    if (targetUser.id === user.id) {
      setInviting(false);
      toast.error("Anda adalah pemilik atau anggota aktif di vault ini.");
      return;
    }

    const res = await VaultMemberService.addOrUpdateMember(
      currentVaultId,
      targetUser.id,
      selectedRole,
      user.id
    );

    setInviting(false);
    if (!res.success) {
      toast.error(res.error || "Gagal menambahkan anggota.");
      return;
    }

    toast.success(`Pengguna "${targetUser.email}" berhasil ditambahkan sebagai ${selectedRole}.`);
    setInviteEmail("");
    loadMembers();
  };

  // Ubah Peran Anggota yang Sudah Ada
  const handleRoleChange = async (targetUserId: string, newRole: VaultMemberRole) => {
    if (!user || !currentVaultId) return;

    const res = await VaultMemberService.addOrUpdateMember(
      currentVaultId,
      targetUserId,
      newRole,
      user.id
    );

    if (!res.success) {
      toast.error(res.error || "Gagal memperbarui peran anggota.");
      return;
    }

    toast.success("Peran anggota berhasil diperbarui.");
    loadMembers();
  };

  // Hapus Anggota dari Vault
  const handleRemoveMember = async (targetUserId: string) => {
    if (!user || !currentVaultId) return;

    const res = await VaultMemberService.removeMember(currentVaultId, targetUserId, user.id);

    if (!res.success) {
      toast.error(res.error || "Gagal menghapus anggota.");
      return;
    }

    toast.success("Anggota berhasil dihapus dari vault ini.");
    loadMembers();
  };

  return (
    <div className="space-y-6">
      {/* 1. Superadmin Gateway Banner (Hanya muncul jika Superadmin) */}
      {isSuperadmin && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Akses Khusus Superadmin Platform
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Anda memiliki hak akses tertinggi untuk mengelola seluruh pengguna dan subsistem.
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-1.5 text-xs h-8"
              >
                Buka Cockpit Admin
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* 2. Manajer Anggota Vault Aktif */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">
                  Kolaborator Vault Aktif
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Kelola siapa saja yang memiliki akses menulis, meninjau, dan menerbitkan catatan di ruang kerja ini.
                </CardDescription>
              </div>
            </div>
            {currentVaultId && (
              <Badge variant="outline" className="text-[11px] font-mono">
                Vault ID: {currentVaultId.substring(0, 8)}...
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Form Undang Anggota (Hanya jika memiliki izin canManageMembers) */}
          {permissions.canManageMembers ? (
            <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Ketik email pengguna terdaftar..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-8 h-9 text-xs"
                  required
                />
              </div>

              <div className="w-full sm:w-36">
                <Select
                  value={selectedRole}
                  onValueChange={(val) => setSelectedRole(val as VaultMemberRole)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={inviting} size="sm" className="h-9 text-xs gap-1.5 shrink-0">
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Undang Anggota
              </Button>
            </form>
          ) : (
            <div className="p-3 bg-muted/30 border rounded-lg text-xs text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Hanya Pemilik atau Admin vault yang memiliki hak untuk menambah dan mengubah anggota.</span>
            </div>
          )}

          {/* Tabel Anggota Vault */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Anggota</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Peran Vault</TableHead>
                  {permissions.canManageMembers && <TableHead className="text-xs text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMembers ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-primary" />
                      Memuat daftar kolaborator...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                      Belum ada kolaborator tambahan di vault ini. Undang tim Anda menggunakan form di atas.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => {
                    const initials = (m.display_name || m.email || "U").substring(0, 2).toUpperCase();
                    const isSelf = user?.id === m.user_id;

                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 border">
                              <AvatarImage src={m.avatar_url || ""} />
                              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                                {m.display_name || "Tanpa Nama"}
                                {isSelf && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    Anda
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">{m.email || "-"}</TableCell>

                        <TableCell>
                          {permissions.canManageMembers && !isSelf ? (
                            <div className="w-28">
                              <Select
                                value={m.role}
                                onValueChange={(val) => handleRoleChange(m.user_id, val as VaultMemberRole)}
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="contributor">Contributor</SelectItem>
                                  <SelectItem value="editor">Editor</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="capitalize text-[10px]">
                              {m.role}
                            </Badge>
                          )}
                        </TableCell>

                        {permissions.canManageMembers && (
                          <TableCell className="text-right">
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Hapus Anggota"
                                onClick={() => handleRemoveMember(m.user_id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Matriks Edukasi Peran */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Panduan Tingkatan Hak Akses (RBAC Matrix)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ROLE_DEFINITIONS.map((r) => (
            <div key={r.role} className="p-3 rounded-lg border bg-card/60 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{r.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}