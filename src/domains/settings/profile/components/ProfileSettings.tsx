import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { ProfileService } from "@/domains/settings/profile/services/ProfileService";
import { AvatarUpload } from "@/domains/settings/profile/components/AvatarUpload";
import { ApiKeyManager } from "@/domains/settings/profile/components/ApiKeyManager";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Loader2, Save, Trash2, Lock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-z0-9_-]+$/, "Hanya huruf kecil, angka, underscore (_), atau hyphen (-)")
    .optional()
    .or(z.literal("")),
  display_name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100)
    .optional(),
  bio: z.string().max(500, "Bio maksimal 500 karakter").optional(),
  is_public: z.boolean(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
    newPassword: z.string().min(8, "Kata sandi minimal 8 karakter").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Kata sandi konfirmasi tidak cocok",
    path: ["confirmPassword"],
  });

export function ProfileSettings() {
  const { user, profile, updateProfile, updatePassword, deleteAccount, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // State validasi username
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string>("");

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || "",
      display_name: profile?.display_name || "",
      bio: profile?.bio || "",
      is_public: profile?.is_public ?? true,
    },
  });

  // Sync saat profile dimuat
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        username: profile.username || "",
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        is_public: profile.is_public ?? true,
      });
    }
  }, [profile, profileForm]);

  // Debounce check ketersediaan username jika diubah
  const watchedUsername = profileForm.watch("username");
  const isUsernameChanged = Boolean(
    watchedUsername && watchedUsername.trim().toLowerCase() !== (profile?.username || "").toLowerCase()
  );

  useEffect(() => {
    if (!watchedUsername || !isUsernameChanged || watchedUsername.length < 3) {
      setUsernameAvailable(null);
      setUsernameMessage("");
      setIsCheckingUsername(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      const res = await ProfileService.checkUsernameAvailability(watchedUsername, user?.id);
      setIsCheckingUsername(false);
      setUsernameAvailable(res.available);
      setUsernameMessage(res.available ? "Username tersedia!" : (res.reason || "Username tidak tersedia"));
    }, 450);

    return () => clearTimeout(timer);
  }, [watchedUsername, isUsernameChanged, user?.id]);

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleProfileSubmit = async (data: z.infer<typeof profileSchema>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      // 1. Jika ada perubahan username, proses melalui ProfileService
      if (isUsernameChanged && data.username) {
        if (usernameAvailable === false) {
          toast.error("Username yang dipilih tidak tersedia.");
          setIsSaving(false);
          return;
        }

        const claimRes = await ProfileService.claimOrUpdateUsername(user.id, data.username);
        if (!claimRes.success) {
          toast.error(claimRes.error || "Gagal memperbarui username");
          setIsSaving(false);
          return;
        }
      }

      // 2. Simpan info profil lainnya
      const { error } = await updateProfile({
        display_name: data.display_name,
        bio: data.bio,
        is_public: data.is_public,
      });

      if (error) {
        toast.error("Gagal memperbarui profil: " + error.message);
      } else {
        toast.success("Profil berhasil diperbarui!");
        await refreshProfile();
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    setIsChangingPassword(true);
    const { error } = await updatePassword(data.newPassword);
    setIsChangingPassword(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Kata sandi berhasil diubah!");
      passwordForm.reset();
      setShowPasswordForm(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const { error } = await deleteAccount();
    setIsDeleting(false);

    if (error) {
      toast.error("Gagal menghapus akun: " + error.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profil Publik</CardTitle>
          <CardDescription>
            Kelola identitas, username, dan keterlihatan profil Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <AvatarUpload />
            <div>
              <h3 className="font-medium">
                {profile?.display_name || "Nama Anda"}
              </h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profile?.username && (
                <p className="text-xs font-mono text-primary mt-0.5">@{profile.username}</p>
              )}
            </div>
          </div>

          <Separator />

          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
            {/* Field Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username Publik</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-mono text-muted-foreground">@</span>
                <Input
                  id="username"
                  placeholder="username_anda"
                  className="pl-7 pr-10 font-mono text-sm"
                  {...profileForm.register("username", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                    },
                  })}
                />
                <div className="absolute right-3 top-2.5">
                  {isCheckingUsername && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!isCheckingUsername && isUsernameChanged && usernameAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  {!isCheckingUsername && isUsernameChanged && usernameAvailable === false && (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>

              {/* Peringatan proteksi pengalihan 14 hari saat username diganti */}
              {isUsernameChanged && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Pemberitahuan Pengalihan 14 Hari
                  </div>
                  <p className="text-muted-foreground">
                    Jika Anda mengubah username, tautan lama Anda (<code>/p/{profile?.username}/...</code>) akan dialihkan ke username baru selama <strong>14 hari</strong> sebelum nama lama dilepas untuk akun lain.
                  </p>
                </div>
              )}

              {usernameMessage && isUsernameChanged && (
                <p className={`text-xs ${usernameAvailable ? "text-emerald-500" : "text-destructive"}`}>
                  {usernameMessage}
                </p>
              )}
              {profileForm.formState.errors.username && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Nama Tampilan</Label>
              <Input
                id="display_name"
                placeholder="Mada Bajaka"
                {...profileForm.register("display_name")}
              />
              {profileForm.formState.errors.display_name && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.display_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Deskripsi Singkat</Label>
              <Textarea
                id="bio"
                placeholder="Ceritakan tentang riset atau catatan Anda..."
                rows={3}
                {...profileForm.register("bio")}
              />
              {profileForm.formState.errors.bio && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.bio.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_public">Profil Terbuka untuk Publik</Label>
                <p className="text-sm text-muted-foreground">
                  Izinkan orang lain melihat profil Anda di portal catatan publik
                </p>
              </div>
              <Switch
                id="is_public"
                checked={profileForm.watch("is_public")}
                onCheckedChange={(checked) => profileForm.setValue("is_public", checked)}
              />
            </div>

            <Button type="submit" disabled={isSaving || (isUsernameChanged && usernameAvailable === false)}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Management */}
      <Card>
        <CardHeader>
          <CardTitle>Keamanan & Kata Sandi</CardTitle>
          <CardDescription>Perbarui kata sandi akun Anda</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Ubah Kata Sandi
            </Button>
          ) : (
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Kata Sandi Saat Ini</Label>
                <Input id="currentPassword" type="password" {...passwordForm.register("currentPassword")} />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Kata Sandi Baru</Label>
                <Input id="newPassword" type="password" {...passwordForm.register("newPassword")} />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi Baru</Label>
                <Input id="confirmPassword" type="password" {...passwordForm.register("confirmPassword")} />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Kata Sandi
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowPasswordForm(false)}>
                  Batal
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* API Key Management */}
      <ApiKeyManager />

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Zona Bahaya</CardTitle>
          <CardDescription>Hapus akun beserta seluruh data secara permanen</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Hapus Akun
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apakah Anda benar-benar yakin?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini tidak dapat dibatalkan. Seluruh vault lokal maupun cloud, catatan publik, dan pengaturan profil Anda akan dihapus secara permanen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Ya, Hapus Akun Saya
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}