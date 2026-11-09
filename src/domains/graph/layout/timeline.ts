/**
 * Timeline Layout Engine (XMind-inspired)
 * Features:
 * - Central chronological baseline axis (y = 0)
 * - Dynamic bottom-up recursive measurement to eliminate deep-tree overlaps (up to Level 15+)
 * - Dual independent cursors for top and bottom lanes
 * - Strictly partitioned vertical slots for recursive horizontal branches
 * - Monotonic progression and baseline clearance guarantee
 */

import type { LayoutContext, LayoutGeometry, NodeTarget } from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface TimelineInput {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  parentOf?: (id: string) => string | null;
  context: LayoutContext;
}

interface SubtreeBox {
  spanY: number;      // Total vertical span required by this node and its descendants
  spanX: number;      // Total horizontal span from this node to rightmost leaf
  ownWidth: number;
  ownHeight: number;
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
  const baselineY = 0;

  // Ukuran fallback yang memperhitungkan padding & collapse badge
  const metric = (id: string) => {
    const m = context.nodeMetrics?.get(id);
    const hasChildren = childrenOf(id).some((c) => visible.has(c));
    const extraWidth = hasChildren ? 26 : 0;
    return {
      width: (m?.width ?? 140) + extraWidth,
      height: Math.max(m?.height ?? 34, 32),
    };
  };

  const laneGap = Math.max(context.laneGap ?? 110, 80);
  const siblingGapY = Math.max(context.siblingGap ?? 16, 12);
  const levelGapX = Math.max(context.levelGap ?? 64, 48);
  const minBaselineClearance = 45;

  // 1. Identifikasi Root Utama
  const visibleRoots = roots.filter((r) => visible.has(r));
  const primaryRoot = visibleRoots[0] ?? ids[0];
  const rootMetric = metric(primaryRoot);

  targets.set(primaryRoot, {
    x: 0,
    y: baselineY,
    side: 0,
    lane: 0,
  });

  // 2. Daftar Milestone (anak langsung dari root)
  const rootChildren = childrenOf(primaryRoot).filter((id) => visible.has(id));
  const milestones = rootChildren.length > 0
    ? rootChildren
    : visibleRoots.filter((r) => r !== primaryRoot);

  // 3. Bottom-Up Recursive Measurement Cache (Menjamin ruang subtree hingga Level 15+)
  const boxCache = new Map<string, SubtreeBox>();

  function measureBox(nodeId: string): SubtreeBox {
    if (boxCache.has(nodeId)) return boxCache.get(nodeId)!;

    const m = metric(nodeId);
    const kids = childrenOf(nodeId).filter((id) => visible.has(id));

    if (kids.length === 0) {
      const leafBox: SubtreeBox = {
        spanY: m.height,
        spanX: m.width,
        ownWidth: m.width,
        ownHeight: m.height,
      };
      boxCache.set(nodeId, leafBox);
      return leafBox;
    }

    let kidsSpanY = 0;
    let maxKidSpanX = 0;

    for (let i = 0; i < kids.length; i++) {
      const kidBox = measureBox(kids[i]);
      kidsSpanY += kidBox.spanY + (i > 0 ? siblingGapY : 0);
      maxKidSpanX = Math.max(maxKidSpanX, kidBox.spanX);
    }

    const box: SubtreeBox = {
      spanY: Math.max(m.height, kidsSpanY),
      spanX: m.width + levelGapX + maxKidSpanX,
      ownWidth: m.width,
      ownHeight: m.height,
    };

    boxCache.set(nodeId, box);
    return box;
  }

  // Pre-measure seluruh node aktif
  for (const id of ids) {
    measureBox(id);
  }

  // 4. Recursive Subtree Placement untuk Level 3 hingga Level 15+
  // Setiap anak ditempatkan dalam slot vertikal terisolasi sehingga tidak ada tabrakan
  function placeHorizontalSubtree(
    parentId: string,
    parentX: number,
    parentSlotY: number,
    parentSlotHeight: number,
    lane: -1 | 1
  ): void {
    const kids = childrenOf(parentId).filter((c) => visible.has(c));
    if (kids.length === 0) return;

    const parentMetric = metric(parentId);
    const branchX = parentX + parentMetric.width / 2 + levelGapX;

    const kidsBoxes = kids.map((k) => measureBox(k));
    const totalKidsSpanY = kidsBoxes.reduce(
      (sum, b, idx) => sum + b.spanY + (idx > 0 ? siblingGapY : 0),
      0
    );

    // Pusatkan anak di dalam slot vertikal milik parent
    let cursorY = parentSlotY + Math.max(0, (parentSlotHeight - totalKidsSpanY) / 2);

    for (let i = 0; i < kids.length; i++) {
      const kidId = kids[i];
      const kidBox = kidsBoxes[i];
      const kidMetric = metric(kidId);

      const kidSlotY = cursorY;
      const kidSlotHeight = kidBox.spanY;

      // Titik tengah node anak
      const kidY = kidSlotY + kidSlotHeight / 2;
      const kidActualX = branchX + kidMetric.width / 2;

      targets.set(kidId, {
        x: kidActualX,
        y: kidY,
        side: lane,
        lane,
      });

      // Rekursif ke kedalaman berikutnya (Level 4, Level 5, ..., Level 15)
      placeHorizontalSubtree(kidId, kidActualX, kidSlotY, kidSlotHeight, lane);

      cursorY += kidBox.spanY + siblingGapY;
    }
  }

