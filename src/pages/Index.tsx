import { useMemo, useEffect, useCallback } from 'react';
import { NetworkGraph } from '@/features/graph/NetworkGraph';
import { NodePanel } from '@/features/graph/NodePanel';
import { UnifiedLayout } from '@/features/workspace/UnifiedLayout';
import { GraphConfigPanel } from '@/features/graph/config-panel';
import {
  PWAInstallPrompt,
  PWAStatusBadge,
} from "@/shared/components/PWAInstallPrompt";
import { SyncStatusIndicator } from '@/features/sync/SyncStatusIndicator';
import { OfflineIndicator } from '@/features/sync/OfflineIndicator';
import { AutoSaveIndicator } from '@/features/sync/AutoSaveIndicator';
import { toast } from 'sonner';
import { extractMentions } from '@/core/metadata/markdown-parser';
import { getVaultManager } from '@/core/vault/VaultManagerSingleton';
import { useAutoLinks } from "@/features/graph/hooks/useAutoLinks";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { vaultSyncService } from '@/core/vault/VaultSyncService';
import { 
  useNodeStore, 
  useVaultStore, 
  useGraphStore,
  type Node, 
  type GraphData, 
  type Backlink,
  type GraphConfigState,
} from '@/shared/stores';

const Index = () => {
  const vaultManager = getVaultManager();
  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;

  // Node store
  const nodes = useNodeStore((state) => state.nodes);
  const selectedNode = useNodeStore((state) => state.selectedNode);
  const setNodes = useNodeStore((state) => state.setNodes);
  const setSelectedNode = useNodeStore((state) => state.setSelectedNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const deleteNodes = useNodeStore((state) => state.deleteNodes);
  const addNodeToStore = useNodeStore((state) => state.addNode);
  const moveNodeInStore = useNodeStore((state) => state.moveNode);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const getDescendants = useNodeStore((state) => state.getDescendants);
  const resetNodes = useNodeStore((state) => state.reset);

  // Vault store
  const currentVaultId = useVaultStore((state) => state.currentVaultId);
  const vaultGraphConfig = useVaultStore((state) => state.vaultGraphConfig);
  const saveStatus = useVaultStore((state) => state.saveStatus);
  const lastSaved = useVaultStore((state) => state.lastSaved);
  const canUndo = useVaultStore((state) => state.canUndo);
  const canRedo = useVaultStore((state) => state.canRedo);
  const setCurrentVaultId = useVaultStore((state) => state.setCurrentVaultId);
  const setVaultGraphConfig = useVaultStore((state) => state.setVaultGraphConfig);
  const setSaveStatus = useVaultStore((state) => state.setSaveStatus);
  const setLastSaved = useVaultStore((state) => state.setLastSaved);
  const updateUndoRedoState = useVaultStore((state) => state.updateUndoRedoState);
  const resetVault = useVaultStore((state) => state.reset);

  // Graph store
  const graphConfig = useGraphStore((state) => state.config);
  const graphStats = useGraphStore((state) => state.stats);
  const isDirty = useGraphStore((state) => state.isDirty);
  const updateNodeConfig = useGraphStore((state) => state.updateNodeConfig);
  const updateLinkConfig = useGraphStore((state) => state.updateLinkConfig);
  const updateTopologyConfig = useGraphStore((state) => state.updateTopologyConfig);
  const updateTopologyStyle = useGraphStore((state) => state.updateTopologyStyle);
  const updateForceConfig = useGraphStore((state) => state.updateForceConfig);
  const resetConfig = useGraphStore((state) => state.resetConfig);
  const loadConfig = useGraphStore((state) => state.loadConfig);
  const computeStats = useGraphStore((state) => state.computeStats);
  const markClean = useGraphStore((state) => state.markClean);

  // Helper to save with status indicator and cloud sync
  const saveVault = useCallback(async () => {
    if (!currentVaultId) return;

    setSaveStatus('saving');
    try {
      await vaultManager.saveCurrentVault();
      await vaultManager.recordVaultChange(currentVaultId);

      // If authenticated, sync to cloud
      if (isAuthenticated) {
        await vaultSyncService.syncVaultToCloud(vaultManager, currentVaultId);
      }

      setSaveStatus('saved');
      setLastSaved(new Date());
    } catch (error) {
      setSaveStatus('error');
      console.error('Save failed:', error);
    }
  }, [currentVaultId, vaultManager, isAuthenticated, setSaveStatus, setLastSaved]);

  // Save graph config to vault when dirty
  useEffect(() => {
    if (isDirty && currentVaultId) {
      const saveConfig = async () => {
        await vaultManager.setGraphConfig(currentVaultId, graphConfig);
        markClean();
      };
      saveConfig();
    }
  }, [isDirty, currentVaultId, graphConfig, vaultManager, markClean]);

  // Auto-generate links based on topology config
  const autoLinks = useAutoLinks(nodes, {
    hierarchy: graphConfig.topology.showHierarchy,
    tags: graphConfig.topology.showTags,
    backlinks: graphConfig.topology.showBacklinks,
    tagThreshold: graphConfig.topology.tagThreshold,
  });

  // Compute stats when nodes/links change
  useEffect(() => {
    computeStats(nodes, autoLinks);
  }, [nodes, autoLinks, computeStats]);

  // Memoized graphData with auto-generated links
  const graphData = useMemo<GraphData>(
    () => ({
      nodes,
      links: autoLinks.map((link) => ({
        source: link.source,
        target: link.target,
        type: link.type,
      })),
    }),
    [nodes, autoLinks]
  );

  // Wrapper to update graphData via nodes
  const setGraphData = useCallback((data: GraphData) => {
    setNodes(data.nodes);
  }, [setNodes]);

  const refreshUndoRedoState = useCallback((vaultId: string) => {
    updateUndoRedoState(
      vaultManager.canUndo(vaultId),
      vaultManager.canRedo(vaultId)
    );
  }, [vaultManager, updateUndoRedoState]);

  const loadActiveVault = useCallback(() => {
    const activeVault = vaultManager.getActiveVault();
    if (activeVault) {
      setCurrentVaultId(activeVault.id);
      const vaultGraphData = activeVault.graphService.getGraphData();
      setNodes(vaultGraphData.nodes);
      // Load per-vault graph config (from .vault-config.json for local-folder, IndexedDB for in-memory)
      const savedGraphConfig = vaultManager.getGraphConfig(activeVault.id);
      setVaultGraphConfig(savedGraphConfig);
      // Load config into graph store
      loadConfig(savedGraphConfig);
      refreshUndoRedoState(activeVault.id);
    } else {
      resetVault();
      resetNodes();
      loadConfig(null);
    }
  }, [vaultManager, setCurrentVaultId, setNodes, setVaultGraphConfig, loadConfig, refreshUndoRedoState, resetVault, resetNodes]);

  useEffect(() => {
    const initVaultManager = async () => {
      await vaultManager.initialize();
      loadActiveVault();
    };
    initVaultManager();
  }, []);

  // Listen for vault changes when navigating back from dashboard
  useEffect(() => {
    const handleFocus = () => {
      loadActiveVault();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadActiveVault]);

  // Reload vaults when authentication state changes
  useEffect(() => {
    const reloadVaults = async () => {
      if (isAuthenticated) {
        // User logged in - sync from cloud
        await vaultManager.initialize();
        await vaultSyncService.syncFromCloud(vaultManager);
        loadActiveVault();
      } else {
        // User logged out - clear state
        resetVault();
        resetNodes();
      }
    };
    reloadVaults();
  }, [isAuthenticated, vaultManager, loadActiveVault, resetVault, resetNodes]);

  // Calculate backlinks for a given node
  const getBacklinksForNode = useCallback((targetNode: Node): Backlink[] => {
    if (!targetNode || targetNode.type === 'folder') return [];

    const links: Backlink[] = [];

    nodes.forEach((node) => {
      if (node.id === targetNode.id || node.type === 'folder') return;

      // Check for explicit wikilinks
      if (node.wikilinks && node.wikilinks.includes(targetNode.name)) {
        links.push({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: getNodePath(node.id),
          isWikilink: true,
        });
      }
      // Check for unlinked mentions
      else if (extractMentions(node.content, targetNode.name)) {
        links.push({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: getNodePath(node.id),
          isWikilink: false,
        });
      }
    });

    return links;
  }, [nodes, getNodePath]);

  // Calculate backlinks for the selected node
  const backlinks = useMemo((): Backlink[] => {
    if (!selectedNode) return [];
    return getBacklinksForNode(selectedNode);
  }, [selectedNode, getBacklinksForNode]);

  const handleCloseVault = async () => {
    if (!currentVaultId) return;

    await vaultManager.deleteVault(currentVaultId);
    resetVault();
    resetNodes();
    toast.info('Vault closed');
  };

  const handleNodeUpdate = async (updatedNode: Node) => {
    updateNode(updatedNode);

    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        vault.graphService.setNode(updatedNode);
        // Links are auto-generated, pass empty links - they'll be rebuilt from nodes
        vault.history.addState(nodes.map((n) => n.id === updatedNode.id ? updatedNode : n), []);
        await saveVault();
        refreshUndoRedoState(currentVaultId);
      }
    }
  };

  const handleNodeDelete = async (nodeId: string) => {
    const nodeToDelete = nodes.find((n) => n.id === nodeId);

    // If deleting a folder, also delete all its children recursively
    const nodesToDelete = new Set<string>([nodeId]);

    if (nodeToDelete?.type === 'folder') {
      const descendants = getDescendants(nodeId);
      descendants.forEach((d) => nodesToDelete.add(d.id));
    }

    deleteNodes(nodesToDelete);

    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        nodesToDelete.forEach((id) => {
          vault.graphService.deleteNode(id);
        });

        const updatedNodes = nodes.filter((node) => !nodesToDelete.has(node.id));
        vault.history.addState(updatedNodes, []);
        await saveVault();
        refreshUndoRedoState(currentVaultId);
      }
    }
  };

  const handleNodeMove = async (nodeId: string, newParentId: string | null) => {
    const node = nodes.find((n) => n.id === nodeId);
    const newParent = newParentId
      ? nodes.find((n) => n.id === newParentId)
      : null;

    if (!node) return;

    // Only folders can have children
    if (newParent && newParent.type !== 'folder') {
      toast.error('Only folders can contain children');
      return;
    }

    // Calculate new depth
    const newDepth = newParent ? newParent.depth + 1 : 0;

    moveNodeInStore(nodeId, newParentId, newDepth);

    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        // Get updated nodes after the move
        const updatedNodes = useNodeStore.getState().nodes;
        updatedNodes.forEach((updatedNode) => {
          vault.graphService.setNode(updatedNode);
        });

        vault.history.addState(updatedNodes, []);
        await saveVault();
        refreshUndoRedoState(currentVaultId);
      }
    }

    toast.success(
      `Moved "${node.name}" to ${newParent ? newParent.name : 'root'}`
    );
  };

  const handleAddNode = useCallback(
    async (type: 'folder' | 'file') => {
      // Only folders can have children - enforce this rule
      const parentNode =
        selectedNode && selectedNode.type === 'folder' ? selectedNode : null;

      if (selectedNode && selectedNode.type === 'file') {
        toast.error(
          'Files cannot contain children. Please select a folder or create at root level.'
        );
        return;
      }

      const depth = parentNode ? parentNode.depth + 1 : 0;

      const newNode: Node = {
        id: `node-${Date.now()}`,
        name:
          type === 'folder'
            ? `New Folder ${nodes.filter((n) => n.type === 'folder').length + 1}`
            : `New File ${nodes.filter((n) => n.type === 'file').length + 1}`,
        content: '',
        type,
        parentId: parentNode?.id || null,
        depth,
        tags: [],
      };

      addNodeToStore(newNode);
      setSelectedNode(newNode);

      // Update vault if active
      if (currentVaultId) {
        const vault = vaultManager.getVault(currentVaultId);
        if (vault) {
          vault.graphService.setNode(newNode);
          vault.history.addState([...nodes, newNode], []);
          await saveVault();
          refreshUndoRedoState(currentVaultId);
        }
      }

      toast.success(`${type === 'folder' ? 'Folder' : 'File'} created!`);
    },
    [currentVaultId, nodes, saveVault, selectedNode, vaultManager, addNodeToStore, setSelectedNode, refreshUndoRedoState]
  );

  const handleWikilinkClick = (target: string) => {
    // Find the node by name
    const targetNode = graphData.nodes.find(
      (node) =>
        node.name.toLowerCase() === target.toLowerCase() && node.type === 'file'
    );

    if (targetNode) {
      setSelectedNode(targetNode);
      toast.success(`Navigated to ${targetNode.name}`);
    } else {
      toast.error(`Note "${target}" not found`);
    }
  };

  const handleBacklinkClick = (nodeId: string) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
    }
  };

  const handleTagClick = (tag: string) => {
    // Find nodes with this tag
    const nodesWithTag = graphData.nodes.filter((node) =>
      node.tags.includes(tag)
    );

    if (nodesWithTag.length > 0) {
      toast.info(`Found ${nodesWithTag.length} note(s) with tag #${tag}`);
    } else {
      toast.error(`No notes found with tag #${tag}`);
    }
  };

  // Placeholder simulation controls
  const handleReheatSimulation = () => {
    toast.info('Simulation reheated');
  };

  const handleStopSimulation = () => {
    toast.info('Simulation stopped');
  };

  const graphConfigTrigger = (
    <GraphConfigPanel
      config={graphConfig}
      stats={graphStats}
      onNodeConfigUpdate={updateNodeConfig}
      onLinkConfigUpdate={updateLinkConfig}
      onTopologyConfigUpdate={updateTopologyConfig}
      onTopologyStyleUpdate={updateTopologyStyle}
      onForceConfigUpdate={updateForceConfig}
      onReset={resetConfig}
      onReheatSimulation={handleReheatSimulation}
      onStopSimulation={handleStopSimulation}
      onNodeSelect={(nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) setSelectedNode(node);
      }}
      variant='compact'
    />
  );

  const handleImportComplete = useCallback(
    async (importedNodes: Node[], updatedNodes?: Node[]) => {
      let result = [...nodes, ...importedNodes];
      if (updatedNodes && updatedNodes.length > 0) {
        const updateMap = new Map(updatedNodes.map((n) => [n.id, n]));
        result = result.map((node) => updateMap.get(node.id) || node);
      }
      setNodes(result);
      
      if (currentVaultId) {
        const vault = vaultManager.getVault(currentVaultId);
        if (vault) {
          result.forEach((n) => vault.graphService.setNode(n));
          vault.history.addState(result, []);
          await saveVault();
        }
      }
    },
    [currentVaultId, nodes, saveVault, vaultManager, setNodes]
  );

  // Graph content for the workspace
  const graphContent = (
    <div className='relative w-full h-full'>
      <NetworkGraph
        onNodeSelect={setSelectedNode}
        selectedNode={selectedNode}
        graphData={graphData}
        setGraphData={setGraphData}
        linkStyles={graphConfig.topology.styles}
        graphConfig={graphConfig}
      />

      {/* Status indicators */}
      <div className='absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3'>
        {currentVaultId && (
          <AutoSaveIndicator
            status={saveStatus}
            lastSaved={lastSaved}
          />
        )}
        <SyncStatusIndicator />
        <PWAStatusBadge />
      </div>
    </div>
  );

  // Render editor for a specific node (used by tab switching)
  const renderEditorForNode = useCallback((node: Node) => {
    const nodeBacklinks = getBacklinksForNode(node);
    const nodePath = getNodePath(node.id);
    return (
      <div className='w-full h-full'>
        <NodePanel
          node={node}
          nodePath={nodePath}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          backlinks={nodeBacklinks}
          onWikilinkClick={handleWikilinkClick}
          onBacklinkClick={handleBacklinkClick}
          onTagClick={handleTagClick}
        />
      </div>
    );
  }, [getBacklinksForNode, getNodePath, handleNodeUpdate, handleNodeDelete, handleWikilinkClick, handleBacklinkClick, handleTagClick, setSelectedNode]);

  // Editor content (NodePanel) for the workspace - fallback for selectedNode
  const editorContent = selectedNode ? renderEditorForNode(selectedNode) : null;

  return (
    <>
      <div className='fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md'>
        <OfflineIndicator />
      </div>

      <UnifiedLayout
        nodes={graphData.nodes}
        selectedNode={selectedNode}
        onNodeSelect={setSelectedNode}
        onNodeMove={handleNodeMove}
        onAddNode={handleAddNode}
        isVaultMode={!!currentVaultId}
        vaultName={
          currentVaultId
            ? vaultManager.getVault(currentVaultId)?.name || null
            : null
        }
        vaultType={
          currentVaultId
            ? vaultManager.getVault(currentVaultId)?.type
            : undefined
        }
        onCloseVault={handleCloseVault}
        graphConfigTrigger={graphConfigTrigger}
        onImportComplete={handleImportComplete}
        graphContent={graphContent}
        editorContent={editorContent}
        renderEditorForNode={renderEditorForNode}>
        <div />
      </UnifiedLayout>

      <PWAInstallPrompt
        variant='banner'
        showOfflineStatus={true}
      />
    </>
  );
};

export default Index;
