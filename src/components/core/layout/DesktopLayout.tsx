import { IconRibbon, RibbonTool } from "./IconRibbon";
import { SidebarPanel } from "./SidebarPanel";
import { WorkspaceTabs, WorkspaceTab, PaneType } from "./WorkspaceTabs";
import { WorkspacePane } from "./WorkspacePane";

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

interface DesktopLayoutProps {
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
  activeNodePath?: string | null;
  children: React.ReactNode;
  activeTool: RibbonTool | null;
  onToolSelect: (tool: RibbonTool) => void;
  onPanelClose: () => void;
  tabs: WorkspaceTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (tabs: WorkspaceTab[]) => void;
  onNewTab: (type: PaneType) => void;
  onQuickAction: (action: string) => void;
}

export function DesktopLayout({
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
  children,
  activeTool,
  onToolSelect,
  onPanelClose,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onNewTab,
  onQuickAction,
}: DesktopLayoutProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isEmptyTab = !activeTab || (activeTab.type === "editor" && !activeTab.nodeId);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      {/* Icon Ribbon - Always visible */}
      <IconRibbon
        activeTool={activeTool}
        onToolSelect={onToolSelect}
      />

      {/* Expandable Panel */}
      {activeTool && (
        <SidebarPanel
          activeTool={activeTool}
          onClose={onPanelClose}
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
          onTabSelect={onTabSelect}
          onTabClose={onTabClose}
          onTabReorder={onTabReorder}
          onNewTab={onNewTab}
        />

        {/* Workspace Content */}
        <WorkspacePane
          type={activeTab?.type || "editor"}
          isEmpty={isEmptyTab}
          onQuickAction={onQuickAction}
        >
          {activeTab?.type === "graph" && graphContent}
          {activeTab?.type === "editor" && activeTab.nodeId && editorContent}
          {!activeTab && children}
        </WorkspacePane>
      </div>
    </div>
  );
}
