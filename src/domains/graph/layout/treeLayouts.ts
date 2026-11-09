/**
 * Tidy tree layouts for Mindmap mode: Org Chart (top-down) and
 * Brace Map / Logic Chart (left-to-right). Card-size aware and deterministic.
 */

import type { LayoutContext, LayoutGeometry, LayoutMode, NodeTarget } from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface TreeInput {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  context: LayoutContext;
}

type Direction = 'down' | 'right';

function tidyTree({ ids, roots, childrenOf, context }: TreeInput, direction: Direction, mode: LayoutMode): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  const visible = new Set(ids);
  const children = (id: string) => childrenOf(id).filter((c) => visible.has(c));
  const metric = (id: string) => context.nodeMetrics.get(id) ?? { width: 140, height: 38 };

  // Breadth = sumbu tumpukan sibling; depth = sumbu hirarki bertingkat
  const breadthOf = (id: string) => (direction === 'down' ? metric(id).width : metric(id).height);
  const depthOf = (id: string) => (direction === 'down' ? metric(id).height : metric(id).width);

  // Sibling gap yang cukup aman agar tidak ada teks/badge berdempetan
  const safeGap = Math.max(context.siblingGap, 28);
  const safeLevelGap = Math.max(context.levelGap, 64);

  const spanCache = new Map<string, number>();
  const guard = new Set<string>();

  // 1. Kalkulasi Span Anti-Overlapping: Menambahkan gap antar setiap child secara eksplisit
  const span = (id: string): number => {
    const cached = spanCache.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return breadthOf(id) + safeGap;
    guard.add(id);

    const own = breadthOf(id) + safeGap;
    const kids = children(id);
    if (kids.length === 0) {
      spanCache.set(id, own);
      return own;
    }

    // Hitung total span semua anak DITAMBAH safeGap di antara tiap anak
    const kidsSpanTotal = kids.reduce((sum, kid) => sum + span(kid), 0) + (kids.length - 1) * 8;
    const value = Math.max(own, kidsSpanTotal);
    spanCache.set(id, value);
    return value;
  };

  // 2. Kalkulasi Kedalaman Level yang Aman dari Potongan Garis Link
  const levelDepth: number[] = [];
  const measure = (id: string, level: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    levelDepth[level] = Math.max(levelDepth[level] ?? 0, depthOf(id));
    for (const kid of children(id)) measure(kid, level + 1, seen);
  };
  const seen = new Set<string>();
  roots.filter((r) => visible.has(r)).forEach((r) => measure(r, 0, seen));

  const levelOffset: number[] = [0];
  for (let l = 1; l < levelDepth.length; l += 1) {
    levelOffset[l] = levelOffset[l - 1] + levelDepth[l - 1] / 2 + levelDepth[l] / 2 + safeLevelGap;
  }

  // 3. Penempatan Koordinat Node yang Terpusat & Tidak Bertabrakan
  const placed = new Set<string>();
  const place = (id: string, level: number, start: number) => {
    if (placed.has(id)) return;
    placed.add(id);

    const s = span(id);
    const breadth = start + s / 2;
    const depth = levelOffset[level] ?? 0;
    targets.set(id, direction === 'down' ? { x: breadth, y: depth } : { x: depth, y: breadth, side: 1 });

    const kids = children(id);
    if (kids.length === 0) return;

    const totalKidsSpan = kids.reduce((sum, kid) => sum + span(kid), 0) + (kids.length - 1) * 8;
    let cursor = start + (s - totalKidsSpan) / 2;

    for (const kid of kids) {
      place(kid, level + 1, cursor);
      cursor += span(kid) + 8;
    }
  };

  let cursor = 0;
  for (const root of roots.filter((r) => visible.has(r))) {
    place(root, 0, cursor);
    cursor += span(root) + safeGap * 2;
  }

  // Pusatkan seluruh struktur pohon ke titik origin (0, 0)
  const shift = cursor / 2;
  for (const [id, t] of targets) {
    targets.set(id, direction === 'down' ? { ...t, x: t.x - shift } : { ...t, y: t.y - shift });
  }

  return { mode, targets, bounds: boundsOf(targets, context.nodeMetrics), decorations: [] };
}

export const orgChartLayout = (input: TreeInput) => tidyTree(input, 'down', 'org-chart');
export const braceMapLayout = (input: TreeInput) => tidyTree(input, 'right', 'brace-map');
