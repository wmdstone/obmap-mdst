import { FolderOpen, X, Database, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface VaultSelectorProps {
  isVaultMode: boolean;
  vaultName: string | null;
  onCloseVault: () => void;
}

export const VaultSelector = ({
  isVaultMode,
  vaultName,
  onCloseVault,
}: VaultSelectorProps) => {
  const navigate = useNavigate();

  return (
    <div className="p-4 border-b border-border bg-card/50 space-y-3">
      {!isVaultMode ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Database className="w-4 h-4" />
            <span>Demo Mode</span>
          </div>
          <Button
            onClick={() => navigate("/vaults")}
            variant="default"
            className="w-full"
            size="sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Open Vault Manager
          </Button>
          <p className="text-xs text-muted-foreground">
            Create or open vaults to store your notes
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
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
          <Badge variant="secondary" className="text-xs">
            Vault Active
          </Badge>
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
