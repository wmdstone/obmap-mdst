/** Free-force mode: no deterministic targets, the wrapper's simulation owns positions. */

import type { LayoutGeometry, NodeTarget } from '@/domains/graph/shared/utils/graph.types';

export function freeForceLayout(): LayoutGeometry {
  return {
    mode: 'free-force',
    targets: new Map<string, NodeTarget>(),
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    decorations: [],
  };
}
