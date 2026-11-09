/** Ishikawa (fishbone) layout: spine, alternating major ribs and sub-branches. */

import { subtreeWeights } from '../model/buildGraphProjection';
import type {
  FishboneRib,
  FishboneSpine,
  LayoutContext,
  LayoutDecoration,
  LayoutGeometry,
  NodeTarget,
} from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface FishboneInput {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  context: LayoutContext;
}

export function fishboneLayout({ ids, roots, childrenOf, context }: FishboneInput): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  const decorations: LayoutDecoration[] = [];
  if (!ids.length) {
    return { mode: 'fishbone', targets, bounds: boundsOf(targets), decorations };
  }

  const visible = new Set(ids);
  const children = (id: string) => childrenOf(id).filter((child) => visible.has(child));
  const visibleRoots = roots.filter((id) => visible.has(id));
  const weights = subtreeWeights(visibleRoots, children);

  const effect = context.rootId && visible.has(context.rootId) ? context.rootId : visibleRoots[0];
  const categories = effect
    ? [...children(effect), ...visibleRoots.filter((id) => id !== effect)]
    : visibleRoots;

  const alpha = context.ribAngle;
  const y0 = 0;
  const x0 = 0;
  const maxCardWidth = ids.reduce(
    (width, id) => Math.max(width, context.nodeMetrics.get(id)?.width ?? 120),
    120
  );
  const L = Math.max(700, context.width * 1.25, categories.length * (maxCardWidth + context.siblingGap * 3));
  const x1 = x0 + L;

  const effectWidth = effect ? context.nodeMetrics.get(effect)?.width ?? 120 : 0;
  if (effect) targets.set(effect, { x: x1 + effectWidth / 2, y: y0, side: 0 });
  decorations.push({
    kind: 'fishbone-spine',
    x1: x0,
    y1: y0,
    x2: x1,
    y2: y0,
    targetId: effect,
  } as FishboneSpine);

  const count = Math.max(1, categories.length);
  categories.forEach((categoryId, index) => {
    const anchorX = x0 + ((index + 1) * L) / (count + 1);
    const sign: 1 | -1 = index % 2 === 0 ? -1 : 1;
    const categoryMetric = context.nodeMetrics.get(categoryId) ?? { width: 120, height: 36 };
    const ribLength = Math.max(
      context.levelGap * 2.5,
      categoryMetric.width + context.levelGap + Math.sqrt(weights.get(categoryId) ?? 1) * context.siblingGap * 2
    );
    const cx = anchorX - ribLength * Math.cos(alpha);
    const cy = y0 + sign * ribLength * Math.sin(alpha);
    targets.set(categoryId, { x: cx, y: cy, side: sign });
    decorations.push({
      kind: 'fishbone-rib',
      x1: anchorX,
      y1: y0,
      x2: cx,
      y2: cy,
      major: true,
      sourceId: effect,
      targetId: categoryId,
    } as FishboneRib);

    const kids = children(categoryId);
    const m = kids.length;
    kids.forEach((kid, k) => {
      // Keep attachments away from the category card at the rib tip.
      const t = 0.18 + (k * 0.62) / Math.max(1, m - 1);
      const baseX = anchorX - t * ribLength * Math.cos(alpha);
      const baseY = y0 + sign * t * ribLength * Math.sin(alpha);
      placeSubBranch(kid, baseX, baseY, sign, 1, k);
      const target = targets.get(kid);
      if (!target) return;
      decorations.push({
        kind: 'fishbone-rib',
        x1: baseX,
        y1: baseY,
        x2: target.x,
        y2: target.y,
        major: false,
        sourceId: categoryId,
        targetId: kid,
      } as FishboneRib);
    });
  });

  function placeSubBranch(
    id: string,
    baseX: number,
    baseY: number,
    sign: 1 | -1,
    depth: number,
    siblingIndex: number
  ) {
    // A true perpendicular to the rib tangent (-cos(a), sign*sin(a)),
    // pointing away from the spine on both sides.
    const outwardX = Math.sin(alpha);
    const outwardY = sign * Math.cos(alpha);
    const tangentX = -Math.cos(alpha);
    const tangentY = sign * Math.sin(alpha);
    const metric = context.nodeMetrics.get(id) ?? { width: 120, height: 36 };
    const offset = context.levelGap * 0.85 + metric.height / 2 + depth * context.siblingGap * 0.45;
    const siblingOffset = siblingIndex * (metric.width + context.siblingGap) * 0.55;
    const x = baseX + offset * outwardX + siblingOffset * tangentX;
    const y = baseY + offset * outwardY + siblingOffset * tangentY;
    targets.set(id, { x, y, side: sign });
    const kids = children(id);
    kids.forEach((kid, index) => {
      const parentMetric = context.nodeMetrics.get(id) ?? { width: 120, height: 36 };
      const childMetric = context.nodeMetrics.get(kid) ?? { width: 120, height: 36 };
      const branchStep = parentMetric.height / 2 + childMetric.height / 2 + context.siblingGap;
      const childBaseX = x + branchStep * outwardX + index * context.siblingGap * tangentX;
      const childBaseY = y + branchStep * outwardY + index * context.siblingGap * tangentY;
      placeSubBranch(
        kid,
        childBaseX,
        childBaseY,
        sign,
        depth + 1,
        index
      );
      const childTarget = targets.get(kid);
      if (!childTarget) return;
      decorations.push({
        kind: 'fishbone-rib',
        x1: x,
        y1: y,
        x2: childTarget.x,
        y2: childTarget.y,
        major: false,
        sourceId: id,
        targetId: kid,
      } as FishboneRib);
    });
  }

  // Any node not reached above (detached branches) lands under the spine.
  let stray = 0;
  for (const id of ids) {
    if (targets.has(id)) continue;
    targets.set(id, {
      x: x0 + (stray % 6) * context.siblingGap * 4,
      y: y0 + context.levelGap * (3 + Math.floor(stray / 6)),
    });
    stray += 1;
  }

  return { mode: 'fishbone', targets, bounds: boundsOf(targets, context.nodeMetrics), decorations };
}
