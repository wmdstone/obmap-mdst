import React, { useState } from "react";
import type { UserWithRole, AccountStatus } from "@/types/admin";
import type { AppRole } from "@/types/collaboration";
import { AdminService } from "@/domains/admin/services/AdminService";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { toast } from "sonner";
import {
  ShieldCheck,
  UserCheck,
  Search,
  ShieldAlert,
  Ban,
  CheckCircle,
  Eye,
  Database,
  Calendar,
} from "lucide-react";

interface Props {
  users: UserWithRole[];
  onRefresh: () => void;
}

export const UserManagementTab: React.FC<Props> = ({ users: initialUsers, onRefresh }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [inspectUser, setInspectUser] = useState<UserWithRole | null>(null);

  React.useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.display_name || "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  // Optimistic UI untuk Perubahan Role
  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    if (!currentUser) return;
    const previousUsers = [...users];

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
    );
    setUpdatingId(targetUserId);

    const res = await AdminService.updateUserRole(targetUserId, newRole, currentUser.id);

    setUpdatingId(null);
    if (!res.success) {
      setUsers(previousUsers); // Rollback jika gagal
      toast.error(res.error || "Gagal memperbarui peran pengguna.");
      return;
    }

    toast.success(`Peran berhasil diubah menjadi "${newRole}".`);
    onRefresh();
  };

  // Optimistic UI untuk Toggle Penangguhan Akun
  const handleToggleSuspension = async (targetUserId: string, currentStatus: AccountStatus = "active") => {
    if (!currentUser) return;
    const nextStatus: AccountStatus = currentStatus === "suspended" ? "active" : "suspended";
    const previousUsers = [...users];

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, status: nextStatus } : u))
    );

    const res = await AdminService.toggleUserSuspension(targetUserId, nextStatus, currentUser.id);

    if (!res.success) {
      setUsers(previousUsers); // Rollback
      toast.error(res.error || "Gagal memperbarui status akun.");
      return;
    }

    toast.success(
      nextStatus === "suspended"
        ? "Akun pengguna berhasil ditangguhkan."
        : "Akun pengguna berhasil diaktifkan kembali."
    );
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Tata Kelola Pengguna & Hak Akses Platform
          </h2>
          <p className="text-sm text-muted-foreground">
            Atur status Superadmin, pantau penangguhan akun, dan audit jumlah vault aktif.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Tabel Data Responsif */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran Platform</TableHead>
              <TableHead>Status Akun</TableHead>
              <TableHead>Vault Aktif</TableHead>
              <TableHead className="text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  Tidak ada pengguna yang cocok dengan kriteria pencarian.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => {
                const initials = (u.display_name || u.email || "U").substring(0, 2).toUpperCase();
                const isSelf = currentUser?.id === u.id;
                const isSuspended = u.status === "suspended";

                return (
                  <TableRow key={u.id} className={isSuspended ? "opacity-60 bg-muted/10" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={u.avatar_url || ""} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-1.5">
                            {u.display_name || "Tanpa Nama"}
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Anda
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {u.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">{u.email || "-"}</TableCell>

                    <TableCell>
                      {u.role === "superadmin" ? (
                        <Badge className="bg-primary text-primary-foreground flex items-center gap-1 w-fit text-[11px]">
                          <ShieldCheck className="h-3 w-3" />
                          Superadmin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit text-[11px]">
                          <UserCheck className="h-3 w-3" />
                          Member
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {isSuspended ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <Ban className="w-2.5 h-2.5" /> Ditangguhkan
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30">
                          <CheckCircle className="w-2.5 h-2.5" /> Aktif
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs font-semibold">{u.vault_count || 0}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          title="Lihat Detail Pengguna"
                          onClick={() => setInspectUser(u)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <div className="w-28">
                          <Select
                            disabled={updatingId === u.id}
                            value={u.role}
                            onValueChange={(val) => handleRoleChange(u.id, val as AppRole)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {!isSelf && (
                          <Button
                            variant={isSuspended ? "outline" : "ghost"}
                            size="sm"
                            className={`h-8 text-xs ${
                              isSuspended ? "text-emerald-600" : "text-destructive hover:bg-destructive/10"
                            }`}
                            onClick={() => handleToggleSuspension(u.id, u.status)}
                          >
                            {isSuspended ? "Aktifkan" : "Suspend"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Safety Notice Footer */}
      <div className="p-3 bg-muted/40 border rounded-lg text-xs text-muted-foreground flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Proteksi Lockout:</strong> Sistem memvalidasi jumlah superadmin secara langsung di Supabase Cloud. Anda tidak dapat mendemosikan akun jika hanya ada satu Superadmin yang tersisa di platform.
        </span>
      </div>

      {/* Drill-down User Modal */}
      {inspectUser && (
        <Dialog open={!!inspectUser} onOpenChange={() => setInspectUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Rincian Akun & Vault
              </DialogTitle>
              <DialogDescription className="text-xs">
                Informasi detail akun pengguna terdaftar pada basis data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <p className="font-semibold text-foreground text-sm">{inspectUser.display_name || "Tanpa Nama"}</p>
                <p className="text-muted-foreground">{inspectUser.email}</p>
                <p className="font-mono text-[10px] text-muted-foreground">UUID: {inspectUser.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-lg border bg-card">
                  <p className="text-muted-foreground text-[11px]">Total Vault Dimiliki</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{inspectUser.vault_count || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg border bg-card">
                  <p className="text-muted-foreground text-[11px]">Status Akses</p>
                  <p className="text-sm font-bold text-foreground mt-1 capitalize">{inspectUser.status || "active"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground pt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Terdaftar: {new Date(inspectUser.created_at).toLocaleDateString("id-ID", { dateStyle: "long" })}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};