/**
 * GraphCanvas — the single graph renderer.
 *
 * Rendering, camera, hit testing and dragging are delegated to
 * react-force-graph-2d; all coordinates come from the deterministic layout
 * engine (`useLayoutEngine`) via the transition controller.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { GraphConfigState } from '@/domains/graph/stores/useGraphStore';
import { defaultLinkConfig, defaultTopologyConfig } from '@/domains/graph/stores/useGraphStore';
import type { Link, Node } from '@/shared/stores/types';
import { useGraphEngineStore } from '@/domains/graph/stores/useGraphEngineStore';
import { GraphCanvasUtilityDock } from './GraphCanvasUtilityDock';
import { buildGraphProjection } from '../model/buildGraphProjection';
import type { NodeMetric, RenderNode, RenderLink } from '../model/graphTypes';
import { useGraphInteractionStore } from '../model/useGraphInteractionStore';
import { useLayoutEngine } from '../layout/useLayoutEngine';
import { ContextualToolbar } from '../interactions/ContextualToolbar';
import {
  LayoutTransitionController,
  prefersReducedMotion,
} from '../layout/transitionController';
import { hiddenByCollapse, pathwayOf, subtreeOf } from '../interactions/graphTraversal';
import { drawNode, paintNodePointerArea } from '../render/drawNode';
import { drawLink } from '../render/drawLink';
import { buildTheme } from '../render/theme';
import { resolveHierarchyLinkPaint, uniqueDepths } from '../model/hierarchyColors';
import { cardLayout } from '../render/textLayout';
import { useCanvasGestureBridge } from '../hooks/useCanvasGestureBridge';
import { useCanvasDragReparent } from '../hooks/useCanvasDragReparent';
import { useCanvasAtmosphere } from '../hooks/useCanvasAtmosphere';
import { useExplorerGraphSyncStore } from '@/domains/graph/stores/useExplorerGraphSyncStore';
import type { CanvasMode, MindmapLayoutMode } from '../model/graphTypes';
import { usesPhysicsSimulation, isDeterministicLayout } from '../layout/layoutCategory';



// ============================================================================
// 1. Types & Interfaces
// ============================================================================

export interface GraphCanvasProps {
  graphData: { nodes: Node[]; links: Link[] };
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  onNodeOpen?: (node: Node) => void;
  graphConfig: GraphConfigState;
  onNodeMove?: (nodeId: string, newParentId: string | null) => Promise<void> | void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onAddSubNode?: (parentId: string, type: 'file' | 'folder') => Promise<void> | void;
  search: string;
  minDepth: number;
  maxDepth: number;
  contentFilter: string;
  tagFilter: string;
}

export interface GraphCanvasHandle {
  smartZoom: (action: 'fit' | 'selection' | 'reset') => void;
  refresh?: () => void;
}

type GraphHandle = ForceGraphMethods<RenderNode, RenderLink> & {
  refresh: () => unknown;
};

// ============================================================================
// 2. Pure Helper Functions (Stateless)
// ============================================================================

const dashFor = (style: string | undefined, width: number): number[] => {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [1, width * 2];
  return [];
};

const parseDash = (value: string, width: number): number[] => {
  const parsed = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);
  return parsed.length ? parsed : dashFor(undefined, width);
};

const topologyEnabled = (type: RenderLink['type'], config: GraphConfigState): boolean => {
  if (type === 'hierarchy') return config.topology.showHierarchy;
  if (type === 'backlink') return config.topology.showBacklinks;
  if (type === 'tag') return config.topology.showTags;
  return true;
};

/**
 * Melacak ancestor yang sedang ter-collapse ke arah root untuk target tertentu.
 */
function resolveAncestorsToUncollapse(
  targetId: string,
  parentByChild: Map<string, string>,
  collapsedIds: string[],
): string[] {
  const ancestorsToUncollapse: string[] = [];
  const visited = new Set<string>();
  let currId = parentByChild.get(targetId) ?? null;

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    if (collapsedIds.includes(currId)) {
      ancestorsToUncollapse.push(currId);
    }
    currId = parentByChild.get(currId) ?? null;
  }

  return ancestorsToUncollapse;
}

/**
 * Menghitung batas zoom-out maksimum berbasis visual bounding box konten graf.
 */
// ============================================================================
// Dynamic Camera & Layout Bounds Engine
// ============================================================================

