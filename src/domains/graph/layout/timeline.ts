/**
 * Timeline Layout Engine (XMind Zen / 2024 Reference Architecture)
 * 
 * Fitur:
 * - Sumbu kronologis berirama dan simetris (anti-desert, anti-clumping).
 * - Partisi slot vertikal terisolasi rekursif (anti-collision untuk 20+ L3 node & puluhan anak).
 * - Penghitungan anchor visual presisi (garis menempel pas di bulatan/teks tanpa celah melayang).
 * - Multi-line paragraph wrapping untuk judul panjang hingga 50 kata.
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
  spanY: number;      // Total tinggi vertikal subtree
  spanX: number;      // Jangkauan horizontal dari node ini ke daun paling kanan
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

  const metric = (id: string) => {
    const m = context.nodeMetrics?.get(id);
    const hasChildren = childrenOf(id).some((c) => visible.has(c));
    const extra = hasChildren ? 18 : 0;
    return {
      width: Math.max(m?.width ?? 100, 40) + extra,
      height: Math.max(m?.height ?? 32, 28),
    };
  };

  const laneGap = Math.max(context.laneGap ?? 110, 80);
  const siblingGapY = Math.max(context.siblingGap ?? 18, 14);
  const levelGapX = Math.max(context.levelGap ?? 64, 48);
  const minBaselineClearance = 45;

  // 1. Root Utama
  const visibleRoots = roots.filter((r) => visible.has(r));
  const primaryRoot = visibleRoots[0] ?? ids[0];
  const rootMetric = metric(primaryRoot);

  targets.set(primaryRoot, {
    x: 0,
    y: baselineY,
    side: 0,
    lane: 0,
  });

  // 2. Daftar Milestone
  const rootChildren = childrenOf(primaryRoot).filter((id) => visible.has(id));
  const milestones = rootChildren.length > 0
    ? rootChildren
    : visibleRoots.filter((r) => r !== primaryRoot);

  // 3. Bottom-Up Recursive Bounding Box Cache
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

  for (const id of ids) {
    measureBox(id);
  }

  // 4. Rekursif Penempatan Cabang Horizontal (Level 3 hingga Level 15+)
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
    // Ujung kanan parent (tempat teks berakhir) + celah level
    const branchX = parentX + parentMetric.width + levelGapX;

    const kidsBoxes = kids.map((k) => measureBox(k));
    const totalKidsSpanY = kidsBoxes.reduce(
      (sum, b, idx) => sum + b.spanY + (idx > 0 ? siblingGapY : 0),
      0
    );

    let cursorY = parentSlotY + Math.max(0, (parentSlotHeight - totalKidsSpanY) / 2);

    for (let i = 0; i < kids.length; i++) {
      const kidId = kids[i];
      const kidBox = kidsBoxes[i];

      const kidSlotY = cursorY;
      const kidSlotHeight = kidBox.spanY;
      const kidY = kidSlotY + kidSlotHeight / 2;

      // Pusat bulatan node anak ditaruh tepat di branchX (tanpa ditambah width/2 yang membuat celah)
      const kidActualX = branchX;

      targets.set(kidId, {
        x: kidActualX,
        y: kidY,
        side: lane,
        lane,
      });

      // Lanjut rekursif ke Level 4, Level 5, dst.
      placeHorizontalSubtree(kidId, kidActualX, kidSlotY, kidSlotHeight, lane);

      cursorY += kidBox.spanY + siblingGapY;
    }
  }

  // 5. Penempatan Pohon Milestone
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
      return { maxX: mX + mMetric.width };
    }

    const l2Boxes = l2Kids.map((k) => measureBox(k));
    // Indentasi tiang vertikal Level 2
    const trunkX = mX + 32;

    let currentY: number;
    if (lane === -1) {
      const safeFirstSlotY = -minBaselineClearance - l2Boxes[0].spanY;
      currentY = Math.min(mY - 28 - l2Boxes[0].spanY, safeFirstSlotY);
    } else {
      currentY = Math.max(mY + 28, minBaselineClearance);
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

      // Cabang Level 3+ bertumbuh horizontal ke kanan
      placeHorizontalSubtree(kidId, trunkX, slotY, slotHeight, lane);

      if (lane === -1) {
        if (i < l2Kids.length - 1) {
          const nextBox = l2Boxes[i + 1];
          currentY -= (nextBox.spanY + siblingGapY);
        }
      } else {
        currentY += slotHeight + siblingGapY;
      }
    }

    let maxX = mX + mMetric.width;
    function collectMaxX(nodeId: string) {
      const t = targets.get(nodeId);
      if (t) {
        maxX = Math.max(maxX, t.x + metric(nodeId).width);
      }
      for (const c of childrenOf(nodeId).filter((k) => visible.has(k))) {
        collectMaxX(c);
      }
    }
    collectMaxX(mId);

    return { maxX };
  }

  // 6. Penempatan Milestone Ritmis Sumbu Baseline (Symmetric Pacing)
  // Menjaga urutan bergantian yang seimbang tanpa ada ruang kosong raksasa
  const lastSameLaneMaxX: Record<-1 | 1, number> = {
    [-1]: rootMetric.width / 2 + 60,
    [1]: rootMetric.width / 2 + 60,
  };
  let lastAnyMilestoneX = rootMetric.width / 2;
  const minAlternatingStep = 80;
  const sameLaneClearance = 45;

  milestones.forEach((mId, index) => {
    const lane: -1 | 1 = index % 2 === 0 ? -1 : 1;

    // Syarat 1: Membersihkan pohon milestone sebelumnya pada jalur yang sama
    const minFromSameLane = lastSameLaneMaxX[lane] + sameLaneClearance;
    // Syarat 2: Menjaga langkah ritmis minimum dari milestone sebelumnya
    const minFromPrev = lastAnyMilestoneX + minAlternatingStep;

    const mX = Math.max(minFromSameLane, minFromPrev);
    const { maxX } = placeMilestoneTree(mId, mX, lane);

    lastSameLaneMaxX[lane] = maxX;
    lastAnyMilestoneX = mX;
  });

  // 7. Node yang belum terhubung/yatim ditaruh rapi di ujung timeline
  let orphanCursorX = Math.max(lastSameLaneMaxX[-1], lastSameLaneMaxX[1]) + 80;
  for (const id of ids) {
    if (!targets.has(id)) {
      targets.set(id, { x: orphanCursorX, y: baselineY, side: 0, lane: 0 });
      orphanCursorX += metric(id).width + 50;
    }
  }

  return {
    mode: 'timeline',
    targets,
    bounds: boundsOf(targets, context.nodeMetrics),
    decorations: [],
  };
}