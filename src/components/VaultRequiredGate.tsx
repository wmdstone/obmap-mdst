import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Database, 
  HardDrive, 
  Zap, 
  Network, 
  FileText, 
  Link2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VaultModeSelector } from "./VaultModeSelector";
import { getVaultManager } from "@/services/vault/VaultManagerSingleton";

interface VaultRequiredGateProps {
  isVaultActive: boolean;
  onVaultCreated: (vaultId: string) => void;
  children: React.ReactNode;
}

export const VaultRequiredGate = ({
  isVaultActive,
  onVaultCreated,
  children,
}: VaultRequiredGateProps) => {
  const [isVaultSelectorOpen, setIsVaultSelectorOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const vaultManager = getVaultManager();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      await vaultManager.initialize();
      setIsInitialized(true);
    };
    init();
  }, []);

  const handleCreateLocalVault = async (folderName: string): Promise<string | null> => {
    try {
      const vaultId = await vaultManager.openLocalFolderVault();
      return vaultId;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
      return null;
    }
  };

  const handleOpenLocalVault = async (): Promise<string | null> => {
    try {
      const vaultId = await vaultManager.openLocalFolderVault();
      return vaultId;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
      return null;
    }
  };

  const handleCreateInMemoryVault = async (name: string): Promise<string | null> => {
    try {
      const vaultId = await vaultManager.createInMemoryVault(name);
      vaultManager.startAutoBackup(vaultId);
      return vaultId;
    } catch (error) {
      console.error("Vault creation error:", error);
      throw error;
    }
  };

  const handleVaultCreated = async (vaultId: string) => {
    await vaultManager.switchVault(vaultId);
    onVaultCreated(vaultId);
  };

  // If vault is active, render children normally
  if (isVaultActive) {
    return <>{children}</>;
  }

  // Show the vault-required gate
  return (
    <div className="flex h-screen overflow-hidden bg-background w-full">
      {/* Blurred/faded background showing the graph preview */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      </div>

      {/* Gate overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Icon */}
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary">
            <Database className="w-12 h-12" />
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to Your Knowledge Graph
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Create or open a vault to start building your connected knowledge base.
              Your vault is your workspace — choose where your data lives.
            </p>
          </div>

          {/* Features preview */}
          <div className="grid md:grid-cols-3 gap-4 py-6">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card/50 border border-border/50">
              <Network className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">Network Graph</span>
              <span className="text-xs text-muted-foreground">Visualize connections</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card/50 border border-border/50">
              <FileText className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">Markdown Notes</span>
              <span className="text-xs text-muted-foreground">Write with wikilinks</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card/50 border border-border/50">
              <Link2 className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">Auto-linking</span>
              <span className="text-xs text-muted-foreground">Smart backlinks</span>
            </div>
          </div>

          {/* Vault type options */}
          <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto">
            <button
              onClick={() => setIsVaultSelectorOpen(true)}
              className="group p-5 rounded-xl border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium group-hover:text-primary transition-colors">Local Native</div>
                  <Badge variant="secondary" className="text-xs mt-0.5">Permanent</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Store as files on your computer. Full file system access.
              </p>
            </button>

            <button
              onClick={() => setIsVaultSelectorOpen(true)}
              className="group p-5 rounded-xl border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium group-hover:text-primary transition-colors">In-Memory</div>
                  <Badge variant="outline" className="text-xs mt-0.5">Ephemeral</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Fast temporary workspace in browser. Can export anytime.
              </p>
            </button>
          </div>

          {/* CTA */}
          <div className="pt-4 space-y-3">
            <Button 
              size="lg" 
              onClick={() => setIsVaultSelectorOpen(true)}
              disabled={!isInitialized}
              className="px-8"
            >
              {isInitialized ? "Create Your Vault" : "Initializing..."}
            </Button>
            <p className="text-xs text-muted-foreground">
              Or{" "}
              <button 
                onClick={() => navigate("/vaults")} 
                className="text-primary hover:underline"
              >
                manage existing vaults
              </button>
            </p>
          </div>
        </div>

        {/* Decorative lock icon */}
        <div className="absolute bottom-6 right-6 text-muted-foreground/20">
          <Lock className="w-24 h-24" />
        </div>
      </div>

      {/* Vault Mode Selector Dialog */}
      <VaultModeSelector
        open={isVaultSelectorOpen}
        onOpenChange={setIsVaultSelectorOpen}
        onCreateLocalVault={handleCreateLocalVault}
        onOpenLocalVault={handleOpenLocalVault}
        onCreateInMemoryVault={handleCreateInMemoryVault}
        onVaultCreated={handleVaultCreated}
      />
    </div>
  );
};
