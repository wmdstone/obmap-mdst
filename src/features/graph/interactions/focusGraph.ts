/** Camera helpers built on the ForceGraph2D public API. */

import type { Bounds, RenderNode } from '../model/graphTypes';

export interface ForceGraphHandle {
  centerAt?: (x: number, y: number, ms?: number) => void;
  zoom?: (scale: number, ms?: number) => void;
  zoomToFit?: (
    ms?: number,
    padding?: number,
    filter?: (node: RenderNode) => boolean
  ) => void;
}

/** Centre the camera on a node and settle at a comfortable zoom. */
export function zoomToNode(
  graph: ForceGraphHandle | null | undefined,
  node: Pick<RenderNode, 'x' | 'y'>,
  targetZoom = 1.6
) {
  if (!graph || node.x === undefined || node.y === undefined) return;
  graph.centerAt?.(node.x, node.y, 350);
  graph.zoom?.(targetZoom, 350);
}

/** Fit the camera to a set of ids (a focused subtree, for example). */
export function fitToIds(
  graph: ForceGraphHandle | null | undefined,
  ids: Set<string>,
  padding = 60
) {
  if (!graph) return;
  if (ids.size === 0) {
    graph.zoomToFit?.(450, padding);
    return;
  }
  graph.zoomToFit?.(450, padding, (node) => ids.has(node.id));
}

/** Zoom level that makes `bounds` fit inside the viewport. */
export function zoomForBounds(bounds: Bounds, width: number, height: number, padding = 60) {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY
  );
  return Math.max(0.05, Math.min(4, scale));
}