export interface GraphCameraBounds {
  minZoom: number;
  panBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface DynamicCameraBoundsOptions {
  nodes: Array<{ x?: number; y?: number }>;
  viewportWidth: number;
  viewportHeight: number;
  layoutMode: string;
  orientation?: string;
  geometryBounds?: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

/**
 * Menghitung batas zoom-out maksimum (1.7x dari ukuran layout) serta batas panning
 * yang adaptif secara dinamis terhadap geometri dan rasio aspek masing-masing layout:
 * - Brace-map: traversal vertikal ribuan node dengan margin aman tanpa black void, plus toleransi horisontal bebas.
 * - Org-chart: traversal horisontal cabang pohon melebar dengan margin vertikal proporsional.
 * - Radial / Mindmap: ruang gerak sirkular/isotropik 2D seimbang.
 * - Timeline / Fishbone: batas linier sepanjang poros spine/waktu.
 */
function calculateCameraBounds({
  nodes,
  viewportWidth,
  viewportHeight,
  layoutMode,
  orientation,
  geometryBounds,
}: DynamicCameraBoundsOptions): GraphCameraBounds {
  const fallback: GraphCameraBounds = {
    minZoom: 0.1,
    panBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
  };

  if (viewportWidth === 0 || viewportHeight === 0) {
    return fallback;
  }

  // 1. Ekstraksi batas koordinat nyata (prioritaskan geometry.bounds deterministic dari layout engine)
  let rawMinX = geometryBounds?.minX ?? Infinity;
  let rawMaxX = geometryBounds?.maxX ?? -Infinity;
  let rawMinY = geometryBounds?.minY ?? Infinity;
  let rawMaxY = geometryBounds?.maxY ?? -Infinity;

  // Gabungkan dengan posisi aktual node (menangani drag, transisi, atau layout free-force)
  if (nodes && nodes.length > 0) {
    for (const node of nodes) {
      const nx = node.x ?? 0;
      const ny = node.y ?? 0;
      if (nx < rawMinX) rawMinX = nx;
      if (nx > rawMaxX) rawMaxX = nx;
      if (ny < rawMinY) rawMinY = ny;
      if (ny > rawMaxY) rawMaxY = ny;
    }
  }

  if (!Number.isFinite(rawMinX) || !Number.isFinite(rawMaxX) || rawMinX === Infinity) {
    return fallback;
  }

  // Dimensi kotak konten dengan bantalan minimum kartu
  const contentWidth = Math.max(80, rawMaxX - rawMinX + 160);
  const contentHeight = Math.max(80, rawMaxY - rawMinY + 160);

  // 2. Skala Fit Tepat Layar
  const fitScale = Math.min(
    viewportWidth / contentWidth,
    viewportHeight / contentHeight
  );

  // Batas zoom out: 1.7x dari ukuran graf (graf mengisi ~58.8% viewport).
  // Untuk ribuan hingga belasan ribu node, fitScale bisa sangat kecil (misal 0.005).
  // Skala minimum diturunkan hingga 0.0005 agar graf raksasa tidak pernah terpotong.
  const calculatedMinZoom = fitScale / 1.7;
  const minZoom = Math.max(0.0005, Math.min(calculatedMinZoom, 1.2));

  // 3. Margin Panning Adaptif Berdasarkan Karakteristik Sumbu Geometri Layout
  let marginX = 0;
  let marginY = 0;

  switch (layoutMode) {
    case 'brace-map': {
      // Sumbu Y (sangat tinggi, ribuan node):
      // Batasi ruang kosong di luar ujung paling atas/bawah agar graf TIDAK hilang ke ruang hampa.
      // Margin diikat ke pecahan tinggi viewport (maks ~45% layar) bukan kelipatan tinggi graf.
      marginY = Math.min(viewportHeight * 0.45, Math.max(120, contentHeight * 0.04));

      // Sumbu X (kedalaman level):
      // Berikan kebebasan panning penuh agar kartu terdalam bisa digeser ke sisi kiri layar.
      marginX = Math.max(viewportWidth * 0.5, contentWidth * 0.35);
      break;
    }

    case 'org-chart': {
      // Kebalikan dari brace-map: Sumbu X sangat lebar, sumbu Y vertikal pendek.
      marginX = Math.min(viewportWidth * 0.45, Math.max(120, contentWidth * 0.04));
      marginY = Math.max(viewportHeight * 0.5, contentHeight * 0.35);
      break;
    }

    case 'timeline':
    case 'fishbone': {
      // Poros horizontal memanjang
      marginX = Math.min(viewportWidth * 0.45, Math.max(160, contentWidth * 0.06));
      marginY = Math.max(viewportHeight * 0.5, contentHeight * 0.35);
      break;
    }

    case 'mindmap': {
      if (orientation === 'radial') {
        // Isotropik 2D seimbang
        marginX = Math.max(viewportWidth * 0.4, contentWidth * 0.2);
        marginY = Math.max(viewportHeight * 0.4, contentHeight * 0.2);
      } else {
        // Balanced mindmap (kiri & kanan terbagi, tumpukan vertikal)
        marginX = Math.max(viewportWidth * 0.45, contentWidth * 0.25);
        marginY = Math.min(viewportHeight * 0.45, Math.max(140, contentHeight * 0.08));
      }
      break;
    }

    case 'fr-radial': {
      marginX = Math.max(viewportWidth * 0.4, contentWidth * 0.2);
      marginY = Math.max(viewportHeight * 0.4, contentHeight * 0.2);
      break;
    }

    default: {
      // Network layouts (free-force, fr-standard, kamada-kawai, grid)
      marginX = Math.max(viewportWidth * 0.4, contentWidth * 0.2);
      marginY = Math.max(viewportHeight * 0.4, contentHeight * 0.2);
      break;
    }
  }

  // 4. Kalkulasi Pan Bounds absolut berbasis envelope node terluar
  const panBounds = {
    minX: rawMinX - marginX,
    maxX: rawMaxX + marginX,
    minY: rawMinY - marginY,
    maxY: rawMaxY + marginY,
  };

  return { minZoom, panBounds };
}

/**
 * Menginisialisasi koordinat awal (seeding) untuk node baru / cabang yang baru di-expand.
 */
function seedInitialNodePositions(
  nodes: RenderNode[],
  parentByChild: Map<string, string>,
  nodeCache: Map<string, RenderNode>,
  targets: Map<string, { x: number; y: number }>,
  layoutMode: string,
): void {
  for (const node of nodes) {
    const target = targets.get(node.id);
    if (!target) continue;

    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      const parentId = parentByChild.get(node.id);
      const parentNode = parentId ? nodeCache.get(parentId) : null;

      const seedX = Number.isFinite(parentNode?.x)
        ? parentNode!.x!
        : Number.isFinite(parentNode?.fx)
          ? parentNode!.fx!
          : 0;

      const seedY = Number.isFinite(parentNode?.y)
        ? parentNode!.y!
        : Number.isFinite(parentNode?.fy)
          ? parentNode!.fy!
          : 0;

      node.x = seedX;
      node.y = seedY;
      if (isDeterministicLayout(layoutMode)) {
        node.fx = seedX;
        node.fy = seedY;
      }
    }
  }
}

// ============================================================================
// 3. Internal Sub-Component: Contextual Toolbar Overlay
// ============================================================================

interface GraphContextualToolbarOverlayProps {
  isVisible: boolean;
  selectedNode: Node | null;
  toolbarCoords: { x: number; y: number } | null;
  canvasMode: CanvasMode;
  currentOverride: any;
  isFocused: boolean;
  onSetStructure: (mode: any) => void;
  onAddSubNode?: (parentId: string, type: 'file' | 'folder') => Promise<void> | void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onToggleFocus: () => void;
  onZoomToSelection: () => void; 
  onClose: () => void;
}

function GraphContextualToolbarOverlay({
  isVisible,
  selectedNode,
  toolbarCoords,
  canvasMode,
  currentOverride,
  isFocused,
  onSetStructure,
  onAddSubNode,
  onNodeDelete,
  onToggleFocus,
   onZoomToSelection,
  onClose,
}: GraphContextualToolbarOverlayProps) {
  if (!isVisible || !selectedNode || !toolbarCoords) {
    return null;
  }

  return (
    <ContextualToolbar
      x={toolbarCoords.x}
      y={toolbarCoords.y}
      nodeId={selectedNode.id}
      nodeName={selectedNode.name}
      isFolder={selectedNode.type === 'folder'}
      canvasMode={canvasMode}
      currentOverride={currentOverride}
      isFocused={isFocused}
      onSetStructure={onSetStructure}
      onAddSub={(type) => onAddSubNode?.(selectedNode.id, type)}
      onToggleFocus={onToggleFocus}
      onZoomToSelection={onZoomToSelection}
      onDelete={() => {
        onNodeDelete?.(selectedNode.id);
        onClose();
      }}
      onClose={onClose}
    />
  );
}

// ============================================================================
// 4. Internal Lifecycle Hooks
// ============================================================================

interface GraphPhysicsSimulationOptions {
  graphRef: React.RefObject<GraphHandle | undefined>;
  layoutMode: string;
  forces: GraphConfigState['forces'];
  simulationCommand: any;
  nodes: RenderNode[];
  transitionRef: React.RefObject<LayoutTransitionController>;
}

function useGraphPhysicsSimulation({
  graphRef,
  layoutMode,
  forces,
  simulationCommand,
  nodes,
  transitionRef,
}: GraphPhysicsSimulationOptions) {
  const isPhysical = usesPhysicsSimulation(layoutMode);

  // 1. Sinkronkan parameter gaya D3 (hanya mode free-force)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !isPhysical) return;
    graph.d3Force?.('charge')?.strength?.(forces.chargeStrength);
    graph.d3Force?.('link')?.distance?.(forces.linkDistance);
    graph.d3Force?.('center')?.strength?.(forces.centerStrength);
    graph.d3ReheatSimulation?.();
  }, [isPhysical, forces.chargeStrength, forces.linkDistance, forces.centerStrength, forces.velocityDecay, graphRef]);

  // 2. Eksekusi simulation command (reheat atau freeze)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !simulationCommand || !isPhysical) return;
    if (simulationCommand.type === 'reheat') {
      transitionRef.current.release(nodes);
      graph.d3ReheatSimulation?.();
    } else {
      for (const node of nodes) {
        node.fx = node.x;
        node.fy = node.y;
        node.vx = 0;
        node.vy = 0;
      }
      graph.refresh?.();
    }
  }, [simulationCommand, isPhysical, nodes, graphRef, transitionRef]);
}

