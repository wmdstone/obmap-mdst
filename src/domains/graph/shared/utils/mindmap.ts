/**
 * Deterministic balanced / radial mindmap layout.
 * Inspired by XMind layout engine: strict non-overlapping branches,
 * card-metric aware vertical distribution, and balanced left/right branching.
 */

import { subtreeWeights } from '../model/buildGraphProjection';
import type { LayoutContext, LayoutGeometry, NodeTarget } from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface MindmapInput {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  context: LayoutContext;
}

export function mindmapLayout({ ids, roots, childrenOf, context }: MindmapInput): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  if (ids.length === 0) {
    return { mode: 'mindmap', targets, bounds: boundsOf(targets), decorations: [] };
  }

  const visible = new Set(ids);
  const children = (id: string) => childrenOf(id).filter((child) => visible.has(child));
  const visibleRoots = roots.filter((id) => visible.has(id));
  const weights = subtreeWeights(visibleRoots, children);

  const metric = (id: string) =>
    context.nodeMetrics.get(id) ?? { width: 140, height: 38 };

  if (context.orientation === 'radial') {
    layoutRadial(visibleRoots, children, weights, context, targets);
  } else {
    layoutBalanced(visibleRoots, children, weights, context, targets, metric);
  }

  return {
    mode: 'mindmap',
    targets,
    bounds: boundsOf(targets, context.nodeMetrics),
    decorations: [],
  };
}

function layoutBalanced(
  roots: string[],
  children: (id: string) => string[],
  weights: Map<string, number>,
  context: LayoutContext,
  targets: Map<string, NodeTarget>,
  metric: (id: string) => { width: number; height: number }
) {
  // Sibling gap & level gap aman untuk mencegah overlap teks atau link
  const siblingGap = Math.max(context.siblingGap, 28);
  const levelGap = Math.max(context.levelGap, 56);

  /**
   * Vertical span of a subtree, honoring real card heights and intra-sibling gaps.
   */
  const spanCache = new Map<string, number>();
  const guard = new Set<string>();

  const spanOf = (id: string): number => {
    const cached = spanCache.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return metric(id).height + siblingGap;
    guard.add(id);

    const own = metric(id).height + siblingGap;
    const kids = children(id);
    if (kids.length === 0) {
      spanCache.set(id, own);
      return own;
    }

    const totalKidsSpan = kids.reduce((sum, kid) => sum + spanOf(kid), 0);
    const span = Math.max(own, totalKidsSpan);
    spanCache.set(id, span);
    return span;
  };

  /**
   * Places a recursive branch either to the left (-1) or to the right (+1)
   */
  const placeBranch = (
    id: string,
    side: -1 | 1,
    parentX: number,
    parentWidth: number,
    top: number
  ) => {
    const span = spanOf(id);
    const ownMetric = metric(id);
    const centerY = top + span / 2;

    // Jarak horizontal dihitung dari tepi card parent ke tepi card child + levelGap
    const x = parentX + side * (parentWidth / 2 + levelGap + ownMetric.width / 2);
    targets.set(id, { x, y: centerY, side });

    let cursor = top;
    const kids = children(id);
    for (const kid of kids) {
      placeBranch(kid, side, x, ownMetric.width, cursor);
      cursor += spanOf(kid);
    }

    if (kids.length > 0) {
      // Re-center parent vertikal agar tepat di tengah antara child pertama dan child terakhir
      const first = targets.get(kids[0])!;
      const last = targets.get(kids[kids.length - 1])!;
      targets.set(id, { x, y: (first.y + last.y) / 2, side });
    }
  };

  let rootOffsetY = 0;
  for (const root of roots) {
    const rootMetric = metric(root);
    targets.set(root, { x: 0, y: rootOffsetY, side: 0 });
    const kids = children(root);

    // Keseimbangan greedy kiri/kanan berdasarkan bobot subtree
    let leftWeight = 0;
    let rightWeight = 0;
    const left: string[] = [];
    const right: string[] = [];

    for (const kid of kids) {
      const weight = weights.get(kid) ?? 1;
      if (rightWeight <= leftWeight) {
        right.push(kid);
        rightWeight += weight;
      } else {
        left.push(kid);
        leftWeight += weight;
      }
    }

    // Tempatkan cabang kanan (side = 1) dan cabang kiri (side = -1)
    for (const [side, group] of [
      [1, right],
      [-1, left],
    ] as const) {
      const totalSpan = group.reduce((sum, id) => sum + spanOf(id), 0);
      let cursor = rootOffsetY - totalSpan / 2;

      for (const id of group) {
        placeBranch(id, side, 0, rootMetric.width, cursor);
        cursor += spanOf(id);
      }
    }

    const rightTotal = right.reduce((sum, id) => sum + spanOf(id), 0);
    const leftTotal = left.reduce((sum, id) => sum + spanOf(id), 0);
    const rootSpan = Math.max(spanOf(root), rightTotal, leftTotal);

    rootOffsetY += rootSpan + siblingGap * 2;
  }
}

function layoutRadial(
  roots: string[],
  children: (id: string) => string[],
  weights: Map<string, number>,
  context: LayoutContext,
  targets: Map<string, NodeTarget>
) {
  const radius = Math.max(80, context.levelGap);
  roots.forEach((root, rootIndex) => {
    const cx = rootIndex * radius * 8;
    targets.set(root, { x: cx, y: 0, angle: 0, side: 0 });

    const place = (id: string, from: number, to: number, depth: number) => {
      const angle = (from + to) / 2;
      const r = depth * radius;
      const side = Math.cos(angle) >= 0 ? 1 : -1;
      targets.set(id, {
        x: cx + r * Math.cos(angle),
        y: r * Math.sin(angle),
        angle,
        side,
      });

      const kids = children(id);
      if (!kids.length) return;

      const total = kids.reduce((sum, kid) => sum + (weights.get(kid) ?? 1), 0) || 1;
      let cursor = from;
      for (const kid of kids) {
        const slice = ((to - from) * (weights.get(kid) ?? 1)) / total;
        place(kid, cursor, cursor + slice, depth + 1);
        cursor += slice;
      }
    };

    const kids = children(root);
    const total = kids.reduce((sum, kid) => sum + (weights.get(kid) ?? 1), 0) || 1;
    let cursor = -Math.PI;
    for (const kid of kids) {
      const slice = (2 * Math.PI * (weights.get(kid) ?? 1)) / total;
      place(kid, cursor, cursor + slice, 1);
      cursor += slice;
    }
  });
}