import { useState, useMemo, useEffect, useCallback } from "react";
import { NetworkGraph } from "@/components/NetworkGraph";
import { NodePanel } from "@/components/NodePanel";
import { Sidebar } from "@/components/Sidebar";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import { VaultSelector } from "@/components/VaultSelector";
import { LinkConfigPanel } from "@/components/LinkConfigPanel";
import { PWAInstallPrompt, PWAStatusBadge } from "@/components/PWAInstallPrompt";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";
import { extractMentions } from "@/lib/markdownParser";
import { getVaultManager } from "@/services/vault/VaultManagerSingleton";
import { useAutoLinks } from "@/hooks/useAutoLinks";
import { useLinkConfig } from "@/hooks/useLinkConfig";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file";
  parentId: string | null;
  depth: number;
  tags: string[];
  wikilinks?: string[];
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: "hierarchy" | "tag" | "backlink" | "semantic";
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface Backlink {
  nodeId: string;
  nodeName: string;
  isWikilink: boolean;
}

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const vaultManager = getVaultManager();
  const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const getDemoData = (): { nodes: Node[] } => ({
    nodes: [
      { id: "1", name: "Projects", content: "Root folder for all projects", type: "folder", parentId: null, depth: 0, tags: ["root"] },
      { id: "2", name: "Getting Started", content: "Welcome to your knowledge graph! This is a node where you can write your notes and thoughts.\n\nYou can use [[Core Concepts]] to link to other notes.\n\nAdd tags like #introduction to organize your notes.", type: "file", parentId: "1", depth: 1, tags: ["introduction", "guide"], wikilinks: ["Core Concepts"] },
      { id: "3", name: "Documentation", content: "", type: "folder", parentId: "1", depth: 1, tags: ["docs"] },
      { id: "4", name: "Core Concepts", content: "Connect related ideas by creating links between nodes.\n\nYou can reference [[Getting Started]] or [[Best Practices]] from any note.\n\n- [ ] Task example\n- [x] Completed task", type: "file", parentId: "3", depth: 2, tags: ["concepts", "guide"], wikilinks: ["Getting Started", "Best Practices"] },
      { id: "5", name: "Best Practices", content: "Keep your notes atomic - one main idea per node works best.\n\nCheck out [[Core Concepts]] for more information.", type: "file", parentId: "3", depth: 2, tags: ["tips", "guide"], wikilinks: ["Core Concepts"] },
    ],
  });

  const [nodes, setNodes] = useState<Node[]>(getDemoData().nodes);
  
  // Link configuration state
  const { config: linkConfig, stats: linkStats, updateConfig, updateStyle, resetConfig } = useLinkConfig(nodes, []);
  
  // Auto-generate links based on hierarchy, tags, and backlinks with config
  const autoLinks = useAutoLinks(nodes, {
    hierarchy: linkConfig.showHierarchy,
    tags: linkConfig.showTags,
    backlinks: linkConfig.showBacklinks,
    tagThreshold: linkConfig.tagThreshold,
  });
  
  // Memoized graphData with auto-generated links (including type for coloring)
  const graphData = useMemo<GraphData>(() => ({
    nodes,
    links: autoLinks.map(link => ({
      source: link.source,
      target: link.target,
      type: link.type,
    })),
  }), [nodes, autoLinks]);
  
  // Update link stats with actual links
  const actualLinkStats = useMemo(() => {
    let hierarchyCount = 0;
    let backlinkCount = 0;
    let tagCount = 0;

    graphData.links.forEach(link => {
      switch (link.type) {
        case "hierarchy":
          hierarchyCount++;
          break;
        case "backlink":
          backlinkCount++;
          break;
        case "tag":
          tagCount++;
          break;
      }
    });

    // Calculate node degrees
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();
    
    nodes.forEach(node => {
      nodeConnections.set(node.id, { inDegree: 0, outDegree: 0 });
    });

    graphData.links.forEach(link => {
      const sourceId = typeof link.source === "string" ? link.source : (link.source as Node).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as Node).id;
      
      const sourceConn = nodeConnections.get(sourceId);
      const targetConn = nodeConnections.get(targetId);
      
      if (sourceConn) {
        sourceConn.outDegree++;
      }
      if (targetConn) {
        targetConn.inDegree++;
      }
    });

    // Get top hubs
    const topHubs = Array.from(nodeConnections.entries())
      .map(([nodeId, { inDegree, outDegree }]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          nodeId,
          nodeName: node?.name || "Unknown",
          connectionCount: inDegree + outDegree,
          inDegree,
          outDegree,
        };
      })
      .filter(hub => hub.connectionCount > 0)
      .sort((a, b) => b.connectionCount - a.connectionCount)
      .slice(0, 5);

    return {
      hierarchyCount,
      backlinkCount,
      tagCount,
      totalCount: graphData.links.length,
      topHubs,
    };
  }, [nodes, graphData.links]);
  
  // Wrapper to update graphData via nodes
  const setGraphData = useCallback((data: GraphData) => {
    setNodes(data.nodes);
  }, []);

  useEffect(() => {
    const initVaultManager = async () => {
      await vaultManager.initialize();
      loadActiveVault();
    };
    initVaultManager();
  }, []);

  const loadActiveVault = () => {
    const activeVault = vaultManager.getActiveVault();
    if (activeVault) {
      setCurrentVaultId(activeVault.id);
      const vaultGraphData = activeVault.graphService.getGraphData();
      setNodes(vaultGraphData.nodes);
      updateUndoRedoState(activeVault.id);
    } else {
      setCurrentVaultId(null);
      setNodes(getDemoData().nodes);
      setCanUndo(false);
      setCanRedo(false);
    }
  };

  const updateUndoRedoState = (vaultId: string) => {
    setCanUndo(vaultManager.canUndo(vaultId));
    setCanRedo(vaultManager.canRedo(vaultId));
  };

  // Listen for vault changes when navigating back from dashboard
  useEffect(() => {
    const handleFocus = () => {
      loadActiveVault();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Calculate backlinks for the selected node
  const backlinks = useMemo((): Backlink[] => {
    if (!selectedNode || selectedNode.type === "folder") return [];

    const links: Backlink[] = [];
    
    graphData.nodes.forEach(node => {
      if (node.id === selectedNode.id || node.type === "folder") return;
      
      // Check for explicit wikilinks
      if (node.wikilinks && node.wikilinks.includes(selectedNode.name)) {
        links.push({
          nodeId: node.id,
          nodeName: node.name,
          isWikilink: true,
        });
      }
      // Check for unlinked mentions
      else if (extractMentions(node.content, selectedNode.name)) {
        links.push({
          nodeId: node.id,
          nodeName: node.name,
          isWikilink: false,
        });
      }
    });

    return links;
  }, [selectedNode, graphData.nodes]);

  const handleCloseVault = async () => {
    if (!currentVaultId) return;
    
    await vaultManager.deleteVault(currentVaultId);
    setCurrentVaultId(null);
    setNodes(getDemoData().nodes);
    setSelectedNode(null);
    toast.info('Vault closed');
  };

  const handleNodeUpdate = async (updatedNode: Node) => {
    const updatedNodes = nodes.map((node) =>
      node.id === updatedNode.id ? updatedNode : node
    );
    setNodes(updatedNodes);
    setSelectedNode(updatedNode);
    
    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        vault.graphService.setNode(updatedNode);
        // Links are auto-generated, pass empty links - they'll be rebuilt from nodes
        vault.history.addState(updatedNodes, []);
        await vaultManager.saveCurrentVault();
        await vaultManager.recordVaultChange(currentVaultId);
        updateUndoRedoState(currentVaultId);
      }
    }
  };

  const handleUndo = async () => {
    if (!currentVaultId) return;
    
    const success = await vaultManager.undo(currentVaultId);
    if (success) {
      loadActiveVault();
      toast.success('Undo successful');
    }
  };

  const handleRedo = async () => {
    if (!currentVaultId) return;
    
    const success = await vaultManager.redo(currentVaultId);
    if (success) {
      loadActiveVault();
      toast.success('Redo successful');
    }
  };

  const handleNodeDelete = async (nodeId: string) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    
    // If deleting a folder, also delete all its children recursively
    const nodesToDelete = new Set<string>([nodeId]);
    
    if (nodeToDelete?.type === "folder") {
      const collectChildren = (parentId: string) => {
        nodes.forEach(node => {
          if (node.parentId === parentId) {
            nodesToDelete.add(node.id);
            if (node.type === "folder") {
              collectChildren(node.id);
            }
          }
        });
      };
      collectChildren(nodeId);
    }
    
    const updatedNodes = nodes.filter((node) => !nodesToDelete.has(node.id));
    
    setNodes(updatedNodes);
    setSelectedNode(null);
    
    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        nodesToDelete.forEach(id => {
          vault.graphService.deleteNode(id);
        });
        
        vault.history.addState(updatedNodes, []);
        await vaultManager.saveCurrentVault();
        await vaultManager.recordVaultChange(currentVaultId);
        updateUndoRedoState(currentVaultId);
      }
    }
  };

  const handleNodeMove = async (nodeId: string, newParentId: string | null) => {
    const node = nodes.find(n => n.id === nodeId);
    const newParent = newParentId ? nodes.find(n => n.id === newParentId) : null;
    
    if (!node) return;
    
    // Only folders can have children
    if (newParent && newParent.type !== "folder") {
      toast.error("Only folders can contain children");
      return;
    }
    
    // Calculate new depth
    const newDepth = newParent ? newParent.depth + 1 : 0;
    const depthDiff = newDepth - node.depth;
    
    // Update node and all its descendants
    const updateNodeDepth = (nodeId: string) => {
      const nodesToUpdate = new Set<string>([nodeId]);
      
      // Collect all descendants
      const collectDescendants = (parentId: string) => {
        nodes.forEach(n => {
          if (n.parentId === parentId) {
            nodesToUpdate.add(n.id);
            if (n.type === "folder") {
              collectDescendants(n.id);
            }
          }
        });
      };
      
      if (node.type === "folder") {
        collectDescendants(nodeId);
      }
      
      return nodesToUpdate;
    };
    
    const affectedNodes = updateNodeDepth(nodeId);
    
    // Update all affected nodes
    const updatedNodes = nodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, parentId: newParentId, depth: newDepth };
      }
      if (affectedNodes.has(n.id) && n.id !== nodeId) {
        return { ...n, depth: n.depth + depthDiff };
      }
      return n;
    });
    
    setNodes(updatedNodes);
    
    // Update vault if active
    if (currentVaultId) {
      const vault = vaultManager.getVault(currentVaultId);
      if (vault) {
        updatedNodes.forEach(updatedNode => {
          vault.graphService.setNode(updatedNode);
        });
        
        vault.history.addState(updatedNodes, []);
        await vaultManager.saveCurrentVault();
        await vaultManager.recordVaultChange(currentVaultId);
        updateUndoRedoState(currentVaultId);
      }
    }
    
    toast.success(`Moved "${node.name}" to ${newParent ? newParent.name : "root"}`);
  };

  const handleWikilinkClick = (target: string) => {
    // Find the node by name
    const targetNode = graphData.nodes.find(
      node => node.name.toLowerCase() === target.toLowerCase() && node.type === "file"
    );
    
    if (targetNode) {
      setSelectedNode(targetNode);
      toast.success(`Navigated to ${targetNode.name}`);
    } else {
      toast.error(`Note "${target}" not found`);
    }
  };

  const handleBacklinkClick = (nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
    }
  };

  const handleTagClick = (tag: string) => {
    // Find nodes with this tag
    const nodesWithTag = graphData.nodes.filter(node => 
      node.tags.includes(tag)
    );
    
    if (nodesWithTag.length > 0) {
      toast.info(`Found ${nodesWithTag.length} note(s) with tag #${tag}`);
      // You could implement a tag filter view here
    } else {
      toast.error(`No notes found with tag #${tag}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Floating Sidebar - Desktop */}
      <div className="hidden lg:flex lg:w-80 border-r border-border flex-col">
        <VaultSelector
          isVaultMode={!!currentVaultId}
          vaultName={currentVaultId ? vaultManager.getVault(currentVaultId)?.name || null : null}
          onCloseVault={handleCloseVault}
        />
        <Sidebar
          nodes={graphData.nodes}
          onNodeSelect={setSelectedNode}
          selectedNode={selectedNode}
          onNodeMove={handleNodeMove}
        />
      </div>

      {/* Mobile/Tablet Floating Sidebar */}
      <div className="lg:hidden fixed top-4 left-4 z-30">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-[280px] max-h-[80vh] flex flex-col">
          <VaultSelector
            isVaultMode={!!currentVaultId}
            vaultName={currentVaultId ? vaultManager.getVault(currentVaultId)?.name || null : null}
            onCloseVault={handleCloseVault}
          />
          <Sidebar
            nodes={graphData.nodes}
            onNodeSelect={setSelectedNode}
            selectedNode={selectedNode}
            onNodeMove={handleNodeMove}
          />
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute top-20 right-4 z-30 flex flex-col gap-2">
          {currentVaultId && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <LinkConfigPanel
            config={linkConfig}
            stats={actualLinkStats}
            onConfigUpdate={updateConfig}
            onStyleUpdate={updateStyle}
            onReset={resetConfig}
            onNodeSelect={(nodeId) => {
              const node = nodes.find(n => n.id === nodeId);
              if (node) setSelectedNode(node);
            }}
          />
        </div>
        <NetworkGraph
          onNodeSelect={setSelectedNode}
          selectedNode={selectedNode}
          graphData={graphData}
          setGraphData={setGraphData}
          linkStyles={linkConfig.styles}
        />
        <NodePanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          backlinks={backlinks}
          onWikilinkClick={handleWikilinkClick}
          onBacklinkClick={handleBacklinkClick}
          onTagClick={handleTagClick}
        />
        <ThemeCustomizer />
        
        {/* PWA Status Badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <PWAStatusBadge />
        </div>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt variant="banner" showOfflineStatus={true} />
    </div>
  );
};

export default Index;
