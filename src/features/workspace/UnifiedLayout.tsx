import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/shared/hooks/useMobile";
import { DesktopLayout } from "./DesktopLayout";
import { MobileLayout } from "./MobileLayout";
import { RibbonTool } from "./IconRibbon";
import { PaneType } from "./WorkspaceTabs";
import { useUIStore } from "@/shared/stores";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video";
}

interface UnifiedLayoutProps {
  children: React.ReactNode;
  nodes: Node[];
  selectedNode: Node | null;
  onNodeSelect: (node: Node) => void;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  onAddNode?: (type: "folder" | "file") => void;
  isVaultMode: boolean;
  vaultName: string | null;
  vaultType?: "in-memory" | "local-folder";
  onCloseVault: () => void;
  graphConfigTrigger: React.ReactNode;
  onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
  graphContent?: React.ReactNode;
  editorContent?: React.ReactNode;
  renderEditorForNode?: (node: Node) => React.ReactNode;
}

export function UnifiedLayout({
  children,
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeMove,
  onAddNode,
  isVaultMode,
  vaultName,
  vaultType,
  onCloseVault,
  graphConfigTrigger,
  onImportComplete,
  graphContent,
  editorContent,
  renderEditorForNode,
}: UnifiedLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // UI Store
  const activeTool = useUIStore((state) => state.activeTool);
  const setActiveTool = useUIStore((state) => state.setActiveTool);
  const tabs = useUIStore((state) => state.tabs);
  const setTabs = useUIStore((state) => state.setTabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const setActiveTabId = useUIStore((state) => state.setActiveTabId);
  const addTab = useUIStore((state) => state.addTab);
  const removeTab = useUIStore((state) => state.removeTab);
  const updateTab = useUIStore((state) => state.updateTab);

  // Track if we're programmatically changing selection to prevent loops
  const isInternalChange = useRef(false);

  // Build node path helper
  const getNodePath = useCallback((nodeId: string): string => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return "";
    
    const pathParts: string[] = [node.name];
    let current = node;
    
    while (current.parentId) {
      const parent = nodes.find(n => n.id === current.parentId);
      if (parent) {
        pathParts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    
    return pathParts.join(" / ");
  }, [nodes]);

  // Update tab titles when node names change
  useEffect(() => {
    tabs.forEach(tab => {
      if (tab.type === "editor" && tab.nodeId) {
        const node = nodes.find(n => n.id === tab.nodeId);
        if (node && tab.title !== node.name) {
          updateTab(tab.id, { title: node.name });
        }
      }
    });
  }, [nodes, tabs, updateTab]);

  // Open a node in editor when selected (only if not from tab selection)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    
    if (selectedNode && selectedNode.type !== "folder") {
      const existingTab = tabs.find((t) => t.nodeId === selectedNode.id);
      if (existingTab) {
        if (activeTabId !== existingTab.id) {
          setActiveTabId(existingTab.id);
        }
      } else {
        addTab({
          id: `editor-${selectedNode.id}`,
          type: "editor",
          title: selectedNode.name,
          nodeId: selectedNode.id,
        });
      }
    }
  }, [selectedNode?.id]);

  // When user clicks a different tab, update selectedNode to match
  const handleTabSelectInternal = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.type === "editor" && tab.nodeId) {
      const node = nodes.find(n => n.id === tab.nodeId);
      if (node && (!selectedNode || selectedNode.id !== node.id)) {
        isInternalChange.current = true;
        onNodeSelect(node);
      }
    }
  }, [tabs, nodes, selectedNode, onNodeSelect, setActiveTabId]);

  // Get editor content for the current active tab
  const currentEditorContent = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.type !== "editor" || !activeTab.nodeId) {
      return null;
    }
    
    const node = nodes.find(n => n.id === activeTab.nodeId);
    if (!node) return null;

    // If renderEditorForNode is provided, use it for the specific node
    if (renderEditorForNode) {
      return renderEditorForNode(node);
    }

    // Fallback to editorContent if the node matches selectedNode
    if (selectedNode && selectedNode.id === node.id) {
      return editorContent;
    }

    return null;
  }, [activeTabId, tabs, nodes, selectedNode, editorContent, renderEditorForNode]);

  // Get the node path for the active tab
  const activeNodePath = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab?.type === "editor" && activeTab.nodeId) {
      return getNodePath(activeTab.nodeId);
    }
    return null;
  }, [activeTabId, tabs, getNodePath]);

  const handleToolSelect = useCallback((tool: RibbonTool) => {
    if (tool === "vaults") {
      navigate("/vaults");
      return;
    }
    if (tool === "account") {
      navigate("/vaults");
      return;
    }
    setActiveTool(activeTool === tool ? null : tool as typeof activeTool);
  }, [navigate, activeTool, setActiveTool]);

  const handlePanelClose = useCallback(() => {
    setActiveTool(null);
  }, [setActiveTool]);

  // handleTabSelect is now handled by handleTabSelectInternal above

  const handleTabClose = useCallback((tabId: string) => {
    removeTab(tabId);
  }, [removeTab]);

  const handleNewTab = useCallback((type: PaneType) => {
    addTab({
      id: `${type}-${Date.now()}`,
      type,
      title: type === "graph" ? "New Graph" : "New Note",
    });
  }, [addTab]);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case "new-note":
        handleNewTab("editor");
        break;
      case "open-vault":
        navigate("/vaults");
        break;
      case "explore-graph":
        const graphTab = tabs.find((t) => t.type === "graph");
        if (graphTab) {
          setActiveTabId(graphTab.id);
        } else {
          handleNewTab("graph");
        }
        break;
      case "import-files":
        setActiveTool("import-export");
        break;
    }
  }, [navigate, tabs, handleNewTab, setActiveTabId, setActiveTool]);

  const commonProps = {
    nodes,
    selectedNode,
    onNodeSelect,
    onNodeMove,
    onAddNode,
    isVaultMode,
    vaultName,
    vaultType,
    onCloseVault,
    graphConfigTrigger,
    onImportComplete,
    graphContent,
    editorContent: currentEditorContent,
    activeNodePath,
    children,
    activeTool,
    onToolSelect: handleToolSelect,
    tabs,
    activeTabId,
    onTabSelect: handleTabSelectInternal,
    onTabClose: handleTabClose,
    onTabReorder: setTabs,
    onNewTab: handleNewTab,
    onQuickAction: handleQuickAction,
  };

  if (isMobile) {
    return <MobileLayout {...commonProps} />;
  }

  return <DesktopLayout {...commonProps} onPanelClose={handlePanelClose} />;
}
