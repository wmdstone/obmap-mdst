/**
 * Workspace shell: ribbon + split tree of leaves + status bar.
 * On mobile only the active group is shown.
 */

import { Ribbon } from "@/core/shell/workspace/Ribbon";
import { StatusBar } from "@/core/shell/workspace/StatusBar";
import { WorkspaceTree } from "@/core/shell/workspace/WorkspaceTree";
import { WorkspaceGroup } from "@/core/shell/workspace/WorkspaceGroup";
import { VaultSessionProvider } from "@/core/shell/workspace/VaultSessionContext";
import { useWorkspaceStore } from "@/core/shell/workspace/store/useWorkspaceStore";
import { useIsMobile } from "@/shared/hooks/useMobile";
import { PWAInstallPrompt } from "@/core/system/sync/PWAInstallPrompt";
import { useConfigSync } from "@/core/system/config";

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
      <div className="flex-1 min-h-0 flex">
        <Ribbon />
        <div className="flex-1 min-w-0">
          {isMobile ? (
            activeGroup && <WorkspaceGroup group={activeGroup} isActive />
          ) : (
            <WorkspaceTree node={root} />
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

export function WorkspaceRoot() {
  return (
    <VaultSessionProvider>
      {/* <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
        <OfflineIndicator />
      </div> */}
      <WorkspaceShell />
      <PWAInstallPrompt variant="banner" showOfflineStatus />
    </VaultSessionProvider>
  );
}
