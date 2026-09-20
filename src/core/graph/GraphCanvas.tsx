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
import { GraphMiniMap } from './GraphMiniMap';
import { buildGraphProjection } from './model/buildGraphProjection';
import type { NodeMetric, RenderNode, RenderLink } from './model/graphTypes';
import { useGraphInteractionStore } from './model/useGraphInteractionStore';
import { useLayoutEngine } from './layout/useLayoutEngine';
import {
  LayoutTransitionController,
  prefersReducedMotion,
} from './layout/transitionController';
import { hiddenByCollapse, pathwayOf, subtreeOf } from './interactions/graphTraversal';
import { drawNode, paintNodePointerArea } from './render/drawNode';
import { drawLink } from './render/drawLink';
import { drawDecorations } from './render/drawDecorations';
import { buildTheme } from './render/theme';
import { cardLayout } from './render/textLayout';

export interface GraphCanvasProps {
  graphData: { nodes: Node[]; links: Link[] };
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  graphConfig: GraphConfigState;
  search: string;
  maxDepth: number;
  contentFilter: string;
  tagFilter: string;
}

export interface GraphCanvasHandle {
  smartZoom: (action: 'fit' | 'selection' | 'reset') => void;
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
  graphConfig,
  search,
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
  const [size, setSize] = useState({ width: 800, height: 600 });

