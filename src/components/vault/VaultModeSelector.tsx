import { useState } from "react";
import { 
  HardDrive, 
  Zap, 
  FolderOpen, 
  Plus, 
  AlertTriangle, 
  ArrowRight,
  Shield,
  Clock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type VaultMode = "local-native" | "in-memory";
type VaultAction = "create" | "open";

interface VaultModeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLocalVault: (folderName: string) => Promise<string | null>;
  onOpenLocalVault: () => Promise<string | null>;
  onCreateInMemoryVault: (name: string) => Promise<string | null>;
  onVaultCreated: (vaultId: string) => void;
}

export const VaultModeSelector = ({
  open,
  onOpenChange,
  onCreateLocalVault,
  onOpenLocalVault,
  onCreateInMemoryVault,
  onVaultCreated,
}: VaultModeSelectorProps) => {
  const [step, setStep] = useState<"mode" | "action" | "details">("mode");
  const [selectedMode, setSelectedMode] = useState<VaultMode | null>(null);
  const [selectedAction, setSelectedAction] = useState<VaultAction | null>(null);
  const [vaultName, setVaultName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("mode");
    setSelectedMode(null);
    setSelectedAction(null);
    setVaultName("");
    setIsCreating(false);
    setError(null);
  };

  const handleModeSelect = (mode: VaultMode) => {
    setSelectedMode(mode);
    setStep("action");
    setError(null);
  };

  const handleActionSelect = async (action: VaultAction) => {
    setSelectedAction(action);
    setError(null);

    if (action === "open" && selectedMode === "local-native") {
      // Directly open file picker for existing vault
      setIsCreating(true);
      try {
        const vaultId = await onOpenLocalVault();
        if (vaultId) {
          onVaultCreated(vaultId);
          onOpenChange(false);
          resetState();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open vault");
      } finally {
        setIsCreating(false);
      }
    } else {
      // For create actions, go to details step
      setStep("details");
    }
  };

  const handleCreate = async () => {
    if (!vaultName.trim()) {
      setError("Please enter a vault name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      let vaultId: string | null = null;

      if (selectedMode === "local-native") {
        vaultId = await onCreateLocalVault(vaultName);
      } else if (selectedMode === "in-memory") {
        vaultId = await onCreateInMemoryVault(vaultName);
      }

      if (vaultId) {
        onVaultCreated(vaultId);
        onOpenChange(false);
        resetState();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vault");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (step === "details") {
      setStep("action");
      setVaultName("");
    } else if (step === "action") {
      setStep("mode");
      setSelectedMode(null);
    }
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === "mode" && "Choose Your Workspace"}
            {step === "action" && (selectedMode === "local-native" ? "Local Native Vault" : "In-Memory Vault")}
            {step === "details" && "Create New Vault"}
          </DialogTitle>
          <DialogDescription>
            {step === "mode" && "Where do you want your workspace data to live and how permanent should it be?"}
            {step === "action" && (selectedMode === "local-native" 
              ? "Your data will be stored directly on your file system" 
              : "Your data will be stored temporarily in the browser")}
            {step === "details" && "Enter the details for your new vault"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Mode Selection */}
        {step === "mode" && (
          <div className="grid md:grid-cols-2 gap-4 py-4">
            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
              onClick={() => handleModeSelect("local-native")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      Local Native Vault
                    </CardTitle>
                    <Badge variant="secondary" className="mt-1">Permanent</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription>
                  Data is stored directly as files and folders on your computer.
                </CardDescription>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                    <span>Main, long-term knowledge base</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>External file system compatibility</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FolderOpen className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                    <span>Open standard file format</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
              onClick={() => handleModeSelect("in-memory")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      In-Memory Vault
                    </CardTitle>
                    <Badge variant="outline" className="mt-1">Ephemeral</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription>
                  Data is stored temporarily in the browser's IndexedDB.
                </CardDescription>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                    <span>Lightning fast performance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
                    <span>Quick scratchpad & testing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
                    <span>Data may be lost if cache is cleared</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Action Selection */}
        {step === "action" && (
          <div className="space-y-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                onClick={() => handleActionSelect("create")}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                      <Plus className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      Create New Vault
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {selectedMode === "local-native" 
                      ? "Create a new folder on your computer to store your notes"
                      : "Start a fresh workspace in the browser"}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md group ${
                  selectedMode === "in-memory" ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => selectedMode === "local-native" && handleActionSelect("open")}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      Open Existing Vault
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {selectedMode === "local-native" 
                      ? "Select an existing folder containing your notes"
                      : "In-Memory vaults are already listed in the dashboard"}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            <Button variant="ghost" onClick={handleBack} className="mt-2">
              ← Back to mode selection
            </Button>
          </div>
        )}

        {/* Step 3: Details Entry */}
        {step === "details" && (
          <div className="space-y-4 py-4">
            {selectedMode === "in-memory" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Data in In-Memory vaults may be lost if browser cache is cleared. 
                  You can export to local files anytime using the "Export to File System" option.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Vault Name</label>
              <Input
                placeholder={selectedMode === "local-native" ? "My Knowledge Base" : "Scratchpad Session"}
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              {selectedMode === "local-native" && (
                <p className="text-xs text-muted-foreground">
                  You'll be asked to choose a location on your computer after clicking Create.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={handleBack}>
                ← Back
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={isCreating || !vaultName.trim()}
                className="flex-1"
              >
                {isCreating ? (
                  "Creating..."
                ) : (
                  <>
                    Create Vault
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
