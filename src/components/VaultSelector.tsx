import { HardDrive, Zap, X, LayoutGrid, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

interface VaultSelectorProps {
  isVaultMode: boolean;
  vaultName: string | null;
  vaultType?: 'in-memory' | 'local-folder';
  onCloseVault: () => void;
}

export const VaultSelector = ({
  isVaultMode,
  vaultName,
  vaultType,
  onCloseVault,
}: VaultSelectorProps) => {
  const navigate = useNavigate();

  return (
    <div className="p-4 border-b border-border bg-card/50 space-y-3">
      {!isVaultMode ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Demo Mode</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Create a vault to start storing your notes permanently
          </p>
          <Button
            onClick={() => navigate("/vaults")}
            variant="default"
            className="w-full"
            size="sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Create or Open Vault
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {vaultType === 'in-memory' ? (
                <div className="p-1.5 rounded bg-amber-500/10 flex-shrink-0">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
              ) : (
                <div className="p-1.5 rounded bg-primary/10 flex-shrink-0">
                  <HardDrive className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-sm font-medium truncate">{vaultName}</span>
            </div>
            <Button
              onClick={onCloseVault}
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={vaultType === 'in-memory' ? 'outline' : 'secondary'} 
              className="text-xs"
            >
              {vaultType === 'in-memory' ? 'In-Memory' : 'Local Native'}
            </Badge>
            {vaultType === 'in-memory' && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Data may be lost if browser cache is cleared</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Button
            onClick={() => navigate("/vaults")}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Manage Vaults
          </Button>
        </div>
      )}
    </div>
  );
};
