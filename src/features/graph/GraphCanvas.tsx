/**
 * GraphCanvas — the single graph renderer.
 *
 * Rendering, camera, hit testing and dragging are delegated to
 * react-force-graph-2d; all coordinates come from the deterministic layout
 * engine (`useLayoutEngine`) via the transition controller.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore - react-force-graph-2d ships no bundled types
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphConfigState } from '@/shared/stores/useGraphStore';
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

const dashFor = (style: string | undefined, width: number): number[] => {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [1, width * 2];
  return [];
};

export function GraphCanvas({
  graphData,
  selectedNode,
  onNodeSelect,
  graphConfig,
  search,
  maxDepth,
  contentFilter,
  tagFilter,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const transition = useRef(new LayoutTransitionController());
  const zoomRef = useRef(1);
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
      const layout = cardLayout(node.name, {
        root: node.parentId === null,
        badge: node.childCount > 0,
      });
      map.set(node.id, { width: layout.width, height: layout.height });
    }
    return map;
  }, [projection]);

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
      return visible.has(source) && visible.has(target);
    });
    return { nodes, links };
  }, [projection, visibleIds]);

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
      });
    },
    [theme, selectedNode, hoveredId, pathway, collapsedIds, engine.showLabels, engine.labelZoomThreshold, graphConfig.nodes.showLabels]
  );

  const paintPointer = useCallback(
    (node: RenderNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintNodePointerArea(ctx, node, color, node.parentId === null);
    },
    []
  );

  const paintLink = useCallback(
    (link: RenderLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as RenderNode;
      const target = link.target as RenderNode;
      if (typeof source !== 'object' || typeof target !== 'object') return;
      const style =
        graphConfig.topology.styles[
          (link.type ?? 'hierarchy') as keyof typeof graphConfig.topology.styles
        ] ?? graphConfig.topology.styles.hierarchy;
      drawLink(ctx, source, target, {
        mode: layoutMode,
        theme,
        color: style.color ? style.color : theme.link,
        width: style.width ?? graphConfig.links.width,
        opacity: style.opacity ?? graphConfig.links.opacity,
        dash: dashFor(style.lineStyle, style.width ?? 1),
        dimmed: pathway.size > 0 && !(pathway.has(source.id) && pathway.has(target.id)),
        showArrow: graphConfig.links.showArrows,
        arrowLength: graphConfig.links.arrowLength,
        metricOf,
      });
    },
    [graphConfig, layoutMode, theme, pathway, metricOf]
  );

  const renderDecorations = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawDecorations(ctx, geometry.decorations, theme, globalScale);
    },
    [geometry.decorations, theme]
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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={size.width}
        height={size.height}
        backgroundColor="transparent"
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
        cooldownTicks={layoutMode === 'free-force' ? 200 : 0}
        d3AlphaDecay={graphConfig.forces.alphaDecay}
        d3VelocityDecay={graphConfig.forces.velocityDecay}
      />

      <GraphMiniMap
        nodes={data.nodes as any}
        links={data.links as any}
        graphRef={graphRef}
        folderColor={theme.folder}
        fileColor={theme.file}
        linkColor={theme.link}
        selectedNodeId={selectedNode?.id ?? null}
      />
    </div>
  );
}

export default GraphCanvas;
