import React, { useState } from "react";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { AdminService } from "@/domains/admin/services/AdminService";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/global/ui/card";
import { Button } from "@/global/ui/button";
import { Badge } from "@/global/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Sparkles, User, Loader2 } from "lucide-react";

interface Props {
  onClaimed: () => void;
}

export const FirstTimeSetupWizard: React.FC<Props> = ({ onClaimed }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    if (!user) return;
    setLoading(true);

    const res = await AdminService.claimInitialSuperadmin(user.id);

    setLoading(false);
    if (!res.success) {
      toast.error(res.error || "Gagal mengklaim hak Superadmin.");
      return;
    }

    toast.success("Selamat! Anda kini resmi terdaftar sebagai Superadmin perdana sistem.");
    onClaimed();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="max-w-md w-full border-primary/20 shadow-lg bg-card">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Inisiasi Superadmin Perdana</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Sistem mendeteksi belum ada Superadmin yang terkonfigurasi. Akun yang sedang aktif saat ini dapat diklaim sebagai pengelola utama platform.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Akun Yang Sedang Login:</span>
              <Badge variant="outline" className="text-[10px] bg-background">
                Sesi Aktif
              </Badge>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                {(profile?.display_name || user?.email || "U").substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">
                  {profile?.display_name || "Tanpa Nama"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Setelah Anda mengklaim hak ini, halaman aktivasi awal akan <strong>terkunci permanen</strong> demi keamanan. Superadmin berikutnya hanya bisa ditunjuk dari dalam dasbor.
            </span>
          </div>
        </CardContent>

        <CardFooter className="pt-2 flex flex-col gap-2">
          <Button onClick={handleClaim} disabled={loading} className="w-full gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            Klaim Hak Superadmin Pertama
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};