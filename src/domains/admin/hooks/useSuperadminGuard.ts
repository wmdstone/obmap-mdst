import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { AdminService } from "../services/AdminService";
import { toast } from "sonner";

export function useSuperadminGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      toast.error("Silakan masuk terlebih dahulu untuk mengakses area Admin.");
      navigate("/auth", { replace: true });
      return;
    }

    let isMounted = true;

    async function verifyAccess() {
      setChecking(true);

      // Cek apakah sistem belum memiliki Superadmin perdana
      const { hasSuperadmin } = await AdminService.checkSuperadminBootstrapStatus();

      if (!hasSuperadmin) {
        if (isMounted) {
          setNeedsSetup(true);
          setIsSuperadmin(true); // Izinkan masuk ke layar setup wizard
          setChecking(false);
        }
        return;
      }

      const authorized = await AdminService.isCurrentUserSuperadmin();

      if (!isMounted) return;

      if (!authorized) {
        toast.error("Akses Ditolak: Anda memerlukan hak Superadmin untuk membuka halaman ini.");
        navigate("/app", { replace: true });
        return;
      }

      setIsSuperadmin(true);
      setNeedsSetup(false);
      setChecking(false);
    }

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, navigate]);

  return {
    isAuthorized: !!isSuperadmin,
    needsSetup,
    loading: authLoading || checking,
  };
}