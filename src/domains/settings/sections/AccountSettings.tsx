/**
 * src/domains/settings/sections/AccountSettings.tsx
 * Unified Account & Profile Section
 * Murni mengelola Profil & Sesi serta Keamanan & Kredensial
 * Mendukung klaim username, live checker ketersediaan, pratinjau URL publik, dan reservasi redirect 14 hari.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  Key,
  Lock,
  Trash2,
  Loader2,
  Save,
  AtSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";
import { useAuth } from "@/domains/auth/hooks/useAuth";

import { Button } from "@/global/ui/button";
import { Badge } from "@/global/ui/badge";
import { Input } from "@/global/ui/input";
import { Label } from "@/global/ui/label";
import { Textarea } from "@/global/ui/textarea";
import { Switch } from "@/global/ui/switch";
import { Card, CardContent } from "@/global/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/global/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/global/ui/dialog";
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
} from "@/global/ui/alert-dialog";
import { toast } from "sonner";

import { AvatarUpload } from "@/domains/settings/profile/components/AvatarUpload";
import { ApiKeyManager } from "@/domains/settings/profile/components/ApiKeyManager";
import { ProfileService } from "@/domains/settings/profile/services/ProfileService";

// Schema Validasi Profil dengan Username
const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-z0-9_-]+$/, "Hanya huruf kecil, angka, underscore (_), atau strip (-)")
    .optional()
    .or(z.literal("")),
  display_name: z.string().min(2, "Nama minimal 2 karakter").max(100).optional(),
  bio: z.string().max(500, "Bio maksimal 500 karakter").optional(),
  is_public: z.boolean(),
});

// Schema Validasi Password
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini diperlukan"),
    newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export interface AccountSettingsProps {
  initialTab?: "profile" | "security" | string;
}

export function AccountSettings({ initialTab = "profile" }: { initialTab?: string }) {
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading,
    signOut,
    updatePassword,
    updateProfile,
    deleteAccount,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<string>(initialTab === "security" ? "security" : "profile");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // State Modal Keamanan (macOS Style)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // State Validasi Ketersediaan Username
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  // 1. Inisialisasi Form Profil
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || "",
      display_name: profile?.display_name || "",
      bio: profile?.bio || "",
      is_public: profile?.is_public ?? true,
    },
  });

  // 2. Inisialisasi Form Kata Sandi (Tambahkan blok ini)
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });


  // Sinkronisasi data saat profile selesai dimuat dari backend
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

  const watchedUsername = profileForm.watch("username");
  const isUsernameChanged = Boolean(
    watchedUsername &&
      watchedUsername.trim().toLowerCase() !== (profile?.username || "").toLowerCase()
  );

  // Debounced Availability Checker (450ms)
  useEffect(() => {
    if (!watchedUsername || !isUsernameChanged) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    const clean = watchedUsername.trim().toLowerCase();
    const formatCheck = ProfileService.validateUsernameFormat(clean);
    if (!formatCheck.valid) {
      setUsernameStatus("invalid");
      setUsernameMessage(formatCheck.error || "Format username tidak valid");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const res = await ProfileService.checkUsernameAvailability(clean, user?.id);
      if (res.available) {
        setUsernameStatus("available");
        setUsernameMessage("Username tersedia");
      } else {
        setUsernameStatus("taken");
        setUsernameMessage(res.reason || "Username sudah digunakan atau sedang dalam masa pengalihan");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [watchedUsername, isUsernameChanged, user?.id]);

  // Handler Submit Profil & Klaim Username
  const handleProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSavingProfile(true);

    try {
      const cleanUsername = data.username?.trim().toLowerCase();

      // Jika ada perubahan username, jalankan klaim & reservasi redirect 14 hari
      if (cleanUsername && cleanUsername !== (profile?.username || "").toLowerCase()) {
        const claimResult = await ProfileService.claimOrUpdateUsername(user.id, cleanUsername);
        if (!claimResult.success) {
          toast.error(claimResult.error || "Gagal mengklaim username.");
          setIsSavingProfile(false);
          return;
        }
        toast.info(
          "Username berhasil diperbarui. Alamat URL publik Anda telah dialihkan secara otomatis."
        );
      }

      // Update kolom display_name, bio, dan paksa is_public: true jika username ada
      const { error } = await updateProfile({
        display_name: data.display_name,
        bio: data.bio,
        is_public: Boolean(cleanUsername) ? true : Boolean(data.is_public),
      });

      if (error) throw error;

      await refreshProfile();
      toast.success("Profil dan identitas publik berhasil disimpan!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan perubahan profil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handler Ganti Password
  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsUpdatingPassword(true);
    try {
      const { error } = await updatePassword(data.newPassword);
      if (error) {
        toast.error(`Gagal memperbarui kata sandi: ${error.message}`);
      } else {
        toast.success("Kata sandi berhasil diubah");
        setIsPasswordModalOpen(false);
        passwordForm.reset();
      }
    } catch {
      toast.error("Gagal mengubah kata sandi");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handler Hapus Akun
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        toast.error(`Gagal menghapus akun: ${error.message}`);
      } else {
        toast.success("Akun berhasil dihapus");
        navigate("/auth");
      }
    } catch {
      toast.error("Gagal menghapus akun");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // State: Belum Login
  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border bg-card/40">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary">
          <User className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Sesi Akun Belum Terhubung</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
          Masuk atau buat akun Lovable Cloud untuk menyinkronkan vault catatan Anda, mengelola kredensial, dan berkolaborasi.
        </p>
        <Button onClick={() => navigate("/auth")} size="sm" className="gap-2">
          <LogIn className="w-4 h-4" /> Masuk ke Akun
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Memuat data akun...
      </div>
    );
  }

  // Tentukan apakah tombol submit harus dikunci
  const isSubmitDisabled =
    isSavingProfile ||
    usernameStatus === "checking" ||
    usernameStatus === "taken" ||
    usernameStatus === "invalid";

  const currentDisplayUsername = watchedUsername?.trim().toLowerCase() || profile?.username || "username";

  return (
    <div className="space-y-6">
      {/* 2 Sub-Tabs Bersih: [Profil & Sesi] dan [Keamanan & Kredensial] */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted/60">
          <TabsTrigger value="profile" className="text-xs sm:text-sm font-medium gap-1.5">
            <User className="w-3.5 h-3.5" />
            Profil & Sesi
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm font-medium gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Keamanan & Kredensial
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: PROFIL & SESI                                     */}
        {/* ======================================================== */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card className="border-border shadow-xs">
            {/* Top Identity Capsule */}
            <div className="p-4 sm:p-6 border-b border-border/60 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <AvatarUpload size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {profile?.display_name || user?.email?.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {profile?.username && (
                        <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
                          @{profile.username}
                        </Badge>
                      )}
                      <Badge
                        variant={profile?.email_verified ? "default" : "outline"}
                        className="text-[10px] h-4.5 px-1.5"
                      >
                        <ShieldCheck className="mr-1 h-2.5 w-2.5" />
                        {profile?.email_verified ? "Terverifikasi" : "Belum Verifikasi"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                        <Sparkles className="mr-1 h-2.5 w-2.5 text-primary" />
                        Akun Cloud
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  onClick={async () => {
                    await signOut();
                    navigate("/auth");
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar Sesi
                </Button>
              </div>
            </div>

            {/* Bottom Form Section */}
            <CardContent className="p-4 sm:p-6 space-y-4">
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                
                {/* 1. FIELD USERNAME PUBLIK DENGAN LIVE CHECKER */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="username" className="text-xs font-medium">
                      Username Publik
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Karakter a-z, 0-9, _, - (3-30 karakter)
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <AtSign className="w-3.5 h-3.5" />
                    </div>
                    <Input
                      id="username"
                      placeholder="username_anda"
                      {...profileForm.register("username")}
                      className="pl-8 pr-10 h-9 text-sm font-mono lowercase"
                      onChange={(e) => {
                        // Otomatis bersihkan spasi dan jadikan huruf kecil
                        const cleanVal = e.target.value.toLowerCase().replace(/\s+/g, "");
                        profileForm.setValue("username", cleanVal, { shouldValidate: true });
                      }}
                    />

                    {/* Status Icon Indicator */}
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {usernameStatus === "checking" && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {usernameStatus === "available" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>

                  {/* Status Helper Message */}
                  {usernameMessage && (
                    <p
                      className={`text-[11px] flex items-center gap-1 ${
                        usernameStatus === "available"
                          ? "text-emerald-500 font-medium"
                          : "text-destructive"
                      }`}
                    >
                      {usernameStatus === "available" ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 shrink-0" />
                      )}
                      {usernameMessage}
                    </p>
                  )}

                  {/* Live URL Preview Pill */}
                  <div className="mt-1.5 p-2 rounded-md bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-muted-foreground text-[11px]">URL Publik Anda:</span>
                      <code className="text-primary font-mono text-[11px] truncate">
                        {window.location.origin}/p/{currentDisplayUsername}
                      </code>
                    </div>
                    {profile?.username && (
                      <a
                        href={`/p/${profile.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0 ml-2"
                      >
                        Buka Web <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* 14-Day Redirect Reservation Alert Banner */}
                  {isUsernameChanged && profile?.username && (
                    <div className="mt-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold">Perhatian Pengalihan Alamat (14 Hari)</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Mengubah username akan mencadangkan alamat lama Anda (
                          <strong className="text-foreground">@{profile.username}</strong>) selama{" "}
                          <strong>14 hari</strong>. Semua pengunjung yang membuka tautan lama Anda akan
                          dialihkan secara otomatis ke username baru ini sebelum alamat lama dilepas ke
                          publik.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. NAMA TAMPILAN */}
                <div className="space-y-1.5">
                  <Label htmlFor="display_name" className="text-xs font-medium">
                    Nama Tampilan
                  </Label>
                  <Input
                    id="display_name"
                    placeholder="Nama lengkap atau alias Anda"
                    {...profileForm.register("display_name")}
                    className="h-9 text-sm"
                  />
                  {profileForm.formState.errors.display_name && (
                    <p className="text-[11px] text-destructive">
                      {profileForm.formState.errors.display_name.message}
                    </p>
                  )}
                </div>

                {/* 3. BIO SINGKAT */}
                <div className="space-y-1.5">
                  <Label htmlFor="bio" className="text-xs font-medium">
                    Bio Singkat
                  </Label>
                  <Textarea
                    id="bio"
                    placeholder="Ceritakan sedikit tentang Anda atau proyek catatan Anda..."
                    rows={2}
                    {...profileForm.register("bio")}
                    className="text-sm resize-none"
                  />
                </div>

                {/* 4. TOGGLE PROFIL PENULIS PUBLIK */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-card/60">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_public" className="text-xs font-medium cursor-pointer">
                      Profil Penulis Publik
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Izinkan nama dan avatar Anda muncul di header portal pembaca publik ketika menerbitkan catatan.
                    </p>
                  </div>
                  <Switch
                    id="is_public"
                    checked={profileForm.watch("is_public")}
                    onCheckedChange={(checked) => profileForm.setValue("is_public", checked)}
                  />
                </div>

                {/* TOMBOL SIMPAN */}
                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" className="gap-2" disabled={isSubmitDisabled}>
                    {isSavingProfile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: KEAMANAN & KREDENSIAL                             */}
        {/* ======================================================== */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60 shadow-xs">
            {/* Baris 1: Kata Sandi */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Kata Sandi Akun</h4>
                  <p className="text-xs text-muted-foreground">
                    Perbarui kata sandi akun secara berkala untuk menjaga keamanan ruang kerja Anda.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                Ganti Kata Sandi
              </Button>
            </div>

            {/* Baris 2: API Keys & Token */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Kunci API & Integrasi</h4>
                  <p className="text-xs text-muted-foreground">
                    Token otorisasi untuk API sinkronisasi catatan dan automasi eksternal.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setIsApiKeyModalOpen(true)}
              >
                Kelola API Keys
              </Button>
            </div>

            {/* Baris 3: Hapus Akun (Danger Zone) */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-destructive/5 hover:bg-destructive/10 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-destructive">Zona Bahaya: Hapus Akun</h4>
                  <p className="text-xs text-muted-foreground">
                    Menghapus akun Anda secara permanen beserta akses cloud vault pribadi.
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="text-xs shrink-0 gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Akun
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base text-destructive">
                      Konfirmasi Penghapusan Akun Permanen
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs">
                      Tindakan ini tidak dapat dibatalkan. Seluruh data profil Anda dan vault cloud pribadi yang terhubung akan dihapus secara permanen dari server.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="text-xs">Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="bg-destructive hover:bg-destructive/90 text-xs"
                    >
                      {isDeletingAccount ? "Menghapus..." : "Ya, Hapus Akun Saya"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog Ganti Kata Sandi */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Perbarui Kata Sandi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan kata sandi baru minimal 8 karakter.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs">Kata Sandi Saat Ini</Label>
              <Input type="password" {...passwordForm.register("currentPassword")} className="h-8 text-xs" />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-[10px] text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Kata Sandi Baru</Label>
              <Input type="password" {...passwordForm.register("newPassword")} className="h-8 text-xs" />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-[10px] text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Konfirmasi Kata Sandi Baru</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} className="h-8 text-xs" />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-[10px] text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPasswordModalOpen(false)} className="text-xs">
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isUpdatingPassword} className="text-xs">
                {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Simpan Kata Sandi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog API Keys */}
      <Dialog open={isApiKeyModalOpen} onOpenChange={setIsApiKeyModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Kunci API & Token Integrasi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kunci akses programmatic untuk berinteraksi dengan API sinkronisasi catatan graf Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ApiKeyManager />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}