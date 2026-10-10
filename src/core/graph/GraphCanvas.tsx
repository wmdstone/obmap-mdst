/**
 * GraphCanvas — the single graph renderer.
 *
 * Rendering, camera, hit testing and dragging are delegated to
 * react-force-graph-2d; all coordinates come from the deterministic layout
 * engine (`useLayoutEngine`) via the transition controller.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { GraphConfigState } from '@/shared/stores/useGraphStore';
import { defaultLinkConfig, defaultTopologyConfig } from '@/shared/stores/useGraphStore';
import type { Link, Node } from '@/shared/stores/types';
import { useGraphEngineStore } from '@/shared/stores/useGraphEngineStore';
import { GraphBottomOverlays } from './GraphBottomOverlays';
import { buildGraphProjection } from './model/buildGraphProjection';
import type { NodeMetric, RenderNode, RenderLink } from './model/graphTypes';
import { useGraphInteractionStore } from './model/useGraphInteractionStore';
import { useLayoutEngine } from './layout/useLayoutEngine';
import { ContextualToolbar } from './interactions/ContextualToolbar';
import {
  LayoutTransitionController,
  prefersReducedMotion,
} from './layout/transitionController';
import { hiddenByCollapse, pathwayOf, subtreeOf } from './interactions/graphTraversal';
import { drawNode, paintNodePointerArea } from './render/drawNode';
import { drawLink } from './render/drawLink';
import { drawDecorations } from './render/drawDecorations';
import { buildTheme } from './render/theme';
import { resolveHierarchyLinkPaint, uniqueDepths } from './model/hierarchyColors';
import { cardLayout } from './render/textLayout';
// Tambahkan import ini di bagian atas bersama import interactions lainnya:
import {
  findHoveredDropTarget,
  validateReparent,
  type DragReparentState,
} from './interactions/dragReparent';
import { drawCosmicAtmosphere } from './render/cosmicAtmosphere';



export interface GraphCanvasProps {
  graphData: { nodes: Node[]; links: Link[] };
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  onNodeOpen?: (node: Node) => void;
  graphConfig: GraphConfigState;
  onNodeMove?: (nodeId: string, newParentId: string | null) => Promise<void> | void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onAddSubNode?: (parentId: string, type: "file" | "folder") => Promise<void> | void;
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

const topologyEnabled = (type: RenderLink['type'], config: GraphConfigState) => {
  if (type === 'hierarchy') return config.topology.showHierarchy;
  if (type === 'backlink') return config.topology.showBacklinks;
  if (type === 'tag') return config.topology.showTags;
  return true;
};

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
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
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphHandle>();
  const transition = useRef(new LayoutTransitionController());
  const zoomRef = useRef(1);
  const particleProgress = useRef(0);
  const particleStartedAt = useRef(performance.now());
  const glowPhase = useRef(0);
  const glowStartedAt = useRef(performance.now());
  const [size, setSize] = useState({ width: 800, height: 600 });
  const nodeCache = useRef(new Map<string, RenderNode>());
  // Simpan state drag di Ref agar tidak memicu re-render canvas loop pada 60fps mouse drag
  const dragRef = useRef<DragReparentState>({
    draggedNodeId: null,
    draggedNodeOriginalPos: null,
    hoveredTargetId: null,
    isValidDrop: false,
  });
  // 1. State visibilitas & koordinat toolbar
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [toolbarCoords, setToolbarCoords] = useState<{ x: number; y: number } | null>(null);

  // Tracker untuk deteksi double tap di touchpad / mobile screen
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const engine = useGraphEngineStore();
  // SESUDAH (tambahkan canvasMode dan state subtree override):
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
    branchColorOverrides,
    setSubtreeLayoutOverride,
    setBranchColorOverride,
    setFocusedRoot,
    toggleCollapsed,
    setHovered,
    setSelected,
    setTransitionStatus,
    simulationCommand,
  } = useGraphInteractionStore();
  const cosmicActive = ((graphConfig as any).atmosphere?.cosmicParticles ?? 35) > 0;

  // ---- size ----------------------------------------------------------------
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

  // ---- projection ----------------------------------------------------------
  const projection = useMemo(() => {
    const next = buildGraphProjection(graphData.nodes, graphData.links, { timeField: engine.timeField });
    const activeIds = new Set(next.nodes.map((node) => node.id));
    const nodes = next.nodes.map((node) => {
      const existing = nodeCache.current.get(node.id);
      if (!existing) {
        nodeCache.current.set(node.id, node);
        return node;
      }
      // ForceGraph mutates coordinates on these objects. Preserve that motion
      // state while refreshing only vault-derived metadata.
      Object.assign(existing, node);
      return existing;
    });
    for (const id of nodeCache.current.keys()) {
      if (!activeIds.has(id)) nodeCache.current.delete(id);
    }
    return { ...next, nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
  }, [graphData.nodes, graphData.links, engine.timeField]);

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

  // ---- visibility: filters + collapse + focus ------------------------------
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
        // Node type filters (folders vs files/notes).
        if (!graphConfig.nodes.showFolderNodes && node.type === 'folder') return false;
        if (!graphConfig.nodes.showFileNodes && node.type !== 'folder') return false;
        if (node.depth < minDepth || node.depth > maxDepth) return false;
        if (term && !node.name.toLowerCase().includes(term)) return false;
        if (content && !node.content.toLowerCase().includes(content)) return false;
        if (tag && !node.tags.some((item) => item.toLowerCase().replace(/^#/, '') === tag))
          return false;
        return true;
      })
      .map((node) => node.id);
  }, [
    projection,
    collapsedIds,
    focusedRootId,
    search,
    contentFilter,
    tagFilter,
    minDepth,
    maxDepth,
    graphConfig.nodes.showFolderNodes,
    graphConfig.nodes.showFileNodes,
  ]);

  const customPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

    useEffect(() => {
    customPositions.current.clear();
  }, [layoutMode]);

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

  // ---- data handed to ForceGraph2D (stable object identities) --------------
  const data = useMemo(() => {
    const visible = new Set(visibleIds);
    const nodes = projection.nodes.filter((node) => visible.has(node.id));
    // Seed newly visible nodes at their deterministic target before ForceGraph
    // sees them. This avoids one-frame links to its temporary simulation
    // coordinates during data refresh, collapse and expand.
    for (const node of nodes) {
      const target = geometry.targets.get(node.id);
      if (!target) continue;
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        node.x = target.x;
        node.y = target.y;
        if (layoutMode !== 'free-force') {
          node.fx = target.x;
          node.fy = target.y;
        }
      }
    }

    const links = projection.links.filter((link) => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;

      // Di mode mindmap, hanya tampilkan link hierarki pohon (kecuali jika user menyalakan backlink di config)
      if (canvasMode === 'mindmap' && link.type !== 'hierarchy') {
        return false;
      }

      return visible.has(source) && visible.has(target) && topologyEnabled(link.type, graphConfig);
    });

    return { nodes, links };
  }, [projection, visibleIds, graphConfig, geometry.targets, layoutMode]);

  // ---- layout transitions --------------------------------------------------
  useEffect(() => {
    const controller = transition.current;
    if (layoutMode === 'free-force') {
      controller.release(data.nodes);
      // Reheat simulasi fisika secara halus dengan alpha target
      const fg = graphRef.current;
      if (fg?.d3ReheatSimulation) {
        fg.d3ReheatSimulation();
      }
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


  // Helper: Transisi animasi halus saat Expand / Collapse
  const handleSmoothToggleCollapse = useCallback(
    (nodeId: string) => {
      const isCurrentlyCollapsed = collapsedIds.includes(nodeId);

      // JIKA EXPAND (+): Buka langsung dan biarkan seeding (A) menganimasikan anak keluar
      if (isCurrentlyCollapsed) {
        toggleCollapsed(nodeId);
        return;
      }

      // JIKA COLLAPSE (-): Animasikan semua anak meluncur masuk ke tubuh induk sebelum disembunyikan
      const parentNode = nodeCache.current.get(nodeId);
      const targetX = parentNode?.x ?? parentNode?.fx ?? 0;
      const targetY = parentNode?.y ?? parentNode?.fy ?? 0;

      // Cari semua anak dan keturunan yang akan dilipat
      const descendants = subtreeOf(projection, nodeId);
      descendants.delete(nodeId); // Simpan induknya tetap di tempat

      if (descendants.size === 0 || layoutMode === 'free-force') {
        toggleCollapsed(nodeId);
        return;
      }

      const collapseTargets = new Map(geometry.targets);
      for (const childId of descendants) {
        collapseTargets.set(childId, { x: targetX, y: targetY });
      }

      setTransitionStatus('animating');
      transition.current.run(data.nodes, collapseTargets, {
        duration: 320,
        reducedMotion: prefersReducedMotion(),
        onTick: () => graphRef.current?.refresh?.(),
        onDone: () => {
          setTransitionStatus('idle');
          toggleCollapsed(nodeId);
        },
      });
    },
    [collapsedIds, projection, geometry.targets, data.nodes, layoutMode, toggleCollapsed, setTransitionStatus]
  );

  useEffect(() => () => transition.current.cancel(), []);

  // Apply every physics setting through the wrapper's supported force API.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || layoutMode !== 'free-force') return;
    const charge = graph.d3Force?.('charge');
    charge?.strength?.(graphConfig.forces.chargeStrength);
    const link = graph.d3Force?.('link');
    link?.distance?.(graphConfig.forces.linkDistance);
    const center = graph.d3Force?.('center');
    center?.strength?.(graphConfig.forces.centerStrength);
    graph.d3ReheatSimulation?.();
  }, [layoutMode, graphConfig.forces.chargeStrength, graphConfig.forces.linkDistance, graphConfig.forces.centerStrength]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !simulationCommand || layoutMode !== 'free-force') return;
    if (simulationCommand.type === 'reheat') {
      // Releasing fixed coordinates restarts physics without coupling it to the
      // canvas animation loop. Particle rendering must remain alive either way.
      transition.current.release(data.nodes);
      graph.d3ReheatSimulation?.();
    } else {
      // Freeze physics by pinning the current coordinates. pauseAnimation()
      // cannot be used here because it also stops custom canvas redraws.
      for (const node of data.nodes) {
        node.fx = node.x;
        node.fy = node.y;
        node.vx = 0;
        node.vy = 0;
      }
      graph.refresh?.();
    }
  }, [simulationCommand, layoutMode, data.nodes]);

  useEffect(() => {
    particleStartedAt.current = performance.now();
    particleProgress.current = 0;
  }, [graphConfig.links.showParticles, graphConfig.links.particles, graphConfig.links.particleSpeed]);

  useEffect(() => {
    if (!selectedNode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika fokus sedang berada pada input teks, textarea, atau elemen editable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 1. Shortcut TAB: Buat child node baru di bawah node terpilih
      if (e.key === 'Tab') {
        e.preventDefault();
        // Panggil fungsi penambahan node
        // Misal: onAddChildNode?.(selectedNode.id);
      }

      // 2. Shortcut DELETE / BACKSPACE: Hapus node terpilih
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // Panggil fungsi dialog/konfirmasi hapus
        // Misal: onDeleteNode?.(selectedNode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);


  const particlesActive = graphConfig.links.showParticles && graphConfig.links.particles > 0;
  const glowAnimated =
    graphConfig.nodes.glow && graphConfig.nodes.glowSpeed > 0 && !prefersReducedMotion();

  useEffect(() => {
    glowStartedAt.current = performance.now();
    glowPhase.current = 0;
  }, [graphConfig.nodes.glow, graphConfig.nodes.glowSpeed]);

  // ---- highlight sets ------------------------------------------------------
  const pathway = useMemo(
    () => (highlightMode === 'pathway' ? pathwayOf(projection, hoveredId) : new Set<string>()),
    [projection, hoveredId, highlightMode]
  );

  const theme = useMemo(() => buildTheme(graphConfig), [graphConfig]);
  const visibleDepths = useMemo(() => uniqueDepths(data.nodes), [data.nodes]);
  const metricOf = useCallback(
    (node: RenderNode) => {
      const metric = metrics.get(node.id) ?? { width: 90, height: 28 };
      if (engine.zoomOutRendering !== 'full-detail') return metric;
      const scale = 1 / Math.max(0.05, zoomRef.current);
      return { width: metric.width * scale, height: metric.height * scale };
    },
    [metrics, engine.zoomOutRendering]
  );

  // ---- draw callbacks ------------------------------------------------------
  const paintNode = useCallback(
    (node: RenderNode, ctx: CanvasRenderingContext2D, zoom: number) => {
      zoomRef.current = zoom;
      drawNode(ctx, node, {
        theme,
        zoom,
        selected: selectedNode?.id === node.id,
        hovered: hoveredId === node.id,
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
    [theme, selectedNode, hoveredId, pathway, collapsedIds, engine.showLabels, engine.labelZoomThreshold, engine.zoomOutRendering, graphConfig.nodes]
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
        engine.zoomOutRendering === 'full-detail'
      );
    },
    [graphConfig.nodes, engine.zoomOutRendering]
  );

  const paintLink = useCallback(
    (link: RenderLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as RenderNode;
      const target = link.target as RenderNode;
      if (typeof source !== 'object' || typeof target !== 'object') return;
      // Fishbone hierarchy is represented by the exact spine/rib geometry.
      // Drawing the generic hierarchy edge as well creates doubled, crossing lines.
      if (layoutMode === 'fishbone' && (link.type ?? 'hierarchy') === 'hierarchy') return;
      const style =
        graphConfig.topology.styles[
        (link.type ?? 'hierarchy') as keyof typeof graphConfig.topology.styles
        ] ?? graphConfig.topology.styles.hierarchy;
      const type = (link.type ?? 'hierarchy') as keyof typeof graphConfig.topology.styles;
      const defaultTypeStyle = defaultTopologyConfig.styles[type] ?? defaultTopologyConfig.styles.hierarchy;
      const widthScale = graphConfig.links.width / defaultLinkConfig.width;
      const opacityScale = graphConfig.links.opacity / defaultLinkConfig.opacity;
      const usesDefaultTypeColor = style.color === defaultTypeStyle.color;
      // Level colouring applies to hierarchy edges only: backlink/tag/semantic
      // keep their type style so the relation meaning stays readable.
      const hierarchyPaint =
        graphConfig.hierarchy.enabled && type === 'hierarchy'
          ? resolveHierarchyLinkPaint(source.depth, target.depth, graphConfig.hierarchy)
          : null;
      const strokeColor = hierarchyPaint
        ? hierarchyPaint.color
        : usesDefaultTypeColor ? theme.link : style.color;
      drawLink(ctx, source, target, {
        mode: layoutMode,
        theme,
        color: strokeColor,
        width: Math.max(0.25, style.width * widthScale),
        opacity: hierarchyPaint?.opacity ?? Math.min(1, style.opacity * opacityScale),
        dash: style.lineStyle === 'solid'
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
    [graphConfig, layoutMode, theme, pathway, metricOf, engine.zoomOutRendering]
  );

  const renderDecorations = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      zoomRef.current = globalScale;

      // 1. Living Canvas Atmosphere (Cosmic Dust & Nebula Grid)
      // Transform context ke koordinat layar penuh
      const atmosphere = (graphConfig as any).atmosphere ?? { cosmicParticles: 35, cosmicSpeed: 1 };
      if (atmosphere.cosmicParticles > 0 && size.width > 0 && size.height > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawCosmicAtmosphere(
          ctx,
          size.width,
          size.height,
          performance.now() / 1000,
          {
            intensity: atmosphere.cosmicParticles,
            speed: atmosphere.cosmicSpeed ?? 1.0,
          }
        );
        ctx.restore();
      }

      // 2. Link flow particles & node glow phases
      if (particlesActive) {
        particleProgress.current =
          ((performance.now() - particleStartedAt.current) * graphConfig.links.particleSpeed) / 100;
      }
      glowPhase.current = glowAnimated
        ? ((performance.now() - glowStartedAt.current) / 2400) * graphConfig.nodes.glowSpeed
        : 0.25;

      // 3. Fishbone & hierarchy layout decorations
      if (layoutMode === 'fishbone' && !graphConfig.topology.showHierarchy) return;
      const hierarchy = graphConfig.topology.styles.hierarchy;
      const levels = graphConfig.hierarchy;
      drawDecorations(
        ctx,
        geometry.decorations,
        theme,
        globalScale,
        {
          color: hierarchy.color || theme.link,
          opacity: hierarchy.opacity,
          width: hierarchy.width,
          dash: dashFor(hierarchy.lineStyle, hierarchy.width),
        },
        levels.enabled
          ? (decoration) => {
            const sourceDepth =
              projection.byId.get((decoration as { sourceId?: string }).sourceId ?? '')?.depth;
            const targetDepth = projection.byId.get(decoration.targetId ?? '')?.depth;
            if (sourceDepth === undefined && targetDepth === undefined) return null;
            return resolveHierarchyLinkPaint(
              sourceDepth ?? targetDepth ?? 0,
              targetDepth ?? sourceDepth ?? 0,
              levels
            );
          }
          : undefined,
        engine.zoomOutRendering === 'full-detail'
      );
    },
    [
      geometry.decorations,
      theme,
      layoutMode,
      particlesActive,
      glowAnimated,
      graphConfig.nodes.glowSpeed,
      graphConfig.links.particleSpeed,
      graphConfig.topology.showHierarchy,
      graphConfig.topology.styles.hierarchy,
      graphConfig.hierarchy,
      projection,
      engine.zoomOutRendering,
      (graphConfig as any).atmosphere,
      size.width,
      size.height,
    ]
  );


  // Ref untuk mendeteksi interval waktu antar-klik (double-click detector)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  // ---- interactions --------------------------------------------------------

  // Update posisi toolbar saat node terpilih bergerak atau kamera dizoom/pan
  const updateToolbarPosition = useCallback(() => {
    if (!selectedNode || !graphRef.current) {
      if (toolbarCoords !== null) setToolbarCoords(null);
      return;
    }

    const renderNode = data.nodes.find((n) => n.id === selectedNode.id);
    if (!renderNode || renderNode.x === undefined || renderNode.y === undefined) {
      if (toolbarCoords !== null) setToolbarCoords(null);
      return;
    }

    const screenPos = graphRef.current.graph2ScreenCoords?.(renderNode.x, renderNode.y);
    if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
      setToolbarCoords({ x: screenPos.x, y: screenPos.y });
    }
  }, [selectedNode, data.nodes, toolbarCoords]);

  // 1. Single click: Select node / Toggle Collapse | Double click: BUKA NOTE EDITOR TAB
  const handleClick = useCallback(
    (node: RenderNode, event: MouseEvent | TouchEvent) => {
      // ---- A. DETEKSI KLIK PADA TOMBOL COLLAPSE / EXPAND (— atau +N) ----
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const mouseEvt = event as MouseEvent;

      const screenX =
        mouseEvt.clientX !== undefined && rect
          ? mouseEvt.clientX - rect.left
          : 'offsetX' in mouseEvt && typeof mouseEvt.offsetX === 'number'
            ? mouseEvt.offsetX
            : 0;

      const screenY =
        mouseEvt.clientY !== undefined && rect
          ? mouseEvt.clientY - rect.top
          : 'offsetY' in mouseEvt && typeof mouseEvt.offsetY === 'number'
            ? mouseEvt.offsetY
            : 0;

      const coords = graphRef.current?.screen2GraphCoords?.(screenX, screenY);
      const toggle = node.toggle;

      if (coords && toggle) {
        const distance = Math.hypot(coords.x - toggle.x, coords.y - toggle.y);
        if (distance <= toggle.r + 4) {
          handleSmoothToggleCollapse(node.id);
          setIsToolbarVisible(false);
          return;
        }
      }

      // ---- B. DETEKSI DOUBLE CLICK (BUKA NOTE EDITOR TAB) ----
      const matchedNode = graphData.nodes.find((item) => item.id === node.id) ?? null;
      const now = Date.now();
      const last = lastTapRef.current;
      const isDoubleClick =
        (last.id === node.id && now - last.time < 350) ||
        (event as MouseEvent).detail === 2;
      lastTapRef.current = { id: node.id, time: now };

      if (isDoubleClick) {
        if (matchedNode) {
          onNodeOpen?.(matchedNode);
        }
        setIsToolbarVisible(false);
        return;
      }

      // ---- C. SINGLE CLICK BIASA: SELEKSI NODE ----
      setSelected(node.id);
      onNodeSelect(matchedNode);
      setIsToolbarVisible(false);
    },
    [toggleCollapsed, setSelected, onNodeSelect, onNodeOpen, graphData.nodes]
  );

  // 2. KLIK KANAN / 2-FINGER TAP TOUCHPAD: Langsung trigger dan tampilkan Floating Toolbar
  const handleNodeRightClick = useCallback(
    (node: RenderNode, event: MouseEvent) => {
      event.preventDefault?.();
      const matchedNode = graphData.nodes.find((item) => item.id === node.id) ?? null;

      setSelected(node.id);
      onNodeSelect(matchedNode);
      setIsToolbarVisible(true);

      // Update posisi ke node tersebut
      const screenPos = graphRef.current?.graph2ScreenCoords?.(node.x ?? 0, node.y ?? 0);
      if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
        setToolbarCoords({ x: screenPos.x, y: screenPos.y });
      }
    },
    [setSelected, onNodeSelect, graphData.nodes]
  );

  // 3. DETEKSI DOUBLE TAP SEKALIGUS (2 JARI) PADA LAYAR SENTUH / SCREEN HP
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect || !graphRef.current) return;

        // Cari titik tengah sentuhan kedua jari
        const midScreenX = (touch1.clientX + touch2.clientX) / 2 - containerRect.left;
        const midScreenY = (touch1.clientY + touch2.clientY) / 2 - containerRect.top;

        // Konversi ke koordinat graph
        const graphCoords = graphRef.current.screen2GraphCoords?.(midScreenX, midScreenY);
        if (!graphCoords) return;

        // Cari node terdekat di bawah sentuhan
        let closestNode: RenderNode | null = null;
        let minDistance = Infinity;

        for (const n of data.nodes) {
          if (n.x === undefined || n.y === undefined) continue;
          const dx = n.x - graphCoords.x;
          const dy = n.y - graphCoords.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestNode = n;
          }
        }

        const currentZoom = zoomRef.current || 1;
        const maxThreshold = Math.max(30, 45 / currentZoom);

        if (closestNode && minDistance <= maxThreshold) {
          e.preventDefault();
          const matchedNode = graphData.nodes.find((item) => item.id === closestNode.id) ?? null;
          setSelected(closestNode.id);
          onNodeSelect(matchedNode);
          setIsToolbarVisible(true);
          const screenPos = graphRef.current.graph2ScreenCoords?.(closestNode.x ?? 0, closestNode.y ?? 0);
          if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
            setToolbarCoords({ x: screenPos.x, y: screenPos.y });
          }
        }
      }
    },
    [data.nodes, graphData.nodes, onNodeSelect, setSelected]
  );


  const handleHover = useCallback(
    (node: RenderNode | null) => setHovered(node?.id ?? null),
    [setHovered]
  );

  useEffect(() => {
    const id = window.setTimeout(() => graphRef.current?.zoomToFit?.(400, 60), 400);
    return () => window.clearTimeout(id);
    // Re-fit when the layout mode changes, not on every data tick.
  }, [layoutMode, orientation]);

  const handleNodeDrag = useCallback(
    (node: RenderNode) => {
      // Simpan koordinat awal saat pertama kali node mulai di-drag
      if (dragRef.current.draggedNodeId !== node.id) {
        dragRef.current = {
          draggedNodeId: node.id,
          draggedNodeOriginalPos: { x: node.x ?? 0, y: node.y ?? 0 },
          hoveredTargetId: null,
          isValidDrop: false,
        };
      }

      // Deteksi folder target di bawah kursor (toleransi 60px) di SEMUA mode & algoritma
      const hoveredTarget = findHoveredDropTarget(node, data.nodes, 60);
      if (!hoveredTarget) {
        dragRef.current.hoveredTargetId = null;
        dragRef.current.isValidDrop = false;
        return;
      }

      const validation = validateReparent(
        node,
        hoveredTarget,
        projection.parentByChild,
        projection.childrenByParent
      );

      dragRef.current.hoveredTargetId = hoveredTarget.id;
      dragRef.current.isValidDrop = validation.valid;
      dragRef.current.dropReason = validation.reason;
    },
    [data.nodes, projection]
  );

  const handleNodeDragEnd = useCallback(
    (node: RenderNode) => {
      const { hoveredTargetId, isValidDrop, draggedNodeOriginalPos } = dragRef.current;

      // KASUS 1: REPARENTING VALID DIJALANKAN (BERFUNGSI DI GRAPH & MINDMAP)
      if (isValidDrop && hoveredTargetId) {
        onNodeMove?.(node.id, hoveredTargetId);
        customPositions.current.delete(node.id);
        delete node.fx;
        delete node.fy;
      } else {
        // KASUS 2: DROP DI RUANG KOSONG
        if (layoutArrangement === 'auto') {
          // MODE AUTO: Snap-back ke kalkulasi algoritma (anti-overlap)
          customPositions.current.delete(node.id);

          if (layoutMode === 'free-force') {
            // Pada free-force auto, bebaskan pin dan biarkan fisika mengalir
            delete node.fx;
            delete node.fy;
            graphRef.current?.d3ReheatSimulation?.();
          } else {
            // Pada algoritma deterministik, kembalikan ke target koordinat algoritma
            const target = geometry.targets.get(node.id);
            const returnX = target?.x ?? draggedNodeOriginalPos?.x ?? node.x ?? 0;
            const returnY = target?.y ?? draggedNodeOriginalPos?.y ?? node.y ?? 0;

            node.x = returnX;
            node.y = returnY;
            node.fx = returnX;
            node.fy = returnY;
          }
        } else {
          // MODE CUSTOM: Kunci posisi baru node di tempat user melepaskannya
          node.fx = node.x;
          node.fy = node.y;
          if (node.x !== undefined && node.y !== undefined) {
            customPositions.current.set(node.id, { x: node.x, y: node.y });
          }
        }
      }

      // Reset state drag
      dragRef.current = {
        draggedNodeId: null,
        draggedNodeOriginalPos: null,
        hoveredTargetId: null,
        isValidDrop: false,
        dropReason: undefined,
      };

      // Segarkan tampilan kanvas
      graphRef.current?.refresh?.();
    },
    [layoutMode, layoutArrangement, geometry.targets, onNodeMove]
  );

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => { },
      smartZoom: (action) => {
        const graph = graphRef.current;
        if (!graph) return;

        // 1. Zoom to fit: sesuaikan viewport agar mencakup seluruh node yang terlihat
        if (action === 'fit') {
          graph.zoomToFit?.(500, 60);
          return;
        }

        // 2. Zoom to selection: fokus dan perbesar ke node yang sedang dipilih
        if (action === 'selection') {
          const targetId = selectedNode?.id;
          const selected = data.nodes.find((node) => node.id === targetId);
          if (!selected || selected.x === undefined || selected.y === undefined) return;

          graph.centerAt?.(selected.x, selected.y, 450);
          graph.zoom?.(2.25, 450);
          return;
        }

        // 3. Fallback / reset: kembali ke titik pusat default
        graph.centerAt?.(0, 0, 400);
        graph.zoom?.(1, 400);
      },
    }),
    [data.nodes, selectedNode?.id]
  );

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
        autoPauseRedraw={!particlesActive && !glowAnimated && !cosmicActive}
        nodeRelSize={graphConfig.nodes.relSize}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}
        onRenderFramePre={renderDecorations}
        onRenderFramePost={updateToolbarPosition}
        onZoom={updateToolbarPosition}
        onZoomEnd={updateToolbarPosition}
        onNodeClick={handleClick}
        onNodeRightClick={handleNodeRightClick}
        onNodeHover={handleHover}
        onBackgroundClick={() => {
          setSelected(null);
          onNodeSelect(null);
          setIsToolbarVisible(false);
        }}
        onBackgroundRightClick={() => {
          setIsToolbarVisible(false);
        }}
        enableNodeDrag={true}
        enablePanInteraction={true}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        dagMode={layoutMode === 'free-force' && graphConfig.forces.dagMode !== 'null' ? graphConfig.forces.dagMode : null}
        dagLevelDistance={graphConfig.forces.dagLevelDistance}
        warmupTicks={layoutMode === 'free-force' ? graphConfig.forces.warmupTicks : 0}
        cooldownTicks={layoutMode === 'free-force' ? graphConfig.forces.cooldownTicks : 0}
        cooldownTime={layoutMode === 'free-force' ? graphConfig.forces.cooldownTime : 0}
        d3AlphaDecay={graphConfig.forces.alphaDecay}
        d3VelocityDecay={graphConfig.forces.velocityDecay}
      />

      <GraphBottomOverlays
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
      />

      {/* Tampilkan Toolbar saat isToolbarVisible aktif (baik di mode Mindmap maupun Graph) */}
      {isToolbarVisible && selectedNode && toolbarCoords && (
        <ContextualToolbar
          x={toolbarCoords.x}
          y={toolbarCoords.y}
          nodeId={selectedNode.id}
          nodeName={selectedNode.name}
          isFolder={selectedNode.type === 'folder'}
          canvasMode={canvasMode}
          currentOverride={subtreeLayoutOverrides?.[selectedNode.id]}
          isFocused={focusedRootId === selectedNode.id}
          onSetStructure={(mode) => setSubtreeLayoutOverride(selectedNode.id, mode)}
          onAddSub={(type) => onAddSubNode?.(selectedNode.id, type)}
          onToggleFocus={() =>
            setFocusedRoot(focusedRootId === selectedNode.id ? null : selectedNode.id)
          }
          onDelete={() => {
            onNodeDelete?.(selectedNode.id);
            setIsToolbarVisible(false);
          }}
          onClose={() => setIsToolbarVisible(false)}
        />
      )}
    </div>
  );
});
