/**
 * Timeline layout inspired by XMind:
 * Organizes milestones sequentially along a horizontal chronological spine
 * based on folder & file tree hierarchy.
 * Milestones alternate above and below the spine, with sub-items branching orthogonally.
 */

import type { LayoutContext, LayoutGeometry, NodeTarget, TimelineAxis } from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface TimelineInput {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  parentOf?: (id: string) => string | null;
  context: LayoutContext;
}

export function timelineLayout({
  ids,
  roots,
  childrenOf,
  context,
}: TimelineInput): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  if (!ids.length) {
    return { mode: 'timeline', targets, bounds: boundsOf(targets), decorations: [] };
  }

  const visible = new Set(ids);
  const metric = (id: string) => context.nodeMetrics.get(id) ?? { width: 140, height: 38 };

  const baselineY = 0;
  const laneGap = Math.max(context.laneGap, 90);
  const subGapX = 140;
  const subGapY = 44;

  // 1. Identifikasi Main Root (Pangkal Timeline di ujung kiri)
  const visibleRoots = roots.filter((r) => visible.has(r));
  const primaryRoot = visibleRoots[0] ?? ids[0];
  const rootMetric = metric(primaryRoot);

  targets.set(primaryRoot, {
    x: 0,
    y: baselineY,
    side: 0,
    lane: 0,
  });

  // 2. Milestones = anak-anak langsung dari root (sesuai urutan file explorer)
  const rootChildren = childrenOf(primaryRoot).filter((id) => visible.has(id));
  const milestones = rootChildren.length > 0 
    ? rootChildren 
    : visibleRoots.filter((r) => r !== primaryRoot);

  let currentX = rootMetric.width / 2 + 100;

  // Rekursif untuk menempatkan sub-items bertingkat di kanan milestone
  const placeDescendants = (
    parentId: string,
    originX: number,
    baseY: number,
    lane: -1 | 1
  ): number => {
    const kids = childrenOf(parentId).filter((id) => visible.has(id));
    if (kids.length === 0) return 0;

    let localCursorY = baseY;
    for (const kid of kids) {
      targets.set(kid, {
        x: originX + subGapX,
        y: localCursorY,
        side: lane,
        lane,
      });

      const deeperOffset = placeDescendants(kid, originX + subGapX, localCursorY, lane);
      localCursorY += lane * (subGapY + deeperOffset);
    }
    return Math.abs(localCursorY - baseY);
  };

  milestones.forEach((milestoneId, index) => {
    // Selang-seling: genap di atas (lane = -1), ganjil di bawah (lane = 1)
    const lane: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const y = baselineY + lane * laneGap;

    targets.set(milestoneId, {
      x: currentX,
      y,
      side: lane,
      lane,
    });

    // Tempatkan anak-anak dari milestone
    placeDescendants(milestoneId, currentX, y, lane);

    // Hitung jarak ke milestone berikutnya agar cabang tidak bertabrakan
    const mMetric = metric(milestoneId);
    currentX += mMetric.width + context.siblingGap + 120;
  });

  // Pastikan node yatim/tersisa tetap memiliki koordinat aman
  for (const id of ids) {
    if (!targets.has(id)) {
      targets.set(id, { x: currentX, y: baselineY, side: 0, lane: 0 });
      currentX += 160;
    }
  }


  return {
    mode: 'timeline',
    targets,
    bounds: boundsOf(targets, context.nodeMetrics),
    decorations: [],
  };
}