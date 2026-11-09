import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { ProfileService } from "@/domains/settings/profile/services/ProfileService";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2, XCircle, AtSign } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid").max(255),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-z0-9_-]+$/, "Hanya huruf kecil, angka, underscore (_), atau hyphen (-)"),
  email: z.string().email("Format email tidak valid").max(255),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(72),
  displayName: z.string().min(2, "Nama minimal 2 karakter").max(100).optional(),
});

const resetSchema = z.object({
  email: z.string().email("Format email tidak valid").max(255),
});

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Kata sandi minimal 8 karakter").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Kata sandi konfirmasi tidak cocok",
    path: ["confirmPassword"],
  });

type AuthMode = "login" | "register" | "reset" | "update-password";

interface AuthFormProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthForm({ initialMode = "login", onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();

  // State ketersediaan username saat registrasi
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string>("");

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", displayName: "" },
    mode: "onChange",
  });

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const updatePasswordForm = useForm({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Debounce check ketersediaan username
  const watchedUsername = registerForm.watch("username");
  useEffect(() => {
    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameAvailable(null);
      setUsernameMessage("");
      setIsCheckingUsername(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      const res = await ProfileService.checkUsernameAvailability(watchedUsername);
      setIsCheckingUsername(false);
      setUsernameAvailable(res.available);
      setUsernameMessage(res.available ? "Username tersedia!" : (res.reason || "Username tidak tersedia"));
    }, 450);

    return () => clearTimeout(timer);
  }, [watchedUsername]);

  const handleLogin = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Selamat datang kembali!");
      onSuccess?.();
    }
  };

  const handleRegister = async (data: z.infer<typeof registerSchema>) => {
    if (usernameAvailable === false) {
      toast.error("Silakan pilih username lain yang masih tersedia.");
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.displayName, data.username);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Email ini sudah terdaftar. Silakan login.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi.");
      setMode("login");
    }
  };

  const handleReset = async (data: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    const { error } = await resetPassword(data.email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tautan reset kata sandi telah dikirim ke email Anda.");
      setMode("login");
    }
  };

  const handleUpdatePassword = async (data: z.infer<typeof updatePasswordSchema>) => {
    setIsLoading(true);
    const { error } = await updatePassword(data.password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Kata sandi berhasil diperbarui!");
      onSuccess?.();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {mode === "login" && "Masuk ke Akun"}
          {mode === "register" && "Daftar Akun Baru"}
          {mode === "reset" && "Atur Ulang Kata Sandi"}
          {mode === "update-password" && "Kata Sandi Baru"}
        </CardTitle>
        <CardDescription>
          {mode === "login" && "Masuk untuk menyinkronkan vault dan graf visual Anda"}
          {mode === "register" && "Buat akun untuk mengelola dan mempublikasikan catatan Anda"}
          {mode === "reset" && "Masukkan email Anda untuk menerima instruksi pemulihan"}
          {mode === "update-password" && "Buat kata sandi baru untuk akun Anda"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {mode === "login" && (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="nama@email.com" className="pl-9" {...loginForm.register("email")} />
              </div>
              {loginForm.formState.errors.email && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Kata Sandi</Label>
                <button type="button" onClick={() => setMode("reset")} className="text-xs text-primary hover:underline">
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Masuk
            </Button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            {/* Input Username Wajib */}
            <div className="space-y-2">
              <Label htmlFor="register-username">Username Publik <span className="text-destructive">*</span></Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-username"
                  placeholder="username_anda"
                  className="pl-9 pr-10 font-mono text-sm"
                  {...registerForm.register("username", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                    },
                  })}
                />
                <div className="absolute right-3 top-3">
                  {isCheckingUsername && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!isCheckingUsername && usernameAvailable === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {!isCheckingUsername && usernameAvailable === false && <XCircle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
              {usernameMessage && (
                <p className={`text-xs ${usernameAvailable ? "text-emerald-500" : "text-destructive"}`}>
                  {usernameMessage}
                </p>
              )}
              {registerForm.formState.errors.username && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.username.message}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Digunakan untuk alamat URL publik Anda: /p/<span className="text-foreground font-mono">{watchedUsername || "username"}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Nama Tampilan</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="displayName" placeholder="Mada Bajaka" className="pl-9" {...registerForm.register("displayName")} />
              </div>
              {registerForm.formState.errors.displayName && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="register-email" type="email" placeholder="nama@email.com" className="pl-9" {...registerForm.register("email")} />
              </div>
              {registerForm.formState.errors.email && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-password">Kata Sandi</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  {...registerForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={registerForm.watch("password") || ""} />
              {registerForm.formState.errors.password && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || usernameAvailable === false}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Daftar Sekarang
            </Button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="reset-email" type="email" placeholder="nama@email.com" className="pl-9" {...resetForm.register("email")} />
              </div>
              {resetForm.formState.errors.email && (
                <p className="text-xs text-destructive">{resetForm.formState.errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Kirim Tautan Pemulihan
            </Button>
          </form>
        )}

        {mode === "update-password" && (
          <form onSubmit={updatePasswordForm.handleSubmit(handleUpdatePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Kata Sandi Baru</Label>
              <Input id="new-password" type="password" {...updatePasswordForm.register("password")} />
              <PasswordStrengthIndicator password={updatePasswordForm.watch("password") || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Kata Sandi</Label>
              <Input id="confirm-password" type="password" {...updatePasswordForm.register("confirmPassword")} />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Perbarui Kata Sandi
            </Button>
          </form>
        )}

        {(mode === "login" || mode === "register") && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">atau lanjutkan dengan</span>
              </div>
            </div>

            <Button variant="outline" type="button" className="w-full" onClick={() => signInWithGoogle()}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google
            </Button>
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-center">
        {mode === "login" && (
          <p className="text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <button onClick={() => setMode("register")} className="text-primary font-medium hover:underline">
              Daftar
            </button>
          </p>
        )}
        {mode === "register" && (
          <p className="text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
              Masuk
            </button>
          </p>
        )}
        {(mode === "reset" || mode === "update-password") && (
          <button onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
            Kembali ke halaman masuk
          </button>
        )}
      </CardFooter>
    </Card>
  );
}