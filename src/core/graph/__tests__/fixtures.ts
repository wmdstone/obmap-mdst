import type { Link, Node } from '@/shared/stores/types';
import type { LayoutContext } from '../model/graphTypes';

export function makeNode(id: string, parentId: string | null = null, extra: Partial<Node> = {}): Node {
  return {
    id,
    name: id,
    type: 'file',
    content: '',
    parentId,
    ...extra,
  } as Node;
}

export function makeLink(source: string, target: string): Link {
  return { source, target, type: 'hierarchy' } as Link;
}

export function context(overrides: Partial<LayoutContext> = {}): LayoutContext {
  return {
    width: 1200,
    height: 800,
    orientation: 'balanced',
    levelGap: 120,
    siblingGap: 24,
    laneGap: 60,
    ribAngle: Math.PI / 4,
    nodeMetrics: new Map(),
    ...overrides,
  };
}

/** root with six children — deep enough for side balancing and rib pairing. */
export function starTree() {
  const ids = ['root', 'a', 'b', 'c', 'd', 'e', 'f'];
  const childrenByParent = new Map<string, string[]>([
    ['root', ['a', 'b', 'c', 'd', 'e', 'f']],
  ]);
  return {
    ids,
    roots: ['root'],
    childrenOf: (id: string) => childrenByParent.get(id) ?? [],
  };
}

/** two-level tree: root -> a,b ; a -> a1,a2 ; b -> b1 */
export function deepTree() {
  const childrenByParent = new Map<string, string[]>([
    ['root', ['a', 'b']],
    ['a', ['a1', 'a2']],
    ['b', ['b1']],
  ]);
  return {
    ids: ['root', 'a', 'b', 'a1', 'a2', 'b1'],
    roots: ['root'],
    childrenOf: (id: string) => childrenByParent.get(id) ?? [],
  };
}
