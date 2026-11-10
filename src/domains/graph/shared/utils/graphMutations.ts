/**
 * Graph mutations expressed as pure functions over the vault's graph data.
 *
 * The store never keeps a second node collection: callers pass the current
 * data in and hand the result back to the vault's `setGraphData`.
 */

import type { Link, Node } from '@/shared/stores/types';

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

const endpoint = (end: string | { id: string }) => (typeof end === 'string' ? end : end.id);

export type DeletePolicy = 'cascade' | 'promote';

/** Every descendant of `id` in the parent hierarchy. */
export function descendantIds(nodes: Node[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = childrenOf.get(node.parentId);
    if (list) list.push(node.id);
    else childrenOf.set(node.parentId, [node.id]);
  }
  const result = new Set<string>();
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop() as string;
    if (result.has(next)) continue;
    result.add(next);
    stack.push(...(childrenOf.get(next) ?? []));
  }
  return result;
}

/** Adds a child node under `parentId` (root when null). */
export function addChildNode(
  data: GraphData,
  node: Node,
  parentId: string | null
): GraphData {
  const child: Node = { ...node, parentId };
  const links = parentId
    ? [...data.links, { source: parentId, target: child.id, type: 'hierarchy' as const }]
    : data.links;
  return { nodes: [...data.nodes, child], links };
}

/** Removes a node; `cascade` drops its subtree, `promote` lifts children up. */
export function removeNode(
  data: GraphData,
  id: string,
  policy: DeletePolicy = 'cascade'
): GraphData {
  const target = data.nodes.find((node) => node.id === id);
  if (!target) return data;

  const removed = policy === 'cascade' ? descendantIds(data.nodes, id) : new Set<string>();
  removed.add(id);

  const nodes = data.nodes
    .filter((node) => !removed.has(node.id))
    .map((node) =>
      node.parentId === id ? { ...node, parentId: target.parentId ?? null } : node
    );

  const links = data.links.filter(
    (link) => !removed.has(endpoint(link.source)) && !removed.has(endpoint(link.target))
  );

  return { nodes, links };
}

/** Re-parents a node, refusing moves that would create a cycle. */
export function reparentNode(
  data: GraphData,
  id: string,
  parentId: string | null
): GraphData {
  if (id === parentId) return data;
  if (parentId && descendantIds(data.nodes, id).has(parentId)) return data;
  return {
    nodes: data.nodes.map((node) => (node.id === id ? { ...node, parentId } : node)),
    links: data.links,
  };
}
