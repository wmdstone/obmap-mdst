import { useState } from "react";
import { Ribbon } from "@/domains/workspace/components/Ribbon";
import { StatusBar } from "@/domains/workspace/components/StatusBar";
import { WorkspaceTree } from "@/domains/workspace/components/WorkspaceTree";
import { WorkspaceGroup } from "@/domains/workspace/components/WorkspaceGroup";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { useIsMobile } from "@/global/hooks/useMobile";
import { PWAInstallPrompt } from "@/domains/sync/components/PWAInstallPrompt";
import { useConfigSync } from "@/domains/settings/config";
import { AppPreloaderScreen } from "@/app/preloader/AppPreloaderScreen";
import { useVaultLifecycle } from "@/domains/workspace/hooks/useVaultLifecycle";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { VaultAccessDenied } from "@/domains/workspace/components/VaultAccessDenied";


function WorkspaceShell() {
  const { hydrated } = useConfigSync();
  const isMobile = useIsMobile();
  const root = useWorkspaceStore((s) => s.root);
  const activeGroup = useWorkspaceStore((s) => s.getActiveGroup());

  if (!hydrated) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* 
        1. STATUS BAR:
        - Mobile & Tablet (< lg): Menjadi TOP BAR (order-1)
        - Desktop (>= lg): Menjadi BOTTOM BAR (lg:order-2)
      */}
      <div className="order-1 lg:order-2 shrink-0">
        <StatusBar />
      </div>

      {/* 
        2. KONTEN UTAMA WORKSPACE (Ribbon + Leaf / Tree):
        - Mobile & Tablet (< lg): Berada di bawah StatusBar (order-2)
        - Desktop (>= lg): Berada di paling atas (lg:order-1)
      */}
      <div className="flex-1 min-h-0 flex order-2 lg:order-1">
        <Ribbon />
        <div className="flex-1 min-w-0">
          {isMobile ? (
            activeGroup && <WorkspaceGroup group={activeGroup} isActive />
          ) : (
            <WorkspaceTree node={root} />
          )}
          <VaultAccessDenied />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceRoot() {
  // Jalankan lifecycle vault murni Zustand
  useVaultLifecycle();

  // Flag preloaded untuk sesi aktif
  const [isPreloaded, setIsPreloaded] = useState(false);

  if (!isPreloaded) {
    return <AppPreloaderScreen onLoaded={() => setIsPreloaded(true)} />;
  }

  return (
    <>
      <WorkspaceShell />
      <PWAInstallPrompt variant="banner" showOfflineStatus />
    </>
  );
}