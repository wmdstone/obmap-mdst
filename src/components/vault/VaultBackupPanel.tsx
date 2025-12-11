import { useState } from "react";
import { History, RotateCcw, Settings, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface BackupSnapshot {
  id: string;
  vaultId: string;
  timestamp: number;
  nodeCount: number;
  linkCount: number;
  description: string;
}

interface VaultBackupPanelProps {
  vaultId: string;
  backups: BackupSnapshot[];
  onRestore: (backupId: string) => void;
  onDelete: (backupId: string) => void;
  onManualBackup: () => void;
  onOpenSettings: () => void;
}

export const VaultBackupPanel = ({
  vaultId,
  backups,
  onRestore,
  onDelete,
  onManualBackup,
  onOpenSettings,
}: VaultBackupPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleRestore = (backupId: string, description: string) => {
    if (confirm(`Restore vault to: ${description}?\n\nThis will replace your current vault state.`)) {
      onRestore(backupId);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          Backups ({backups.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Vault Backups</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                onManualBackup();
                toast.success('Manual backup created');
              }}>
                <Download className="w-4 h-4 mr-2" />
                Create Backup
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No backups yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Backups are created automatically based on your settings
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup, index) => (
                <div
                  key={backup.id}
                  className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {index === 0 && (
                          <Badge variant="default" className="text-xs">Latest</Badge>
                        )}
                        <span className="text-sm font-medium">
                          {formatDistanceToNow(backup.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {backup.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{backup.nodeCount} nodes</span>
                        <span>{backup.linkCount} links</span>
                        <span>{new Date(backup.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(backup.id, backup.description)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this backup?')) {
                            onDelete(backup.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
