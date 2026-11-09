import type { Node } from '@/shared/stores/types';

/**
 * Konversi list Node[] atau Map<string, Node> ke Map pencarian O(1).
 */
export function buildNodeMap(nodes: Node[] | Map<string, Node>): Map<string, Node> {
  if (nodes instanceof Map) return nodes;
  const map = new Map<string, Node>();
  for (const n of nodes) {
    map.set(n.id, n);
  }
  return map;
}

/**
 * Mengembalikan urutan node dari root hingga targetNode [root, ..., targetNode].
 * Dilengkapi proteksi circular reference (siklus) dan dangling parentId.
 */
export function getBreadcrumbPath(
  targetNode: Node | null | undefined,
  allNodes: Node[] | Map<string, Node>
): Node[] {
  if (!targetNode) return [];

  const byId = buildNodeMap(allNodes);
  const path: Node[] = [];
  const visited = new Set<string>();

  let current: Node | undefined = targetNode;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);

    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}

/**
 * Menghasilkan Set ID leluhur dari node hingga root.
 * Digunakan untuk penandaan visual (highlighting) garis pohon di Sidebar.
 */
export function getAncestorIdSet(
  targetNode: Node | string | null | undefined,
  allNodes: Node[] | Map<string, Node>,
  includeSelf = true
): Set<string> {
  const result = new Set<string>();
  if (!targetNode) return result;

  const byId = buildNodeMap(allNodes);
  const startId = typeof targetNode === 'string' ? targetNode : targetNode.id;
  const target = byId.get(startId) ?? (typeof targetNode === 'object' ? targetNode : undefined);

  if (!target) return result;

  if (includeSelf) {
    result.add(target.id);
  }

  const visited = new Set<string>([target.id]);
  let currentParentId = target.parentId;

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    result.add(currentParentId);
    const parentNode = byId.get(currentParentId);
    currentParentId = parentNode ? parentNode.parentId : null;
  }

  return result;
}

/**
 * Memeriksa apakah candidateId adalah keturunan (descendant) dari ancestorId.
 * Mencegah pemindahan folder ke dalam sub-foldernya sendiri di File Explorer.
 */
export function isNodeDescendant(
  candidateId: string,
  ancestorId: string,
  allNodes: Node[] | Map<string, Node>
): boolean {
  if (candidateId === ancestorId) return true;

  const byId = buildNodeMap(allNodes);
  const candidate = byId.get(candidateId);
  if (!candidate) return false;

  const ancestors = getAncestorIdSet(candidate, byId, false);
  return ancestors.has(ancestorId);
}