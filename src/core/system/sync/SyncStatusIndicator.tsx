import { useEffect, useState } from "react";
import { Cloud, CloudOff, CheckCircle, RefreshCw, User } from "lucide-react";
import { eventBus, EventType } from "@/shared/events/events";
import { syncEngine } from "@/core/system/sync/SyncEngine";
import { useVaultSync } from "@/core/system/vault/hooks/useVaultSync";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

interface SyncStatusIndicatorProps {
  compact?: boolean;
}

export function SyncStatusIndicator({
  compact = false,
}: SyncStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  const { syncStatus, lastSyncTime, isAuthenticated, syncCurrentVault } =
    useVaultSync();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Pending cloud pushes come from the sync engine's durable queue.
    setPendingCount(syncEngine.getPendingCount());
    const unsubscribePending = syncEngine.onPendingChange(setPendingCount);

    // Listen for sync complete
    const unsubscribe = eventBus.subscribe(
      EventType.VAULT_SYNC_COMPLETE,
      () => {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      },
    );

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribePending();
      unsubscribe();
    };
  }, []);

  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const diff = Date.now() - lastSyncTime.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const handleSyncClick = async () => {
    await syncCurrentVault();
  };

  if (!isOnline) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm">
        <CloudOff className="w-4 h-4" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-destructive/20 text-xs font-medium">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Show cloud sync status for authenticated users
  if (isAuthenticated) {
    const isSyncing = syncStatus === "syncing";
    const lastSyncText = formatLastSync();

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSyncClick}
              disabled={isSyncing}
              className={
                compact
                  ? "h-5 gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "flex h-auto items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : syncStatus === "synced" || justSynced ? (
                <CheckCircle className="w-4 h-4" />
              ) : syncStatus === "error" ? (
                <CloudOff className="w-4 h-4 text-destructive" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span>
                {isSyncing
                  ? "Syncing..."
                  : justSynced
                    ? "Synced"
                    : syncStatus === "error"
                      ? "Sync Error"
                      : compact
                        ? "Cloud Sync"
                        : "Cloud"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side={compact ? "top" : "bottom"}>
            <div className="text-xs">
              <p className="font-medium">Cloud Sync</p>
              {lastSyncText && (
                <p className="text-muted-foreground">
                  Last synced: {lastSyncText}
                </p>
              )}
              <p className="text-muted-foreground mt-1">
                Click to sync current vault
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Not authenticated - show basic online status
  if (compact) return null;
  if (justSynced) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm animate-in fade-in">
        <CheckCircle className="w-4 h-4" />
        <span>Synced</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
        <Cloud className="w-4 h-4 animate-pulse" />
        <span>Syncing...</span>
        <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-xs font-medium">
          {pendingCount}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm cursor-default">
            <User className="w-4 h-4" />
            <span>Local</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Sign in to enable cloud sync</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