  // 5. Penempatan Pohon Milestone (Milestone + Tiang Level 2 + Cabang Level 3..15+)
  function placeMilestoneTree(
    mId: string,
    mX: number,
    lane: -1 | 1
  ): { maxX: number } {
    const mMetric = metric(mId);
    const mY = baselineY + lane * laneGap;

    targets.set(mId, {
      x: mX,
      y: mY,
      side: lane,
      lane,
    });

    const l2Kids = childrenOf(mId).filter((c) => visible.has(c));
    if (l2Kids.length === 0) {
      return { maxX: mX + mMetric.width / 2 };
    }

    const l2Boxes = l2Kids.map((k) => measureBox(k));
    const trunkX = mX + 36; // Indentasi teratur untuk tiang vertikal

    // Level 2 disusun vertikal menjauhi sumbu tengah:
    // Lane -1 (Atas): menjauhi sumbu ke arah -Y
    // Lane +1 (Bawah): menjauhi sumbu ke arah +Y
    let currentY: number;
    if (lane === -1) {
      const safeFirstSlotY = -minBaselineClearance - l2Boxes[0].spanY;
      currentY = Math.min(mY - 30 - l2Boxes[0].spanY, safeFirstSlotY);
    } else {
      currentY = Math.max(mY + 30, minBaselineClearance);
    }

    for (let i = 0; i < l2Kids.length; i++) {
      const kidId = l2Kids[i];
      const kidBox = l2Boxes[i];

      const slotY = currentY;
      const slotHeight = kidBox.spanY;
      const kidY = slotY + slotHeight / 2;

      targets.set(kidId, {
        x: trunkX,
        y: kidY,
        side: lane,
        lane,
      });

      // Cabang horizontal Level 3+ tumbuh ke kanan
      placeHorizontalSubtree(kidId, trunkX, slotY, slotHeight, lane);

      // Langkah Y untuk sibling Level 2 berikutnya
      if (lane === -1) {
        if (i < l2Kids.length - 1) {
          const nextBox = l2Boxes[i + 1];
          currentY -= (nextBox.spanY + siblingGapY);
        }
      } else {
        currentY += slotHeight + siblingGapY;
      }
    }

    // Hitung jangkauan maksimum X yang ditempati seluruh turunan milestone ini
    let maxX = mX + mMetric.width / 2;
    function collectMaxX(nodeId: string) {
      const t = targets.get(nodeId);
      if (t) {
        maxX = Math.max(maxX, t.x + metric(nodeId).width / 2);
      }
      for (const c of childrenOf(nodeId).filter((k) => visible.has(k))) {
        collectMaxX(c);
      }
    }
    collectMaxX(mId);

    return { maxX };
  }

  // 6. Penempatan Milestone dengan Dual Cursors (Atas & Bawah)
  let cursorTopX = rootMetric.width / 2 + 80;
  let cursorBottomX = rootMetric.width / 2 + 80;
  let lastMilestoneX = 0;

  milestones.forEach((mId, index) => {
    // Alternasi Atas (-1) dan Bawah (+1)
    const lane: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const mMetric = metric(mId);

    const cursorLane = lane === -1 ? cursorTopX : cursorBottomX;
    const minStepFromLast = lastMilestoneX + Math.max(mMetric.width * 0.8, 80);
    const mX = Math.max(cursorLane, minStepFromLast);

    const { maxX } = placeMilestoneTree(mId, mX, lane);

    if (lane === -1) {
      cursorTopX = maxX + 60;
    } else {
      cursorBottomX = maxX + 60;
    }

    lastMilestoneX = mX;
  });

  // 7. Node yatim/tersisa ditaruh rapi di ujung kanan sumbu
  let orphanCursorX = Math.max(cursorTopX, cursorBottomX) + 80;
  for (const id of ids) {
    if (!targets.has(id)) {
      targets.set(id, { x: orphanCursorX, y: baselineY, side: 0, lane: 0 });
      orphanCursorX += metric(id).width + 60;
    }
  }

  return {
    mode: 'timeline',
    targets,
    bounds: boundsOf(targets, context.nodeMetrics),
    decorations: [],
  };
}
