import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { IconRibbon, RibbonTool } from "./IconRibbon";
import { SidebarPanel } from "./SidebarPanel";
import { WorkspaceTabs, WorkspaceTab, PaneType } from "./WorkspaceTabs";
import { WorkspacePane } from "./WorkspacePane";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

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
}: UnifiedLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTool, setActiveTool] = useState<RibbonTool | null>("files");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: "graph-main", type: "graph", title: "Network Graph" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("graph-main");

  // Open a node in editor when selected
  useEffect(() => {
    if (selectedNode && selectedNode.type !== "folder") {
      const existingTab = tabs.find((t) => t.nodeId === selectedNode.id);
      if (existingTab) {
        setActiveTabId(existingTab.id);
      } else {
        const newTab: WorkspaceTab = {
          id: `editor-${selectedNode.id}`,
          type: "editor",
          title: selectedNode.name,
          nodeId: selectedNode.id,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
  }, [selectedNode]);

  const handleToolSelect = useCallback((tool: RibbonTool) => {
    if (tool === "vaults") {
      navigate("/vaults");
      return;
    }
    if (tool === "account") {
      navigate("/vaults");
      return;
    }
    setActiveTool((prev) => (prev === tool ? null : tool));
  }, [navigate]);

  const handlePanelClose = useCallback(() => {
    setActiveTool(null);
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const handleNewTab = useCallback((type: PaneType) => {
    const newTab: WorkspaceTab = {
      id: `${type}-${Date.now()}`,
      type,
      title: type === "graph" ? "New Graph" : "New Note",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

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
  }, [navigate, tabs, handleNewTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Desktop Layout
  if (!isMobile) {
    return (
      <div className="h-screen w-full flex overflow-hidden bg-background">
        {/* Icon Ribbon - Always visible */}
        <IconRibbon
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
        />

        {/* Expandable Panel */}
        {activeTool && (
          <SidebarPanel
            activeTool={activeTool}
            onClose={handlePanelClose}
            nodes={nodes}
            selectedNode={selectedNode}
            onNodeSelect={onNodeSelect}
            onNodeMove={onNodeMove}
            onAddNode={onAddNode}
            isVaultMode={isVaultMode}
            vaultName={vaultName}
            vaultType={vaultType}
            onCloseVault={onCloseVault}
            graphConfigTrigger={graphConfigTrigger}
            onImportComplete={onImportComplete}
          />
        )}

        {/* Central Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab Bar */}
          <WorkspaceTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
            onTabClose={handleTabClose}
            onTabReorder={setTabs}
            onNewTab={handleNewTab}
          />

          {/* Workspace Content */}
          <WorkspacePane
            type={activeTab?.type || "graph"}
            isEmpty={tabs.length === 0}
            onQuickAction={handleQuickAction}
          >
            {activeTab?.type === "graph" && graphContent}
            {activeTab?.type === "editor" && editorContent}
            {!activeTab && children}
          </WorkspacePane>
        </div>
      </div>
    );
  }

  // Mobile Layout - Single Sheet for sidebar (no duplicate sidebars)
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Mobile Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-border shrink-0 bg-sidebar">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[85vw] max-w-[320px]">
            <div className="flex h-full">
              <IconRibbon
                activeTool={activeTool}
                onToolSelect={(tool) => {
                  if (tool === "vaults" || tool === "account") {
                    navigate(tool === "vaults" ? "/vaults" : "/vaults");
                    setMobileMenuOpen(false);
                    return;
                  }
                  setActiveTool((prev) => (prev === tool ? null : tool));
                }}
              />
              <div className="flex-1 min-w-0">
                {activeTool && activeTool !== "vaults" && activeTool !== "account" && (
                  <SidebarPanel
                    activeTool={activeTool}
                    onClose={() => setActiveTool(null)}
                    nodes={nodes}
                    selectedNode={selectedNode}
                    onNodeSelect={(node) => {
                      onNodeSelect(node);
                      setMobileMenuOpen(false);
                    }}
                    onNodeMove={onNodeMove}
                    onAddNode={onAddNode}
                    isVaultMode={isVaultMode}
                    vaultName={vaultName}
                    vaultType={vaultType}
                    onCloseVault={onCloseVault}
                    graphConfigTrigger={graphConfigTrigger}
                    onImportComplete={onImportComplete}
                  />
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <span className="text-sm font-medium truncate">{activeTab?.title || "Workspace"}</span>

        <div className="w-9" /> {/* Spacer for alignment */}
      </div>

      {/* Mobile Tab Bar */}
      <WorkspaceTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onTabReorder={setTabs}
        onNewTab={handleNewTab}
      />

      {/* Mobile Workspace Content */}
      <WorkspacePane
        type={activeTab?.type || "graph"}
        isEmpty={tabs.length === 0}
        onQuickAction={handleQuickAction}
      >
        {activeTab?.type === "graph" && graphContent}
        {activeTab?.type === "editor" && editorContent}
        {!activeTab && children}
      </WorkspacePane>
    </div>
  );
}