  const engine = useGraphEngineStore();
  const {
    layoutMode,
    orientation,
    highlightMode,
    collapsedIds,
    hoveredId,
    focusedRootId,
    toggleCollapsed,
    setHovered,
    setSelected,
    setTransitionStatus,
    simulationCommand,
  } = useGraphInteractionStore();

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
  const projection = useMemo(
    () => buildGraphProjection(graphData.nodes, graphData.links, { timeField: engine.timeField }),
    [graphData.nodes, graphData.links, engine.timeField]
  );

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
        if (node.depth > maxDepth) return false;
        if (term && !node.name.toLowerCase().includes(term)) return false;
        if (content && !node.content.toLowerCase().includes(content)) return false;
        if (tag && !node.tags.some((item) => item.toLowerCase().replace(/^#/, '') === tag))
          return false;
        return true;
      })
      .map((node) => node.id);
  }, [projection, collapsedIds, focusedRootId, search, contentFilter, tagFilter, maxDepth]);

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
  });

  // ---- data handed to ForceGraph2D (stable object identities) --------------
  const data = useMemo(() => {
    const visible = new Set(visibleIds);
    const nodes = projection.nodes.filter((node) => visible.has(node.id));
    const links = projection.links.filter((link) => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      return visible.has(source) && visible.has(target) && topologyEnabled(link.type, graphConfig);
    });
    return { nodes, links };
  }, [projection, visibleIds, graphConfig]);

  // ---- layout transitions --------------------------------------------------
  useEffect(() => {
    const controller = transition.current;
    if (layoutMode === 'free-force') {
      controller.release(data.nodes);
      graphRef.current?.d3ReheatSimulation?.();
      setTransitionStatus('idle');
      return;
    }
    setTransitionStatus('animating');
    controller.run(data.nodes, geometry.targets, {
      reducedMotion: prefersReducedMotion(),
      onTick: () => graphRef.current?.refresh?.(),
      onDone: () => setTransitionStatus('idle'),
    });
    return () => controller.cancel();
  }, [geometry, data.nodes, layoutMode, setTransitionStatus]);

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

  const particlesActive = graphConfig.links.showParticles && graphConfig.links.particles > 0;

  // ---- highlight sets ------------------------------------------------------
  const pathway = useMemo(
    () => (highlightMode === 'pathway' ? pathwayOf(projection, hoveredId) : new Set<string>()),
    [projection, hoveredId, highlightMode]
  );

  const theme = useMemo(() => buildTheme(graphConfig), [graphConfig]);
  const metricOf = useCallback(
    (node: RenderNode) => metrics.get(node.id) ?? { width: 90, height: 28 },
    [metrics]
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
        config: graphConfig.nodes,
      });
    },
    [theme, selectedNode, hoveredId, pathway, collapsedIds, engine.showLabels, engine.labelZoomThreshold, graphConfig.nodes]
  );

  const paintPointer = useCallback(
    (node: RenderNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintNodePointerArea(ctx, node, color, node.parentId === null, graphConfig.nodes);
    },
    [graphConfig.nodes]
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
      drawLink(ctx, source, target, {
        mode: layoutMode,
        theme,
        color: usesDefaultTypeColor ? theme.link : style.color,
        width: Math.max(0.25, style.width * widthScale),
        opacity: Math.min(1, style.opacity * opacityScale),
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
        particleColor: graphConfig.links.particleColor,
        particleProgress: particleProgress.current,
        metricOf,
      });
    },
    [graphConfig, layoutMode, theme, pathway, metricOf]
  );

  const renderDecorations = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      // This callback runs inside ForceGraph's own frame cycle, after it clears
      // the complete backing canvas and before links/nodes are painted.
      if (particlesActive) {
        particleProgress.current =
          ((performance.now() - particleStartedAt.current) * graphConfig.links.particleSpeed) / 100;
      }
      if (layoutMode === 'fishbone' && !graphConfig.topology.showHierarchy) return;
      const hierarchy = graphConfig.topology.styles.hierarchy;
      drawDecorations(ctx, geometry.decorations, theme, globalScale, {
        color: hierarchy.color || theme.link,
        opacity: hierarchy.opacity,
        width: hierarchy.width,
        dash: dashFor(hierarchy.lineStyle, hierarchy.width),
      });
    },
    [
      geometry.decorations,
      theme,
      layoutMode,
      particlesActive,
      graphConfig.links.particleSpeed,
      graphConfig.topology.showHierarchy,
      graphConfig.topology.styles.hierarchy,
    ]
  );

  // ---- interactions --------------------------------------------------------
  const handleClick = useCallback(
    (node: RenderNode, event: MouseEvent) => {
      // Toggle hit test in graph space.
      const coords = graphRef.current?.screen2GraphCoords?.(event.offsetX, event.offsetY);
      const toggle = node.toggle;
      if (coords && toggle) {
        const distance = Math.hypot(coords.x - toggle.x, coords.y - toggle.y);
        if (distance <= toggle.r) {
          toggleCollapsed(node.id);
          return;
        }
      }
      setSelected(node.id);
      onNodeSelect(graphData.nodes.find((item) => item.id === node.id) ?? null);
    },
    [toggleCollapsed, setSelected, onNodeSelect, graphData.nodes]
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

  useImperativeHandle(ref, () => ({
    smartZoom: (action) => {
      const graph = graphRef.current;
      if (!graph) return;
      if (action === 'fit') {
        graph.zoomToFit?.(500, 60);
        return;
      }
      if (action === 'selection') {
        const selected = data.nodes.find((node) => node.id === selectedNode?.id);
        if (!selected || selected.x === undefined || selected.y === undefined) return;
        graph.centerAt?.(selected.x, selected.y, 450);
        graph.zoom?.(2.25, 450);
        return;
      }
      graph.centerAt?.(0, 0, 400);
      graph.zoom?.(1, 400);
    },
  }), [data.nodes, selectedNode?.id]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={size.width}
        height={size.height}
        backgroundColor={theme.card}
        autoPauseRedraw={!particlesActive}
        nodeRelSize={graphConfig.nodes.relSize}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}
        onRenderFramePre={renderDecorations}
        onNodeClick={handleClick}
        onNodeHover={handleHover}
        onBackgroundClick={() => {
          setSelected(null);
          onNodeSelect(null);
        }}
        enableNodeDrag={layoutMode === 'free-force'}
        dagMode={layoutMode === 'free-force' && graphConfig.forces.dagMode !== 'null' ? graphConfig.forces.dagMode : null}
        dagLevelDistance={graphConfig.forces.dagLevelDistance}
        warmupTicks={layoutMode === 'free-force' ? graphConfig.forces.warmupTicks : 0}
        cooldownTicks={layoutMode === 'free-force' ? graphConfig.forces.cooldownTicks : 0}
        cooldownTime={layoutMode === 'free-force' ? graphConfig.forces.cooldownTime : 0}
        d3AlphaDecay={graphConfig.forces.alphaDecay}
        d3VelocityDecay={graphConfig.forces.velocityDecay}
      />

      <GraphMiniMap
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
    </div>
  );
});

export default GraphCanvas;
