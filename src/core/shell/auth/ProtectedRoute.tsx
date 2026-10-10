import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/core/shell/auth/hooks/useAuth";
import { isDevAuthEnabled, devQuickLogin } from "@/core/shell/auth/devAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [attemptedAutoLogin, setAttemptedAutoLogin] = useState(false);

  useEffect(() => {
    const isManualLogout = sessionStorage.getItem("dev_manual_logout") === "true";

    // Jika di development, belum ada user, dan bukan karena sengaja klik logout
    if (!loading && !user && isDevAuthEnabled && !isManualLogout && !attemptedAutoLogin) {
      setIsAutoLoggingIn(true);
      setAttemptedAutoLogin(true);
      devQuickLogin()
        .catch((err) => console.warn("Auto dev login failed:", err))
        .finally(() => setIsAutoLoggingIn(false));
    }
  }, [loading, user, attemptedAutoLogin]);

  if (loading || isAutoLoggingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {isAutoLoggingIn && (
          <p className="text-xs text-muted-foreground animate-pulse font-mono">
            Auto-authenticating dev workspace...
          </p>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}