interface ExplorerFocusSyncOptions {
  explorerFocusRequest: { nonce: number; nodeId: string } | null;
  handledNonceRef: React.MutableRefObject<number | null>;
  parentByChild: Map<string, string>;
  collapsedIds: string[];
  setCollapsed: (ids: string[]) => void;
  nodes: RenderNode[];
  graphRef: React.RefObject<GraphHandle | undefined>;
}

function useExplorerFocusSync({
  explorerFocusRequest,
  handledNonceRef,
  parentByChild,
  collapsedIds,
  setCollapsed,
  nodes,
  graphRef,
}: ExplorerFocusSyncOptions) {
  useEffect(() => {
    if (!explorerFocusRequest) return;
    if (handledNonceRef.current === explorerFocusRequest.nonce) return;

    const targetId = explorerFocusRequest.nodeId;
    const ancestorsToUncollapse = resolveAncestorsToUncollapse(
      targetId,
      parentByChild,
      collapsedIds,
    );

    if (ancestorsToUncollapse.length > 0) {
      setCollapsed(collapsedIds.filter((id) => !ancestorsToUncollapse.includes(id)));
      return;
    }

    const target = nodes.find((node) => node.id === targetId);
    if (
      !target ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !graphRef.current
    ) {
      return;
    }

    handledNonceRef.current = explorerFocusRequest.nonce;
    graphRef.current.centerAt?.(target.x as number, target.y as number, 450);
    graphRef.current.zoom?.(2.1, 450);
  }, [
    explorerFocusRequest,
    handledNonceRef,
    parentByChild,
    collapsedIds,
    setCollapsed,
    nodes,
    graphRef,
  ]);
}

