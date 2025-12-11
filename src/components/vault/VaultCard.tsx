import { HardDrive, Zap, Trash2, Clock, Network, FileText, Tag, Link2, AlertTriangle, FolderOpen, Cloud, Settings } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { StorageStrategy, STORAGE_STRATEGY_LABELS } from "@/services/vault/types";
import { StorageStrategySelector, StorageStrategyBadge } from "./StorageStrategySelector";
import { useState } from "react";

interface VaultCardProps {
  id: string;
  name: string;
  type: 'in-memory' | 'local-folder';
  storageStrategy: StorageStrategy;
  nodeCount: number;
  linkCount: number;
  lastModified: number;
  isActive: boolean;
  isAuthenticated?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onStorageStrategyChange?: (strategy: StorageStrategy) => void;
  stats?: {
    fileCount: number;
    folderCount: number;
    tagCount: number;
    orphanedNodes: number;
    avgConnections: number;
  };
}

export const VaultCard = ({
  name,
  type,
  storageStrategy,
  nodeCount,
  linkCount,
  lastModified,
  isActive,
  isAuthenticated = false,
  onSelect,
  onDelete,
  onStorageStrategyChange,
  stats,
}: VaultCardProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getVaultIcon = () => {
    if (storageStrategy === 'cloud') {
      return <Cloud className="w-5 h-5 text-blue-500" />;
    }
    if (type === 'in-memory') {
      return <Zap className="w-5 h-5 text-amber-500" />;
    }
    return <HardDrive className="w-5 h-5 text-primary" />;
  };

  const getVaultIconBg = () => {
    if (storageStrategy === 'cloud') {
      return 'bg-blue-500/10';
    }
    if (type === 'in-memory') {
      return 'bg-amber-500/10';
    }
    return 'bg-primary/10';
  };

  return (
    <Card className={`cursor-pointer transition-all hover:shadow-lg ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getVaultIconBg()}`}>
              {getVaultIcon()}
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <StorageStrategyBadge strategy={storageStrategy} />
                {storageStrategy === 'memory' && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Data may be lost if browser cache is cleared</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="default" className="text-xs">Active</Badge>
            )}
            {type === 'in-memory' && onStorageStrategyChange && (
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Vault Storage Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Storage Strategy</label>
                      <p className="text-xs text-muted-foreground">
                        Choose where this vault's data is stored
                      </p>
                      <StorageStrategySelector
                        value={storageStrategy}
                        onChange={(strategy) => {
                          onStorageStrategyChange(strategy);
                          setIsSettingsOpen(false);
                        }}
                        isAuthenticated={isAuthenticated}
                        disabled={storageStrategy === 'filesystem'}
                      />
                    </div>
                    {storageStrategy === 'cloud' && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          This vault will automatically sync to your cloud account when changes are made.
                        </p>
                      </div>
                    )}
                    {storageStrategy === 'memory' && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          This vault is stored locally only. Enable "Cloud Sync" to back up to the cloud.
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Network className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-foreground">{nodeCount}</div>
              <div className="text-xs text-muted-foreground">Total Nodes</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-foreground">{linkCount}</div>
              <div className="text-xs text-muted-foreground">Connections</div>
            </div>
          </div>
        </div>

        {stats && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.fileCount}</span> files
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.folderCount}</span> folders
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.tagCount}</span> tags
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.avgConnections.toFixed(1)}</span> avg
                </span>
              </div>
            </div>
            {stats.orphanedNodes > 0 && (
              <Badge variant="outline" className="text-xs w-fit">
                {stats.orphanedNodes} orphaned node{stats.orphanedNodes > 1 ? 's' : ''}
              </Badge>
            )}
          </>
        )}
        
        <Separator />
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Modified {formatDistanceToNow(lastModified, { addSuffix: true })}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button 
          onClick={onSelect} 
          variant={isActive ? "secondary" : "default"}
          className="flex-1"
          disabled={isActive}
        >
          {isActive ? 'Current Vault' : 'Open Vault'}
        </Button>
        <Button 
          onClick={onDelete} 
          variant="ghost" 
          size="icon"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};
