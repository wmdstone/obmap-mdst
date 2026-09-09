import { useState } from 'react';
import { cn } from "@/shared/lib";
import { IconRibbon, RibbonTool } from './IconRibbon';
import { SidebarPanel } from './SidebarPanel';
import { WorkspaceTabs, WorkspaceTab, PaneType } from './WorkspaceTabs';
import { WorkspacePane } from './WorkspacePane';
import { Button } from "@/shared/ui/button";
import { Menu, X } from 'lucide-react';

interface Node {
	id: string;
	name: string;
	content: string;
	type: 'folder' | 'file' | 'media';
	parentId: string | null;
	depth: number;
	tags: string[];
	mediaType?: 'image' | 'audio' | 'video';
}

interface MobileLayoutProps {
	nodes: Node[];
	selectedNode: Node | null;
	onNodeSelect: (node: Node) => void;
	onNodeMove?: (nodeId: string, newParentId: string | null) => void;
	onAddNode?: (type: 'folder' | 'file') => void;
	isVaultMode: boolean;
	vaultName: string | null;
	vaultType?: 'in-memory' | 'local-folder';
	onCloseVault: () => void;
	graphConfigTrigger: React.ReactNode;
	onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
	graphContent?: React.ReactNode;
	editorContent?: React.ReactNode;
	activeNodePath?: string | null;
	children: React.ReactNode;
	activeTool: RibbonTool | null;
	onToolSelect: (tool: RibbonTool) => void;
	tabs: WorkspaceTab[];
	activeTabId: string;
	onTabSelect: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
	onTabReorder: (tabs: WorkspaceTab[]) => void;
	onNewTab: (type: PaneType) => void;
	onQuickAction: (action: string) => void;
}

export function MobileLayout({
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
	tabs,
	activeTabId,
	onTabSelect,
	onTabClose,
	onTabReorder,
	onNewTab,
	onQuickAction,
}: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isEmptyTab = !activeTab || (activeTab.type === "editor" && !activeTab.nodeId);

	const handleToolSelect = (tool: RibbonTool) => {
		onToolSelect(tool);
	};

	const handleNodeSelect = (node: Node) => {
		onNodeSelect(node);
		setSidebarOpen(false);
	};

	return (
		<div className='h-screen w-full flex flex-col overflow-hidden bg-background relative'>
			{/* Mobile Header */}
			<div className='h-12 px-3 flex items-center justify-between border-b border-border shrink-0 bg-sidebar z-30'>
				<Button
					variant='ghost'
					size='icon'
					className='h-9 w-9'
					onClick={() => setSidebarOpen(!sidebarOpen)}>
					{sidebarOpen ? (
						<X className='w-5 h-5' />
					) : (
						<Menu className='w-5 h-5' />
					)}
				</Button>
				<span className='text-sm font-medium truncate'>
					{activeTab?.title || 'Workspace'}
				</span>
				<div className='w-9' /> {/* Spacer for alignment */}
			</div>

			{/* Sidebar - Slides in from left, pushes content */}
			<div className='flex flex-1 overflow-hidden relative'>
				{/* Sidebar Container */}
				<div
					className={cn(
						'absolute inset-y-0 left-0 z-20 flex transition-transform duration-300 ease-in-out',
						sidebarOpen ? 'translate-x-0' : '-translate-x-full'
					)}
					style={{ width: 'min(85vw, 320px)' }}>
					<IconRibbon
						activeTool={activeTool}
						onToolSelect={handleToolSelect}
					/>

					{activeTool &&
						activeTool !== 'vaults' &&
						activeTool !== 'account' && (
							<SidebarPanel
								activeTool={activeTool}
								onClose={() => onToolSelect(activeTool)}
								nodes={nodes}
								selectedNode={selectedNode}
								onNodeSelect={handleNodeSelect}
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

				{/* Backdrop when sidebar is open */}
				{sidebarOpen && (
					<div
						className='absolute inset-0 bg-black/50 z-10'
						onClick={() => setSidebarOpen(false)}
					/>
				)}

				{/* Main Content Area */}
				<div className='flex-1 flex flex-col min-w-0 z-0'>
					{/* Mobile Tab Bar */}
					<WorkspaceTabs
						tabs={tabs}
						activeTabId={activeTabId}
						onTabSelect={onTabSelect}
						onTabClose={onTabClose}
						onTabReorder={onTabReorder}
						onNewTab={onNewTab}
					/>

					{/* Mobile Workspace Content */}
					<WorkspacePane
						type={activeTab?.type || 'editor'}
						isEmpty={isEmptyTab}
						onQuickAction={onQuickAction}>
						{activeTab?.type === 'graph' && graphContent}
						{activeTab?.type === 'editor' && activeTab.nodeId && editorContent}
						{!activeTab && children}
					</WorkspacePane>
				</div>
			</div>
		</div>
	);
}
