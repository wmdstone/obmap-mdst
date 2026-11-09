/**
 * Interaksi Drag & Drop Reparenting untuk mode Mindmap.
 * Mengelola deteksi folder target, validasi pohon hierarki, dan animasi revert.
 */

import type { RenderNode } from '../model/graphTypes';

export interface DragReparentState {
  draggedNodeId: string | null;
  draggedNodeOriginalPos: { x: number; y: number } | null;
  hoveredTargetId: string | null;
  isValidDrop: boolean;
  dropReason?: string;
}

/**
 * Memeriksa apakah candidateId adalah keturunan dari ancestorId.
 * Mencegah pemindahan folder induk ke dalam sub-folder miliknya sendiri (mencegah circular reference).
 */
export function isDescendant(
  candidateId: string,
  ancestorId: string,
  childrenByParent: Map<string, string[]>
): boolean {
  if (candidateId === ancestorId) return true;
  const queue = [...(childrenByParent.get(ancestorId) ?? [])];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === candidateId) return true;
    if (!seen.has(current)) {
      seen.add(current);
      const nextChildren = childrenByParent.get(current);
      if (nextChildren) queue.push(...nextChildren);
    }
  }
  return false;
}

export interface ReparentValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validasi apakah draggedNode dapat dimasukkan ke dalam targetNode.
 */
export function validateReparent(
  draggedNode: RenderNode,
  targetNode: RenderNode | null,
  parentByChild: Map<string, string | null>,
  childrenByParent: Map<string, string[]>
): ReparentValidationResult {
  if (!targetNode) {
    return { valid: false, reason: 'Tidak ada target folder' };
  }

  // 1. Tidak bisa drop ke diri sendiri
  if (draggedNode.id === targetNode.id) {
    return { valid: false, reason: 'Tidak dapat memindahkan ke diri sendiri' };
  }

  // 2. Hanya folder yang bisa menjadi target induk
  if (targetNode.type !== 'folder') {
    return { valid: false, reason: 'Target bukan folder' };
  }

  // 3. Tidak bisa drop ke folder yang sudah menjadi induk langsungnya saat ini
  const currentParentId = parentByChild.get(draggedNode.id) ?? draggedNode.parentId ?? null;
  if (currentParentId === targetNode.id) {
    return { valid: false, reason: 'Sudah berada di dalam folder ini' };
  }

  // 4. Mencegah circular: draggedNode tidak boleh menjadi ancestor dari targetNode
  if (isDescendant(targetNode.id, draggedNode.id, childrenByParent)) {
    return { valid: false, reason: 'Tidak dapat memindahkan induk ke dalam sub-folder miliknya' };
  }

  return { valid: true };
}

/**
 * Mencari node folder terdekat di bawah koordinat kursor drag.
 */
export function findHoveredDropTarget(
  draggedNode: RenderNode,
  allNodes: RenderNode[],
  hitRadius = 45
): RenderNode | null {
  const currentX = draggedNode.x ?? 0;
  const currentY = draggedNode.y ?? 0;

  let closestNode: RenderNode | null = null;
  let minDistance = hitRadius;

  for (const candidate of allNodes) {
    if (candidate.id === draggedNode.id) continue;
    // Hanya pertimbangkan folder sebagai target reparenting
    if (candidate.type !== 'folder') continue;

    const cx = candidate.x ?? 0;
    const cy = candidate.y ?? 0;
    const dist = Math.hypot(currentX - cx, currentY - cy);

    if (dist < minDistance) {
      minDistance = dist;
      closestNode = candidate;
    }
  }

  return closestNode;
}