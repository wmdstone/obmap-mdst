/**
 * Vault lifecycle & workspace orchestration hook.
 * Bertanggung jawab atas inisialisasi vault, sinkronisasi login,
 * serta persistensi layout & config vault aktif.
 */
import { useCallback, useEffect } from "react";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import { syncCoordinator } from "@/domains/sync/SyncCoordinator";
import { eventBus, EventType } from "@/shared/events/events";
import { useNodeStore, useVaultStore, useGraphStore } from "@/shared/stores";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { refreshUndoRedoState } from "@/domains/workspace/actions/workspaceActions";

export function useVaultLifecycle() {
  const vaultManager = getVaultManager();
  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;

  const nodes = useNodeStore((s) => s.nodes);
  const setNodes = useNodeStore((s) => s.setNodes);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);
  const resetNodes = useNodeStore((s) => s.reset);

  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const setCurrentVaultId = useVaultStore((s) => s.setCurrentVaultId);
  const setVaultGraphConfig = useVaultStore((s) => s.setVaultGraphConfig);
  const resetVault = useVaultStore((s) => s.reset);

  const graphConfig = useGraphStore((s) => s.config);
  const isDirty = useGraphStore((s) => s.isDirty);
  const loadConfig = useGraphStore((s) => s.loadConfig);
  const markClean = useGraphStore((s) => s.markClean);

  const loadVaultLayout = useWorkspaceStore((s) => s.loadVaultLayout);
  const renameLeaf = useWorkspaceStore((s) => s.renameLeaf);

  const loadActiveVault = useCallback(() => {
    const activeVault = vaultManager.getActiveVault();
    if (activeVault) {
      setCurrentVaultId(activeVault.id);
      setNodes(activeVault.graphService.getGraphData().nodes);
      const savedGraphConfig = vaultManager.getGraphConfig(activeVault.id);
      setVaultGraphConfig(savedGraphConfig as never);
      loadConfig(savedGraphConfig as never);
      refreshUndoRedoState(activeVault.id);
      loadVaultLayout(activeVault.id);
    } else {
      resetVault();
      resetNodes();
      loadConfig(null);
      loadVaultLayout(null);
    }
  }, [
    vaultManager,
    setCurrentVaultId,
    setNodes,
    setVaultGraphConfig,
    loadConfig,
    resetVault,
    resetNodes,
    loadVaultLayout,
  ]);

  // Inisialisasi vault saat startup aplikasi
  useEffect(() => {
    vaultManager.initialize().then(loadActiveVault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tanggapi event pergantian vault aktif
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(EventType.VAULT_SWITCHED, () => {
      setSelectedNode(null);
      resetNodes();
      loadActiveVault();
    });
    return unsubscribe;
  }, [loadActiveVault, resetNodes, setSelectedNode]);

  // Muat ulang saat window kembali fokus
  useEffect(() => {
    const handleFocus = () => loadActiveVault();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadActiveVault]);

  // Sinkronisasi status autentikasi & cloud vault
  useEffect(() => {
    const reloadVaults = async () => {
      if (isAuthenticated) {
        await syncCoordinator.requestSync("login");
        loadActiveVault();
      } else {
        resetVault();
        resetNodes();
      }
    };
    reloadVaults();
  }, [isAuthenticated, loadActiveVault, resetVault, resetNodes]);

  // Sinkronkan judul tab jika nama note berubah
  useEffect(() => {
    nodes.forEach((node) => renameLeaf(node.id, node.name));
  }, [nodes, renameLeaf]);

  // Simpan graphConfig jika ada perubahan konfigurasi graf
  useEffect(() => {
    if (isDirty && currentVaultId) {
      vaultManager.setGraphConfig(currentVaultId, graphConfig).then(markClean);
    }
  }, [isDirty, currentVaultId, graphConfig, vaultManager, markClean]);
}