import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Database, FolderOpen, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VaultCard } from "@/components/VaultCard";
import { VaultBackupPanel } from "@/components/VaultBackupPanel";
import { VaultBackupSettings } from "@/components/VaultBackupSettings";
import { DatabaseSettings } from "@/components/DatabaseSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getVaultManager } from "@/services/vault/VaultManagerSingleton";

interface Vault {
  id: string;
  name: string;
  type: 'in-memory' | 'local-folder';
  nodeCount: number;
  linkCount: number;
  lastModified: number;
  stats?: {
    fileCount: number;
    folderCount: number;
    tagCount: number;
    orphanedNodes: number;
    avgConnections: number;
  };
}

export default function VaultDashboard() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [newVaultName, setNewVaultName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [backups, setBackups] = useState<Record<string, any[]>>({});
  const [backupConfigs, setBackupConfigs] = useState<Record<string, any>>({});
  const [settingsVaultId, setSettingsVaultId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const vaultManager = getVaultManager();
  const syncService = vaultManager.getSyncService();
  const navigate = useNavigate();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeVaultManager();
  }, []);

  const initializeVaultManager = async () => {
    try {
      console.log("VaultDashboard: Initializing vault manager");
      await vaultManager.initialize();
      console.log("VaultDashboard: Vault manager initialized");
      setIsInitialized(true);
      await loadVaults();
    } catch (error) {
      console.error("VaultDashboard: Failed to initialize", error);
      toast.error("Failed to initialize vault system");
    }
  };

  const loadVaults = async () => {
    const allVaults = vaultManager.getAllVaults();
    const activeVault = vaultManager.getActiveVault();
    
    const vaultData = allVaults.map(v => {
      const graphData = v.graphService.getGraphData();
      const stats = vaultManager.getVaultStats(v.id);
      return {
        id: v.id,
        name: v.name,
        type: v.type,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
        lastModified: v.lastModified,
        stats: stats || undefined,
      };
    });

    setVaults(vaultData);
    setActiveVaultId(activeVault?.id || null);

    // Load backups and configs for in-memory vaults
    const backupData: Record<string, any[]> = {};
    const configData: Record<string, any> = {};
    
    for (const vault of allVaults) {
      if (vault.type === 'in-memory') {
        backupData[vault.id] = await vaultManager.getBackups(vault.id);
        configData[vault.id] = vaultManager.getBackupConfig(vault.id);
      }
    }

    setBackups(backupData);
    setBackupConfigs(configData);
  };

  const handleCreateInMemoryVault = async () => {
    if (!newVaultName.trim()) {
      toast.error("Please enter a vault name");
      return;
    }

    if (!isInitialized) {
      toast.error("Vault system is still initializing. Please wait...");
      return;
    }

    try {
      console.log("Creating vault:", newVaultName);
      const vaultId = await vaultManager.createInMemoryVault(newVaultName);
      console.log("Vault created with ID:", vaultId);
      vaultManager.startAutoBackup(vaultId);
      console.log("Auto-backup started");
      setNewVaultName("");
      setIsDialogOpen(false);
      await loadVaults();
      toast.success(`Vault "${newVaultName}" created`);
    } catch (error) {
      console.error("Vault creation error:", error);
      toast.error(`Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpenLocalFolder = async () => {
    try {
      const vaultId = await vaultManager.openLocalFolderVault();
      if (vaultId) {
        loadVaults();
        toast.success("Local folder vault opened");
      }
    } catch (error) {
      toast.error("Failed to open local folder");
    }
  };

  const handleSelectVault = async (vaultId: string) => {
    await vaultManager.switchVault(vaultId);
    setActiveVaultId(vaultId);
    navigate("/");
    toast.success("Vault switched");
  };

  const handleDeleteVault = async (vaultId: string) => {
    if (confirm("Are you sure you want to delete this vault? All backups will also be deleted.")) {
      await vaultManager.deleteVault(vaultId);
      await loadVaults();
      toast.success("Vault deleted");
    }
  };

  const handleRestoreBackup = async (vaultId: string, backupId: string) => {
    const success = await vaultManager.restoreBackup(vaultId, backupId);
    if (success) {
      await loadVaults();
      toast.success("Backup restored successfully");
    } else {
      toast.error("Failed to restore backup");
    }
  };

  const handleDeleteBackup = async (vaultId: string, backupId: string) => {
    await vaultManager.deleteBackup(backupId);
    await loadVaults();
    toast.success("Backup deleted");
  };

  const handleManualBackup = async (vaultId: string) => {
    await vaultManager.createBackup(vaultId);
    await loadVaults();
  };

  const handleSaveBackupConfig = async (vaultId: string, config: any) => {
    vaultManager.setBackupConfig(vaultId, config);
    await loadVaults();
  };

  const handleSaveDatabaseConfig = async (config: any): Promise<boolean> => {
    const success = await syncService.setConfig(config);
    if (success) {
      toast.success('Database connected successfully');
    }
    return success;
  };

  const handleSyncToCloud = async () => {
    if (!syncService.isConnected()) {
      toast.error('No database connected. Configure database sync first.');
      return;
    }

    setIsSyncing(true);
    try {
      for (const vault of vaults) {
        if (vault.type === 'in-memory') {
          await vaultManager.syncVaultToCloud(vault.id);
        }
      }
      toast.success('All vaults synced to cloud');
    } catch (error) {
      toast.error('Failed to sync vaults');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!syncService.isConnected()) {
      toast.error('No database connected. Configure database sync first.');
      return;
    }

    setIsSyncing(true);
    try {
      await vaultManager.pullVaultsFromCloud();
      await loadVaults();
      toast.success('Vaults pulled from cloud');
    } catch (error) {
      toast.error('Failed to pull vaults');
      console.error('Pull error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Vault Manager</h1>
                <p className="text-sm text-muted-foreground">Manage your knowledge vaults</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <DatabaseSettings
                onConfigSave={handleSaveDatabaseConfig}
                currentConfig={syncService.getConfig()}
                isConnected={syncService.isConnected()}
              />

              {syncService.isConnected() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePullFromCloud}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    Pull
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncToCloud}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                </>
              )}

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={!isInitialized}>
                    <Database className="w-4 h-4" />
                    New Vault
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create In-Memory Vault</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Enter vault name..."
                      value={newVaultName}
                      onChange={(e) => setNewVaultName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateInMemoryVault()}
                    />
                    <Button onClick={handleCreateInMemoryVault} className="w-full">
                      Create Vault
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handleOpenLocalFolder} className="gap-2" disabled={!isInitialized}>
                <FolderOpen className="w-4 h-4" />
                Open Local Folder
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {!isInitialized ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Database className="w-16 h-16 text-muted-foreground mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold mb-2">Initializing Vault System...</h2>
            <p className="text-muted-foreground">Please wait while we set up your vault storage</p>
          </div>
        ) : vaults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Database className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No vaults yet</h2>
            <p className="text-muted-foreground mb-6">
              Create an in-memory vault or open a local folder to get started
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create In-Memory Vault
              </Button>
              <Button onClick={handleOpenLocalFolder}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Open Local Folder
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vaults.map((vault) => (
              <div key={vault.id} className="space-y-3">
                <VaultCard
                  id={vault.id}
                  name={vault.name}
                  type={vault.type}
                  nodeCount={vault.nodeCount}
                  linkCount={vault.linkCount}
                  lastModified={vault.lastModified}
                  stats={vault.stats}
                  isActive={vault.id === activeVaultId}
                  onSelect={() => handleSelectVault(vault.id)}
                  onDelete={() => handleDeleteVault(vault.id)}
                />
                {vault.type === 'in-memory' && backups[vault.id] && (
                  <div className="flex gap-2">
                    <VaultBackupPanel
                      vaultId={vault.id}
                      backups={backups[vault.id] || []}
                      onRestore={(backupId) => handleRestoreBackup(vault.id, backupId)}
                      onDelete={(backupId) => handleDeleteBackup(vault.id, backupId)}
                      onManualBackup={() => handleManualBackup(vault.id)}
                      onOpenSettings={() => setSettingsVaultId(vault.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {settingsVaultId && backupConfigs[settingsVaultId] && (
        <VaultBackupSettings
          vaultId={settingsVaultId}
          config={backupConfigs[settingsVaultId]}
          onSave={(config) => {
            handleSaveBackupConfig(settingsVaultId, config);
            setSettingsVaultId(null);
          }}
          trigger={<div />}
        />
      )}
    </div>
  );
}
