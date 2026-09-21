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
import { GraphLevelLegend } from './GraphLevelLegend';
import { resolveHierarchyLinkPaint, uniqueDepths } from './model/hierarchyColors';
import { cardLayout } from './render/textLayout';

export interface GraphCanvasProps {
  graphData: { nodes: Node[]; links: Link[] };
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  graphConfig: GraphConfigState;
  search: string;
  minDepth: number;
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
        if (node.depth < minDepth || node.depth > maxDepth) return false;
        if (term && !node.name.toLowerCase().includes(term)) return false;
        if (content && !node.content.toLowerCase().includes(content)) return false;
        if (tag && !node.tags.some((item) => item.toLowerCase().replace(/^#/, '') === tag))
          return false;
        return true;
      })
      .map((node) => node.id);
  }, [projection, collapsedIds, focusedRootId, search, contentFilter, tagFilter, minDepth, maxDepth]);

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
      return visible.has(source) && visible.has(target) && topologyEnabled(link.type, graphConfig);
    });
    return { nodes, links };
  }, [projection, visibleIds, graphConfig, geometry.targets, layoutMode]);

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
      // This callback runs inside ForceGraph's own frame cycle, after it clears
      // the complete backing canvas and before links/nodes are painted.
      if (particlesActive) {
        particleProgress.current =
          ((performance.now() - particleStartedAt.current) * graphConfig.links.particleSpeed) / 100;
      }
      glowPhase.current = glowAnimated
        ? ((performance.now() - glowStartedAt.current) / 2400) * graphConfig.nodes.glowSpeed
        : 0.25;
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
        autoPauseRedraw={!particlesActive && !glowAnimated}
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

      <GraphLevelLegend depths={visibleDepths} hierarchy={graphConfig.hierarchy} />

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
