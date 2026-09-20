/**
 * Per-vault storage controls: where the vault lives, and whether it also
 * syncs to the account. Location and cloud sync are independent.
 */

import { Cloud, CloudOff, HardDrive, FolderPlus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import type { VaultLocation } from "@/core/system/vault/types";

export function VaultLocationBadge({
  location,
  cloudSync,
}: {
  location: VaultLocation;
  cloudSync: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className="h-5 gap-1 text-[10px]">
        {location === "folder" ? (
          <HardDrive className="h-3 w-3" />
        ) : (
          <Cloud className="h-3 w-3" />
        )}
        {location === "folder" ? "Folder" : "Cloud"}
      </Badge>
      {cloudSync && (
        <Badge
          variant="outline"
          className="h-5 gap-1 text-[10px] text-blue-400"
        >
          <Cloud className="h-3 w-3" />
          Synced
        </Badge>
      )}
    </div>
  );
}

export function VaultStorageControls({
  location,
  cloudSync,
  isAuthenticated,
  onCloudSyncChange,
  onAttachFolder,
}: {
  location: VaultLocation;
  cloudSync: boolean;
  isAuthenticated: boolean;
  onCloudSyncChange?: (enabled: boolean) => void;
  onAttachFolder?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          {cloudSync ? (
            <Cloud className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-foreground">Cloud sync</span>
        </div>
        <Switch
          checked={cloudSync}
          disabled={!isAuthenticated || !onCloudSyncChange}
          onCheckedChange={(checked) => onCloudSyncChange?.(checked)}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {location === "folder"
          ? "Notes are Markdown files in your folder."
          : "Notes live in your account."}
        {!isAuthenticated && " Sign in to enable cloud sync."}
      </p>

      {location === "cloud" && onAttachFolder && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full gap-2 text-xs"
          onClick={onAttachFolder}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Attach a folder on this computer
        </Button>
      )}
    </div>
  );
}