function useGraphKeyboardShortcuts(selectedNode: Node | null) {
  useEffect(() => {
    if (!selectedNode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);
}

// ============================================================================
// 5. Main Component: GraphCanvas
// ============================================================================

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  {
    graphData,
    selectedNode,
    onNodeSelect,
    onNodeOpen,
    onNodeMove,
    onNodeDelete,
    onAddSubNode,
    graphConfig,
    search,
    minDepth,
    maxDepth,
    contentFilter,
    tagFilter,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphHandle>();
  const transition = useRef(new LayoutTransitionController());
  const zoomRef = useRef(1);
  const particleStartedAt = useRef(performance.now());
  const glowStartedAt = useRef(performance.now());
  const [size, setSize] = useState({ width: 800, height: 600 });
  const nodeCache = useRef(new Map<string, RenderNode>());
  const handledExplorerFocusNonce = useRef<number | null>(null);

  const engine = useGraphEngineStore();
  const {
    canvasMode,
    layoutMode,
    layoutArrangement,
    orientation,
    highlightMode,
    collapsedIds,
    hoveredId,
    focusedRootId,
    subtreeLayoutOverrides,
    setSubtreeLayoutOverride,
    setFocusedRoot,
    toggleCollapsed,
    setCollapsed,
    setHovered,
    setSelected,
    setTransitionStatus,
    simulationCommand,
  } = useGraphInteractionStore();

    const isTimeLapseActive = useGraphInteractionStore((s) => s.isTimeLapseActive);
  const stopTimeLapse = useGraphInteractionStore((s) => s.stopTimeLapse);
  const timeLapseStep = useGraphInteractionStore((s) => s.timeLapseStep);
  const timeLapseTotal = useGraphInteractionStore((s) => s.timeLapseTotal);
  const setTimeLapseProgress = useGraphInteractionStore((s) => s.setTimeLapseProgress);

  const [timeLapseVisibleIds, setTimeLapseVisibleIds] = useState<Set<string> | null>(null);

  const explorerHoveredNodeId = useExplorerGraphSyncStore(
    (state) => state.explorerHoveredNodeId,
  );
  const explorerFocusRequest = useExplorerGraphSyncStore(
    (state) => state.focusRequest,
  );
  const clearExplorerHoveredNode = useExplorerGraphSyncStore(
    (state) => state.clearExplorerHoveredNode,
  );

  // ---- 1. Container Resize Observer ----------------------------------------
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observe = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observe.observe(element);
    return () => observe.disconnect();
  }, []);

  // ---- 2. Projection Computation -------------------------------------------
  const projection = useMemo(() => {
    const next = buildGraphProjection(graphData.nodes, graphData.links, {
      timeField: engine.timeField,
    });
    const activeIds = new Set(next.nodes.map((node) => node.id));
    const nodes = next.nodes.map((node) => {
      const existing = nodeCache.current.get(node.id);
      if (!existing) {
        nodeCache.current.set(node.id, node);
        return node;
      }
      Object.assign(existing, node);
      return existing;
    });
    for (const id of nodeCache.current.keys()) {
      if (!activeIds.has(id)) nodeCache.current.delete(id);
    }
    return { ...next, nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
  }, [graphData.nodes, graphData.links, engine.timeField]);

  // ---- 3. Metrics Calculation ----------------------------------------------
  const metrics = useMemo(() => {
    const map = new Map<string, NodeMetric>();
    for (const node of projection.nodes) {
      if (!graphConfig.nodes.labelBox) {
        const depthScale = graphConfig.nodes.sizeByDepth
          ? Math.max(0.45, 1 - node.depth * graphConfig.nodes.depthSizeInterval * 0.08)
          : 1;
        const diameter = Math.max(3, graphConfig.nodes.relSize * depthScale) * 2;
        map.set(node.id, { width: diameter, height: diameter });
        continue;
      }
      const label = graphConfig.nodes.labelField === 'id' ? node.id : node.name;
      const layout = cardLayout(label, {
        root: node.parentId === null,
        badge: node.childCount > 0,
        fontSize: graphConfig.nodes.labelSize + (node.parentId === null ? 2 : 0),
      });
      map.set(node.id, { width: layout.width, height: layout.height });
    }
    return map;
  }, [projection, graphConfig.nodes]);

  // ---- 4. Visibility Filter ------------------------------------------------
  
    // Efek eksekusi Time-Lapse berurutan hierarki:
  useEffect(() => {
    if (!isTimeLapseActive) {
      setTimeLapseVisibleIds(null);
      return;
    }

    // 1. Ambil node yang diurutkan berdasarkan hierarki (root folder -> subfolder -> file)
    const sortedNodes = [...projection.nodes].sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    if (sortedNodes.length === 0) {
      stopTimeLapse();
      return;
    }

    // 2. Kosongkan canvas terlebih dahulu (blank state)
    setTimeLapseVisibleIds(new Set());
    setTimeLapseProgress(0, sortedNodes.length);

    let currentIndex = 0;
    const accumulated = new Set<string>();

    // 3. Munculkan satu per satu secara bertahap
    const timer = setInterval(() => {
      if (currentIndex >= sortedNodes.length) {
        clearInterval(timer);
        stopTimeLapse();
        return;
      }

      accumulated.add(sortedNodes[currentIndex].id);
      setTimeLapseVisibleIds(new Set(accumulated));
      currentIndex++;
      setTimeLapseProgress(currentIndex, sortedNodes.length);
    }, 120); // Interval kecepatan animasi tiap node (ms)

    return () => clearInterval(timer);
  }, [isTimeLapseActive, projection, stopTimeLapse, setTimeLapseProgress]);
  
  const visibleIds = useMemo(() => {
    const hidden = hiddenByCollapse(projection, collapsedIds);
    const focusSet = focusedRootId ? subtreeOf(projection, focusedRootId) : null;
    const term = search.trim().toLowerCase();
    const content = contentFilter.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase().replace(/^#/, '');

    return projection.nodes
      .filter((node) => {
        if (hidden.has(node.id)) return false;
        if (focusSet && !focusSet.has(node.id)) return false;
        if (!graphConfig.nodes.showFolderNodes && node.type === 'folder') return false;
        if (!graphConfig.nodes.showFileNodes && node.type !== 'folder') return false;
        if (node.depth < minDepth || node.depth > maxDepth) return false;
        if (term && !node.name.toLowerCase().includes(term)) return false;
        if (content && !node.content.toLowerCase().includes(content)) return false;
        if (tag && !node.tags.some((item) => item.toLowerCase().replace(/^#/, '') === tag)) {
          return false;
        }
        return true;
      })
      .map((node) => node.id);
  }, [
    projection,
    collapsedIds,
    timeLapseVisibleIds,
    focusedRootId,
    search,
    contentFilter,
    tagFilter,
    minDepth,
    maxDepth,
    graphConfig.nodes.showFolderNodes,
    graphConfig.nodes.showFileNodes,
  ]);

  // ---- 5. Layout Engine ----------------------------------------------------
  const geometry = useLayoutEngine(projection, {
    mode: layoutMode,
    width: size.width,
    height: size.height,
    orientation,
    levelGap: engine.levelDistance,
    siblingGap: engine.laneHeight,
    laneGap: engine.laneHeight,
    ribAngle: Math.PI / 4,
    rootId: focusedRootId ?? undefined,
    visibleIds,
    nodeMetrics: metrics,
    subtreeOverrides: subtreeLayoutOverrides,
  });

  // ---- 6. Prepared Data for ForceGraph -------------------------------------
const data = useMemo(() => {
  const visible = new Set(timeLapseVisibleIds ?? visibleIds);
  const nodes = projection.nodes.filter((node) => visible.has(node.id));

  seedInitialNodePositions(
    nodes,
    projection.parentByChild,
    nodeCache.current,
    geometry.targets,
    layoutMode
  );

  const links = projection.links.filter((link) => {
    const source = typeof link.source === 'string' ? link.source : link.source.id;
    const target = typeof link.target === 'string' ? link.target : link.target.id;

    if (canvasMode === 'mindmap' && link.type !== 'hierarchy') {
      return false;
    }

    return visible.has(source) && visible.has(target) && topologyEnabled(link.type, graphConfig);
  });

  return { nodes, links };
}, [projection, visibleIds, timeLapseVisibleIds, graphConfig, geometry.targets, layoutMode, canvasMode]);

  // ---- 7. Layout Transitions & Animation -----------------------------------
  useEffect(() => {
    const controller = transition.current;
    if (usesPhysicsSimulation(layoutMode)) {
      controller.release(data.nodes);
      graphRef.current?.d3ReheatSimulation?.();
      setTransitionStatus('idle');
      return;
    }

    setTransitionStatus('animating');
    controller.run(data.nodes, geometry.targets, {
      duration: 480,
      reducedMotion: prefersReducedMotion(),
      onTick: () => graphRef.current?.refresh?.(),
      onDone: () => setTransitionStatus('idle'),
    });

    return () => controller.cancel();
  }, [geometry, data.nodes, layoutMode, setTransitionStatus]);

  useEffect(() => () => transition.current.cancel(), []);

  // Transisi animasi halus saat Expand / Collapse
  const handleSmoothToggleCollapse = useCallback(
    (nodeId: string) => {
      const isCurrentlyCollapsed = collapsedIds.includes(nodeId);

      if (isCurrentlyCollapsed) {
        toggleCollapsed(nodeId);
        return;
      }

      const parentNode = nodeCache.current.get(nodeId);
      const targetX = parentNode?.x ?? parentNode?.fx ?? 0;
      const targetY = parentNode?.y ?? parentNode?.fy ?? 0;

      const descendants = subtreeOf(projection, nodeId);
      descendants.delete(nodeId);

      if (descendants.size === 0) {
        toggleCollapsed(nodeId);
        return;
      }

      const collapseTargets = new Map(geometry.targets);
      for (const childId of descendants) {
        collapseTargets.set(childId, { x: targetX, y: targetY });
      }

      setTransitionStatus('animating');
      transition.current.run(data.nodes, collapseTargets, {
        duration: 280,
        reducedMotion: prefersReducedMotion(),
        onTick: () => graphRef.current?.refresh?.(),
        onDone: () => {
          setTransitionStatus('idle');
          toggleCollapsed(nodeId);
        },
      });
    },
    [collapsedIds, projection, geometry.targets, data.nodes, toggleCollapsed, setTransitionStatus],
  );

  // ---- 8. Physics & Simulation Integration ---------------------------------
  useGraphPhysicsSimulation({
    graphRef,
    layoutMode,
    forces: graphConfig.forces,
    simulationCommand,
    nodes: data.nodes,
    transitionRef: transition,
  });

  // ---- 9. Explorer Selection & Focus Sync ----------------------------------
  // Sinkronisasi status seleksi murni (Selection only): hanya menandai node aktif,
  // tanpa animasi perpindahan kamera, tanpa zoom, dan tanpa auto-uncollapse branch.
  useEffect(() => {
    setSelected(selectedNode ? selectedNode.id : null);
  }, [selectedNode?.id, setSelected]);


  useExplorerFocusSync({
    explorerFocusRequest,
    handledNonceRef: handledExplorerFocusNonce,
    parentByChild: projection.parentByChild,
    collapsedIds,
    setCollapsed,
    nodes: data.nodes,
    graphRef,
  });

  useGraphKeyboardShortcuts(selectedNode);

  // ---- 10. Atmosphere, Highlights & Render Theme ---------------------------
  const activeHoverId = explorerHoveredNodeId ?? hoveredId;
  const pathway = useMemo(
    () => (highlightMode === 'pathway' ? pathwayOf(projection, activeHoverId) : new Set<string>()),
    [projection, activeHoverId, highlightMode],
  );

  const theme = useMemo(() => buildTheme(graphConfig), [graphConfig]);
  const visibleDepths = useMemo(() => uniqueDepths(data.nodes), [data.nodes]);

  const { particleProgress, glowPhase, autoPauseRedraw, renderDecorations } = useCanvasAtmosphere({
    graphConfig,
    layoutMode,
    decorations: geometry.decorations,
    theme,
    projection,
    zoomOutRendering: engine.zoomOutRendering,
    size,
    zoomRef,
  });

  useEffect(() => {
    particleStartedAt.current = performance.now();
    particleProgress.current = 0;
  }, [graphConfig.links.showParticles, graphConfig.links.particles, graphConfig.links.particleSpeed, particleProgress]);

  useEffect(() => {
    glowStartedAt.current = performance.now();
    glowPhase.current = 0;
  }, [graphConfig.nodes.glow, graphConfig.nodes.glowSpeed, glowPhase]);

  const metricOf = useCallback(
    (node: RenderNode) => {
      const metric = metrics.get(node.id) ?? { width: 90, height: 28 };
      if (engine.zoomOutRendering !== 'full-detail') return metric;
      const scale = 1 / Math.max(0.05, zoomRef.current);
      return { width: metric.width * scale, height: metric.height * scale };
    },
    [metrics, engine.zoomOutRendering],
  );

  // ---- 11. Canvas Drawing Callbacks ----------------------------------------
  const paintNode = useCallback(
    (node: RenderNode, ctx: CanvasRenderingContext2D, zoom: number) => {
      zoomRef.current = zoom;
      drawNode(ctx, node, {
        theme,
        zoom,
        selected: selectedNode?.id === node.id,
        hovered: activeHoverId === node.id,
        dimmed: pathway.size > 0 && !pathway.has(node.id),
        collapsed: collapsedIds.includes(node.id),
        isRoot: node.parentId === null,
        showLabels: engine.showLabels && graphConfig.nodes.showLabels,
        labelThreshold: engine.labelZoomThreshold,
        preserveDetail: engine.zoomOutRendering === 'full-detail',
        config: graphConfig.nodes,
        glowPhase: glowPhase.current,
        isDragged: dragRef.current.draggedNodeId === node.id,
        isDropTarget: dragRef.current.hoveredTargetId === node.id,
        dropTargetValid: dragRef.current.isValidDrop,
      });
    },
    [
      theme,
      selectedNode,
      activeHoverId,
      pathway,
      collapsedIds,
      engine.showLabels,
      engine.labelZoomThreshold,
      engine.zoomOutRendering,
      graphConfig.nodes,
      glowPhase,
    ],
  );

  const paintPointer = useCallback(
    (node: RenderNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintNodePointerArea(
        ctx,
        node,
        color,
        node.parentId === null,
        graphConfig.nodes,
        zoomRef.current,
        engine.zoomOutRendering === 'full-detail',
      );
    },
    [graphConfig.nodes, engine.zoomOutRendering],
  );

  const paintLink = useCallback(
    (link: RenderLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as RenderNode;
      const target = link.target as RenderNode;
      if (typeof source !== 'object' || typeof target !== 'object') return;

      if (layoutMode === 'fishbone' && (link.type ?? 'hierarchy') === 'hierarchy') return;

      const style =
        graphConfig.topology.styles[
          (link.type ?? 'hierarchy') as keyof typeof graphConfig.topology.styles
        ] ?? graphConfig.topology.styles.hierarchy;
      const type = (link.type ?? 'hierarchy') as keyof typeof graphConfig.topology.styles;
      const defaultTypeStyle =
        defaultTopologyConfig.styles[type] ?? defaultTopologyConfig.styles.hierarchy;
      const widthScale = graphConfig.links.width / defaultLinkConfig.width;
      const opacityScale = graphConfig.links.opacity / defaultLinkConfig.opacity;
      const usesDefaultTypeColor = style.color === defaultTypeStyle.color;

      const hierarchyPaint =
        graphConfig.hierarchy.enabled && type === 'hierarchy'
          ? resolveHierarchyLinkPaint(source.depth, target.depth, graphConfig.hierarchy)
          : null;
      const strokeColor = hierarchyPaint
        ? hierarchyPaint.color
        : usesDefaultTypeColor
          ? theme.link
          : style.color;

      drawLink(ctx, source, target, {
        mode: layoutMode,
        theme,
        color: strokeColor,
        width: Math.max(0.25, style.width * widthScale),
        opacity: hierarchyPaint?.opacity ?? Math.min(1, style.opacity * opacityScale),
        dash:
          style.lineStyle === 'solid'
            ? parseDash(graphConfig.links.dashArray, style.width * widthScale)
            : dashFor(style.lineStyle, style.width * widthScale),
        dimmed: pathway.size > 0 && !(pathway.has(source.id) && pathway.has(target.id)),
        showArrow: graphConfig.links.showArrows,
        arrowLength: graphConfig.links.arrowLength,
        arrowRelPos: graphConfig.links.arrowRelPos,
        curvature: graphConfig.links.curvature,
        curveRotation: graphConfig.links.curveRotation,
        particles: graphConfig.links.showParticles ? graphConfig.links.particles : 0,
        particleWidth: graphConfig.links.particleWidth,
        particleColor: hierarchyPaint ? hierarchyPaint.color : graphConfig.links.particleColor,
        particleProgress: particleProgress.current,
        zoom: zoomRef.current,
        preserveDetail: engine.zoomOutRendering === 'full-detail',
        metricOf,
      });
    },
    [graphConfig, layoutMode, theme, pathway, metricOf, engine.zoomOutRendering, particleProgress],
  );

  const handleHover = useCallback(
    (node: RenderNode | null) => {
      if (node) clearExplorerHoveredNode();
      setHovered(node?.id ?? null);
    },
    [clearExplorerHoveredNode, setHovered],
  );


  useEffect(() => {
    const id = window.setTimeout(() => graphRef.current?.zoomToFit?.(400, 60), 400);
    return () => window.clearTimeout(id);
  }, [layoutMode, orientation]);

  // 1. Hitung batas zoom dan batas area panning secara dinamis sesuai profil layout & geometri nyata
  const { minZoom: minZoomLimit, panBounds } = useMemo(
    () =>
      calculateCameraBounds({
        nodes: data.nodes,
        viewportWidth: size.width,
        viewportHeight: size.height,
        layoutMode,
        orientation,
        geometryBounds: geometry.bounds,
      }),
    [data.nodes, size.width, size.height, layoutMode, orientation, geometry.bounds],
  );

  // 2. Ref guard untuk mencegah recursive re-triggering saat clamping
  const isClampingPanRef = useRef(false);

  // 3. Batasi posisi panning kamera agar tidak keluar dari area dinamis yang aman
  const clampPanToBounds = useCallback(() => {
    if (isClampingPanRef.current || !graphRef.current) return;

    const graph = graphRef.current;
    const center = graph.centerAt();
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return;

    const clampedX = Math.max(panBounds.minX, Math.min(panBounds.maxX, center.x));
    const clampedY = Math.max(panBounds.minY, Math.min(panBounds.maxY, center.y));

    // Hanya koreksi posisi kamera bila melanggar batas lebih dari toleransi 0.5px
    if (Math.abs(center.x - clampedX) > 0.5 || Math.abs(center.y - clampedY) > 0.5) {
      isClampingPanRef.current = true;
      graph.centerAt(clampedX, clampedY);
      isClampingPanRef.current = false;
    }
  }, [panBounds]);

  // ---- 12. Gestures, Reparent Drag & Imperative Handle ---------------------
  const {
    isToolbarVisible,
    setIsToolbarVisible,
    toolbarCoords,
    updateToolbarPosition,
    handleClick,
    handleNodeRightClick,
    handleTouchStart,
    handleBackgroundClick,
    handleBackgroundRightClick,
    smartZoom,
  } = useCanvasGestureBridge({
    containerRef,
    graphRef,
    zoomRef,
    nodes: data.nodes,
    rawNodes: graphData.nodes,
    selectedNode,
    onNodeSelect,
    onNodeOpen,
    onToggleCollapse: handleSmoothToggleCollapse,
    setSelected,
    onCanvasInteraction: () => clearExplorerHoveredNode(),
  });

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {},
      smartZoom,
    }),
    [smartZoom],
  );

  const { dragRef, handleNodeDrag, handleNodeDragEnd } = useCanvasDragReparent({
    nodes: data.nodes,
    parentByChild: projection.parentByChild,
    childrenByParent: projection.childrenByParent,
    layoutMode,
    layoutArrangement,
    layoutTargets: geometry.targets,
    transitionRef: transition,
    graphRef,
    onNodeMove,
  });

  const handleZoomEnd = useCallback(() => {
    updateToolbarPosition();
    clampPanToBounds();
  }, [updateToolbarPosition, clampPanToBounds]);

  const isPhysicsActive = usesPhysicsSimulation(layoutMode);


  // ---- 13. Render Visual Stack ---------------------------------------------
  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onTouchStart={handleTouchStart}
    >

      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={size.width}
        height={size.height}
        backgroundColor={theme.card}
        minZoom={minZoomLimit}
        maxZoom={8}
        nodeRelSize={graphConfig.nodes.relSize}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}
        onRenderFramePost={updateToolbarPosition}
        onZoom={updateToolbarPosition}
         onZoomEnd={handleZoomEnd}
        onNodeClick={handleClick}
        onNodeRightClick={handleNodeRightClick}
        onNodeHover={handleHover}
        enableNodeDrag={true}
        enablePanInteraction={true}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        dagMode={
          isPhysicsActive && graphConfig.forces.dagMode !== 'null'
            ? graphConfig.forces.dagMode
            : null
        }
        dagLevelDistance={graphConfig.forces.dagLevelDistance}
        warmupTicks={isPhysicsActive ? graphConfig.forces.warmupTicks : 0}
        cooldownTicks={isPhysicsActive ? graphConfig.forces.cooldownTicks : 0}
        cooldownTime={isPhysicsActive ? graphConfig.forces.cooldownTime : 0}
        d3AlphaDecay={graphConfig.forces.alphaDecay}
        d3VelocityDecay={graphConfig.forces.velocityDecay}
        onBackgroundClick={handleBackgroundClick}
        onBackgroundRightClick={handleBackgroundRightClick}
        autoPauseRedraw={autoPauseRedraw}
        onRenderFramePre={renderDecorations}
      />

      <GraphCanvasUtilityDock
        depths={visibleDepths}
        hierarchy={graphConfig.hierarchy}
        nodes={data.nodes}
        links={data.links}
        graphRef={graphRef}
        viewportWidth={size.width}
        viewportHeight={size.height}
        folderColor={theme.folder}
        fileColor={theme.file}
        linkColor={theme.link}
        selectedNodeId={selectedNode?.id ?? null}
        onSmartZoom={smartZoom}
      />

      <GraphContextualToolbarOverlay
        isVisible={isToolbarVisible}
        selectedNode={selectedNode}
        toolbarCoords={toolbarCoords}
        canvasMode={canvasMode}
        currentOverride={subtreeLayoutOverrides?.[selectedNode?.id ?? '']}
        isFocused={focusedRootId === selectedNode?.id}
        onSetStructure={(mode) => {
          if (selectedNode) setSubtreeLayoutOverride(selectedNode.id, mode);
        }}
        onAddSubNode={onAddSubNode}
        onNodeDelete={onNodeDelete}
        onToggleFocus={() => {
          if (selectedNode) {
            setFocusedRoot(focusedRootId === selectedNode.id ? null : selectedNode.id);
          }
        }}
                onZoomToSelection={() => {
          if (selectedNode) {
            const target = data.nodes.find((n) => n.id === selectedNode.id);
            if (target && target.x !== undefined && target.y !== undefined) {
              graphRef.current?.centerAt?.(target.x, target.y, 450);
              graphRef.current?.zoom?.(2.25, 450);
              return;
            }
          }
          smartZoom('selection');
        }}
        onClose={() => setIsToolbarVisible(false)}
      />
    </div>
  );
});
