/**
 * Render/layout contracts for the unified graph engine.
 *
 * The engine never owns graph content: it projects vault nodes/links into a
 * render model and computes deterministic coordinates for it.
 */

import type { Link, Node } from '@/shared/stores/types';

export type GraphLayoutMode = 'free-force' | 'fr-standard' | 'fr-radial' | 'kamada-kawai' | 'grid';
export type MindmapLayoutMode = 'mindmap' | 'org-chart' | 'brace-map' | 'timeline' | 'fishbone';
export type LayoutMode = GraphLayoutMode | MindmapLayoutMode;
/** Which family of layouts a graph tab shows: network topology or folder hierarchy. */
export type CanvasMode = 'graph' | 'mindmap';

export const GRAPH_LAYOUT_MODES: GraphLayoutMode[] = ['free-force', 'fr-standard', 'fr-radial', 'kamada-kawai', 'grid'];
export const MINDMAP_LAYOUT_MODES: MindmapLayoutMode[] = ['mindmap', 'org-chart', 'brace-map', 'timeline', 'fishbone'];

export type SubtreeLayoutMap = Record<string, MindmapLayoutMode>;
export type BranchColorMap = Record<string, string>;

export const canvasModeOf = (mode: LayoutMode): CanvasMode =>
  (GRAPH_LAYOUT_MODES as string[]).includes(mode) ? 'graph' : 'mindmap';
export type MindmapOrientation = 'balanced' | 'radial';
export type TimelineStructure = 'horizontal' | 'vertical' | 'off-axis';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface NodeTarget extends LayoutPoint {
  side?: -1 | 0 | 1;
  angle?: number;
  lane?: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TimelineAxis {
  kind: 'timeline-axis';
  direction?: 'horizontal' | 'vertical';
  x1: number;
  y1?: number;
  x2: number;
  y2?: number;
  y: number; // Tetap sertakan untuk backward compatibility jika ada fungsi lain yang membaca .y
  ticks: { x: number; y?: number; label: string; nodeId?: string }[];
}

export interface FishboneSpine {
  kind: 'fishbone-spine';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Effect (root) node the spine belongs to, for hierarchy colouring. */
  targetId?: string;
}

export interface FishboneRib {
  kind: 'fishbone-rib';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
  /** Parent/child ids of the relation this rib draws, for hierarchy colouring. */
  sourceId?: string;
  targetId?: string;
}

export type LayoutDecoration = TimelineAxis | FishboneSpine | FishboneRib;

export interface LayoutGeometry {
  mode: LayoutMode;
  targets: Map<string, NodeTarget>;
  bounds: Bounds;
  decorations: LayoutDecoration[];
}

export interface NodeMetric {
  width: number;
  height: number;
}

export interface LayoutContext {
  width: number;
  height: number;
  rootId?: string;
  orientation: MindmapOrientation;
  timelineStructure?: TimelineStructure;
  levelGap: number;
  siblingGap: number;
  laneGap: number;
  ribAngle: number;
  nodeMetrics: Map<string, NodeMetric>;
}

/** Mutable object handed to ForceGraph2D — it writes x/y/fx/fy in place. */
export interface RenderNode {
  id: string;
  name: string;
  type: Node['type'];
  parentId: string | null;
  depth: number;
  tags: string[];
  content: string;
  time?: number;
  category?: string;
  childCount: number;
  branchId?: string;
  branchColor?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  /** Toggle hit region in graph space, written by the node renderer. */
  toggle?: { x: number; y: number; r: number } | null;
}

export interface RenderLink {
  source: string | RenderNode;
  target: string | RenderNode;
  type?: Link['type'];
  role?: 'hierarchy' | 'milestone' | 'rib';
}

export interface GraphProjection {
  nodes: RenderNode[];
  links: RenderLink[];
  byId: Map<string, RenderNode>;
  childrenByParent: Map<string, string[]>;
  parentByChild: Map<string, string | null>;
  roots: string[];
}

export const emptyBounds = (): Bounds => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
