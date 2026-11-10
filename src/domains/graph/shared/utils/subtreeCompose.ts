/**
 * Subtree Layout Composition.
 * Allows specific branches in a mindmap tree to override their layout engine
 * (e.g. root is 'mindmap', but branch 'Project A' is 'brace-map' or 'org-chart').
 */

import type {
  LayoutContext,
  LayoutGeometry,
  MindmapLayoutMode,
  NodeTarget,
  SubtreeLayoutMap,
} from '../model/graphTypes';
import { boundsOf } from './layoutMath';
import { mindmapLayout } from './mindmap';
import { orgChartLayout, braceMapLayout } from './treeLayouts';
import { timelineLayout } from './timeline';
import { fishboneLayout } from './fishbone';

export interface TreeData {
  ids: string[];
  roots: string[];
  childrenOf: (id: string) => string[];
  context: LayoutContext;
  projection?: {
    byId: Map<string, { time?: number }>;
    parentByChild: Map<string, string>;
  };
}

/**
 * Mengambil semua node keturunan (descendants) dari suatu root cabang secara rekursif.
 */
export function collectSubtreeIds(
  rootId: string,
  childrenOf: (id: string) => string[],
  visible: Set<string>
): string[] {
  const result: string[] = [rootId];
  const queue: string[] = [...childrenOf(rootId).filter((c) => visible.has(c))];
  const visited = new Set<string>([rootId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    result.push(current);
    for (const child of childrenOf(current)) {
      if (visible.has(child) && !visited.has(child)) {
        queue.push(child);
      }
    }
  }

  return result;
}

/**
 * Menjalankan layout struktural tertentu untuk subtree yang terisolasi.
 */
function runSubtreeLayout(
  mode: MindmapLayoutMode,
  subtreeIds: string[],
  rootId: string,
  childrenOf: (id: string) => string[],
  context: LayoutContext,
  projection?: TreeData['projection']
): LayoutGeometry {
  const treeInput = {
    ids: subtreeIds,
    roots: [rootId],
    childrenOf,
    context,
  };

  switch (mode) {
    case 'org-chart':
      return orgChartLayout(treeInput);
    case 'brace-map':
      return braceMapLayout(treeInput);
    case 'timeline':
      return timelineLayout({
        ids: subtreeIds,
        roots: [rootId],
        childrenOf,
        parentOf: (id) => projection?.parentByChild.get(id) ?? null,
        context,
      });
    case 'fishbone':
      return fishboneLayout(treeInput);
    case 'mindmap':
    default:
      return mindmapLayout(treeInput);
  }
}

/**
 * Menggabungkan layout dasar dengan subtree yang memiliki layout override.
 */
export function composeSubtreeLayouts(
  baseGeometry: LayoutGeometry,
  tree: TreeData,
  overrides?: SubtreeLayoutMap
): LayoutGeometry {
  if (!overrides || Object.keys(overrides).length === 0) {
    return baseGeometry;
  }

  const visible = new Set(tree.ids);
  const finalTargets = new Map<string, NodeTarget>(baseGeometry.targets);
  const decorations = [...baseGeometry.decorations];

  for (const [overrideRootId, overrideMode] of Object.entries(overrides)) {
    // Pastikan node override ada di kanvas dan punya koordinat anchor
    if (!visible.has(overrideRootId) || !finalTargets.has(overrideRootId)) {
      continue;
    }

    const anchorTarget = finalTargets.get(overrideRootId)!;
    const subtreeIds = collectSubtreeIds(overrideRootId, tree.childrenOf, visible);
    if (subtreeIds.length <= 1) continue; // Tidak ada child untuk di-layout ulang

    // 1. Hitung layout terisolasi untuk subtree
    const isolatedGeo = runSubtreeLayout(
      overrideMode,
      subtreeIds,
      overrideRootId,
      tree.childrenOf,
      tree.context,
      tree.projection
    );

    const isolatedRootTarget = isolatedGeo.targets.get(overrideRootId);
    if (!isolatedRootTarget) continue;

    // 2. Tentukan pergeseran koordinat (offset delta)
    const deltaX = anchorTarget.x - isolatedRootTarget.x;
    const deltaY = anchorTarget.y - isolatedRootTarget.y;

    // 3. Jika induk berada di cabang kiri (side === -1), balik arah horizontal subtree
    const flipHorizontal = anchorTarget.side === -1 && overrideMode === 'brace-map';

    // 4. Update posisi seluruh keturunan dalam subtree
    for (const subId of subtreeIds) {
      if (subId === overrideRootId) continue; // Posisi anchor root tetap di posisi induknya
      const localTarget = isolatedGeo.targets.get(subId);
      if (!localTarget) continue;

      let adjustedX = localTarget.x - isolatedRootTarget.x;
      if (flipHorizontal) adjustedX = -adjustedX;

      const finalX = anchorTarget.x + adjustedX;
      const finalY = anchorTarget.y + (localTarget.y - isolatedRootTarget.y);

      finalTargets.set(subId, {
        ...localTarget,
        x: finalX,
        y: finalY,
        side: anchorTarget.side ?? localTarget.side,
      });
    }

    // 5. Tambahkan dekorasi dari subtree jika ada
    if (isolatedGeo.decorations.length > 0) {
      for (const dec of isolatedGeo.decorations) {
        decorations.push(dec);
      }
    }
  }

  return {
    mode: baseGeometry.mode,
    targets: finalTargets,
    bounds: boundsOf(finalTargets, tree.context.nodeMetrics),
    decorations,
  };
}