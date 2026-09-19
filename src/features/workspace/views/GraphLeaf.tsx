import { GraphCanvas } from '@/features/graph/GraphCanvas';
import { GraphWorkspaceControls } from '@/features/graph/GraphWorkspaceControls';
import { useGraphInteractionStore } from '@/features/graph/model/useGraphInteractionStore';
import { AutoSaveIndicator } from '@/features/sync/AutoSaveIndicator';
import { SyncStatusIndicator } from '@/features/sync/SyncStatusIndicator';
import { PWAStatusBadge } from '@/features/sync/PWAInstallPrompt';
import { useGraphStore } from '@/shared/stores';
import { useVaultSession } from '../VaultSessionContext';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useState } from 'react';

export default function GraphLeaf() {
  const {
    graphData,
    selectedNode,
    setSelectedNode,
    currentVaultId,
    saveStatus,
    lastSaved,
  } = useVaultSession();
  const graphConfig = useGraphStore((s) => s.config);
  const {
    layoutMode,
    setLayoutMode,
    orientation,
    setOrientation,
    highlightMode,
    setHighlightMode,
    collapsedIds,
    expandAll,
    focusedRootId,
    setFocusedRoot,
  } = useGraphInteractionStore();
  const [search, setSearch] = useState('');
  const [maxDepth, setMaxDepth] = useState(10);
  const [contentFilter, setContentFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const handleSelect = (node: typeof selectedNode) => {
    setSelectedNode(node);
    if (node && node.type !== 'folder') {
      useWorkspaceStore.getState().openFile(node.id, node.name);
    }
  };

  return (
    <div className="relative w-full h-full">
      <GraphCanvas
        graphData={graphData}
        selectedNode={selectedNode}
        onNodeSelect={handleSelect}
        graphConfig={graphConfig}
        search={search}
        maxDepth={maxDepth}
        contentFilter={contentFilter}
        tagFilter={tagFilter}
      />

      <GraphWorkspaceControls
        layout={layoutMode}
        onLayoutChange={setLayoutMode}
        orientation={orientation}
        onOrientationChange={setOrientation}
        highlightPathway={highlightMode === 'pathway'}
        onHighlightPathwayChange={(value) => setHighlightMode(value ? 'pathway' : 'off')}
        collapsedCount={collapsedIds.length}
        onExpandAll={expandAll}
        focused={Boolean(focusedRootId)}
        onClearFocus={() => setFocusedRoot(null)}
        search={search}
        onSearchChange={setSearch}
        maxDepth={maxDepth}
        onMaxDepthChange={setMaxDepth}
        contentFilter={contentFilter}
        onContentFilterChange={setContentFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
      />

      <div className="pointer-events-none absolute right-2 top-2 z-40 sm:right-4 sm:top-4">
        <div className="pointer-events-auto flex items-center justify-end gap-1.5 rounded-md border border-border/60 bg-background/80 px-2 py-1 backdrop-blur-md sm:gap-3">
          {currentVaultId && <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />}
          <SyncStatusIndicator />
          <PWAStatusBadge />
        </div>
      </div>
    </div>
  );
}
