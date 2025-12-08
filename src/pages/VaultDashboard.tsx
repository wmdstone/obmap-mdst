import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Database, ArrowLeft, RefreshCw, HardDrive, Zap, 
  BarChart3, Check, User, LogOut, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaultCard } from "@/components/VaultCard";
import { VaultBackupPanel } from "@/components/VaultBackupPanel";
import { VaultBackupSettingsContent } from "@/components/VaultBackupSettings";
import { VaultComparisonView } from "@/components/VaultComparisonView";
import { DatabaseSettings } from "@/components/DatabaseSettings";
import { VaultModeSelector } from "@/components/VaultModeSelector";
import { ExportToFileSystem } from "@/components/ExportToFileSystem";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getVaultManager } from "@/services/vault/VaultManagerSingleton";
import { useAuth } from "@/hooks/useAuth";

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
  const [isVaultSelectorOpen, setIsVaultSelectorOpen] = useState(false);
  const [backups, setBackups] = useState<Record<string, any[]>>({});
  const [backupConfigs, setBackupConfigs] = useState<Record<string, any>>({});
  const [settingsVaultId, setSettingsVaultId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  
  // Comparison mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  
  const vaultManager = getVaultManager();
  const syncService = vaultManager.getSyncService();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();

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

  const handleCreateLocalVault = async (folderName: string): Promise<string | null> => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      
      // Create a subdirectory with the vault name
      const vaultHandle = await dirHandle.getDirectoryHandle(
        folderName.replace(/[^a-zA-Z0-9-_\s]/g, ""), 
        { create: true }
      );
      
      const vaultId = await vaultManager.openLocalFolderVault();
      if (vaultId) {
        await loadVaults();
        toast.success(`Local vault "${folderName}" created`);
        return vaultId;
      }
      return null;
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
      if (vaultId) {
        await loadVaults();
        toast.success("Local folder vault opened");
        return vaultId;
      }
      return null;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
      return null;
    }
  };

  const handleCreateInMemoryVault = async (name: string): Promise<string | null> => {
    if (!isInitialized) {
      throw new Error("Vault system is still initializing. Please wait...");
    }

    try {
      const vaultId = await vaultManager.createInMemoryVault(name);
      vaultManager.startAutoBackup(vaultId);
      await loadVaults();
      toast.success(`In-Memory vault "${name}" created`);
      return vaultId;
    } catch (error) {
      console.error("Vault creation error:", error);
      throw error;
    }
  };

  const handleVaultCreated = (vaultId: string) => {
    handleSelectVault(vaultId);
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

  const getVaultNodes = (vaultId: string) => {
    const vault = vaultManager.getVault(vaultId);
    if (vault) {
      return vault.graphService.getGraphData().nodes;
    }
    return [];
  };

  // Comparison mode handlers
  const toggleVaultSelection = (vaultId: string) => {
    setSelectedForComparison(prev => {
      const next = new Set(prev);
      if (next.has(vaultId)) {
        next.delete(vaultId);
      } else {
        next.add(vaultId);
      }
      return next;
    });
  };

  const comparisonVaults = vaults.filter(v => selectedForComparison.has(v.id));

  const handleExitCompareMode = () => {
    setIsCompareMode(false);
    setSelectedForComparison(new Set());
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                {user && <AvatarUpload size="sm" />}
                <div>
                  <h1 className="text-2xl font-bold">Account Manager</h1>
                  <p className="text-sm text-muted-foreground">
                    {profile?.display_name || profile?.email || 'Manage your account & vaults'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="vaults" className="gap-2">
              <Database className="w-4 h-4" />
              Vaults
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            {user ? (
              <ProfileSettings />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <User className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
                <p className="text-muted-foreground mb-6">
                  Sign in to manage your profile and sync data across devices
                </p>
                <Button onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Vaults Tab */}
          <TabsContent value="vaults" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Knowledge Vaults</h2>
                <p className="text-sm text-muted-foreground">Manage your knowledge vaults</p>
              </div>
              <div className="flex items-center gap-3">
                {vaults.length >= 2 && (
                  <Button
                    variant={isCompareMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => isCompareMode ? handleExitCompareMode() : setIsCompareMode(true)}
                    className="gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {isCompareMode ? "Exit Compare" : "Compare"}
                    {isCompareMode && selectedForComparison.size > 0 && (
                      <Badge variant="default" className="ml-1 px-1.5 py-0 text-xs">
                        {selectedForComparison.size}
                      </Badge>
                    )}
                  </Button>
                )}
                <Button 
                  onClick={() => setIsVaultSelectorOpen(true)} 
                  className="gap-2" 
                  disabled={!isInitialized}
                >
                  <Plus className="w-4 h-4" />
                  New Vault
                </Button>
              </div>
            </div>

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
                  Choose where you want your workspace data to live
                </p>
                <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                  <div 
                    className="p-6 rounded-lg border bg-card hover:border-primary cursor-pointer transition-all group"
                    onClick={() => setIsVaultSelectorOpen(true)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div className="font-medium group-hover:text-primary transition-colors">Local Native</div>
                      <Badge variant="secondary" className="text-xs">Permanent</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Store as files on your computer
                    </p>
                  </div>

                  <div 
                    className="p-6 rounded-lg border bg-card hover:border-primary cursor-pointer transition-all group"
                    onClick={() => setIsVaultSelectorOpen(true)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="font-medium group-hover:text-primary transition-colors">In-Memory</div>
                      <Badge variant="outline" className="text-xs">Ephemeral</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fast temporary workspace in browser
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsVaultSelectorOpen(true)} 
                  className="mt-6"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Vault
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Comparison View */}
                {isCompareMode && comparisonVaults.length > 0 && (
                  <VaultComparisonView
                    vaults={comparisonVaults}
                    onRemoveVault={(vaultId) => toggleVaultSelection(vaultId)}
                    onClose={handleExitCompareMode}
                  />
                )}

                {isCompareMode && comparisonVaults.length === 0 && (
                  <div className="bg-muted/30 border border-dashed border-border rounded-lg p-6 text-center">
                    <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select vaults below to compare their statistics
                    </p>
                  </div>
                )}

                {/* Vault Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {vaults.map((vault) => (
                    <div key={vault.id} className="space-y-3 relative">
                      {isCompareMode && (
                        <div 
                          className="absolute -top-2 -left-2 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVaultSelection(vault.id);
                          }}
                        >
                          <div className={`
                            w-7 h-7 rounded-full flex items-center justify-center cursor-pointer
                            transition-all shadow-md
                            ${selectedForComparison.has(vault.id) 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-card border border-border hover:border-primary'
                            }
                          `}>
                            {selectedForComparison.has(vault.id) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={isCompareMode && selectedForComparison.has(vault.id) ? 'ring-2 ring-primary rounded-lg' : ''}>
                        <VaultCard
                          id={vault.id}
                          name={vault.name}
                          type={vault.type}
                          nodeCount={vault.nodeCount}
                          linkCount={vault.linkCount}
                          lastModified={vault.lastModified}
                          stats={vault.stats}
                          isActive={vault.id === activeVaultId}
                          onSelect={() => isCompareMode ? toggleVaultSelection(vault.id) : handleSelectVault(vault.id)}
                          onDelete={() => handleDeleteVault(vault.id)}
                        />
                      </div>

                      {vault.type === 'in-memory' && !isCompareMode && (
                        <div className="flex gap-2">
                          <VaultBackupPanel
                            vaultId={vault.id}
                            backups={backups[vault.id] || []}
                            onRestore={(backupId) => handleRestoreBackup(vault.id, backupId)}
                            onDelete={(backupId) => handleDeleteBackup(vault.id, backupId)}
                            onManualBackup={() => handleManualBackup(vault.id)}
                            onOpenSettings={() => setSettingsVaultId(vault.id)}
                          />
                          <ExportToFileSystem
                            vaultName={vault.name}
                            nodes={getVaultNodes(vault.id)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync" className="space-y-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Database Sync</h2>
                <p className="text-sm text-muted-foreground">
                  Connect to a database to sync your vaults across devices
                </p>
              </div>

              <div className="space-y-4">
                <DatabaseSettings
                  onConfigSave={handleSaveDatabaseConfig}
                  currentConfig={syncService.getConfig()}
                  isConnected={syncService.isConnected()}
                />

                {syncService.isConnected() && (
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handlePullFromCloud}
                      disabled={isSyncing}
                      className="flex-1"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      Pull from Cloud
                    </Button>
                    <Button
                      onClick={handleSyncToCloud}
                      disabled={isSyncing}
                      className="flex-1"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      Push to Cloud
                    </Button>
                  </div>
                )}

                {!syncService.isConnected() && (
                  <div className="bg-muted/30 border border-dashed border-border rounded-lg p-6 text-center">
                    <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Configure database settings above to enable cloud sync
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Vault Selector Dialog */}
      <VaultModeSelector
        open={isVaultSelectorOpen}
        onOpenChange={setIsVaultSelectorOpen}
        onCreateLocalVault={handleCreateLocalVault}
        onOpenLocalVault={handleOpenLocalVault}
        onCreateInMemoryVault={handleCreateInMemoryVault}
        onVaultCreated={handleVaultCreated}
      />

      {/* Vault Settings Dialog */}
      <Dialog open={!!settingsVaultId} onOpenChange={() => setSettingsVaultId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vault Settings</DialogTitle>
          </DialogHeader>
          {settingsVaultId && (
            <VaultBackupSettingsContent
              config={backupConfigs[settingsVaultId] || { timeIntervalMinutes: 5, changeThreshold: 10, maxSnapshots: 30 }}
              onSave={(config) => handleSaveBackupConfig(settingsVaultId, config)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
