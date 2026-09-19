import { describe, expect, it } from 'vitest';
import { mindmapLayout } from '../layout/mindmap';
import { context, deepTree, starTree } from './fixtures';

const finite = (n: number) => Number.isFinite(n);

describe('mindmapLayout', () => {
  it('returns finite coordinates for every visible node', () => {
    const tree = deepTree();
    const geo = mindmapLayout({ ...tree, context: context() });

    expect(geo.targets.size).toBe(tree.ids.length);
    for (const id of tree.ids) {
      const t = geo.targets.get(id)!;
      expect(finite(t.x) && finite(t.y)).toBe(true);
    }
  });

  it('is deterministic for identical input', () => {
    const tree = deepTree();
    const a = mindmapLayout({ ...tree, context: context() });
    const b = mindmapLayout({ ...tree, context: context() });
    for (const id of tree.ids) {
      expect(a.targets.get(id)).toEqual(b.targets.get(id));
    }
  });

  it('balances root children across both sides', () => {
    const tree = starTree();
    const geo = mindmapLayout({ ...tree, context: context() });
    const sides = tree.childrenOf('root').map((id) => Math.sign(geo.targets.get(id)!.x));
    expect(sides.filter((s) => s < 0).length).toBeGreaterThan(0);
    expect(sides.filter((s) => s > 0).length).toBeGreaterThan(0);
  });

  it('places deeper nodes further from the root horizontally', () => {
    const tree = deepTree();
    const geo = mindmapLayout({ ...tree, context: context() });
    const a = geo.targets.get('a')!;
    const a1 = geo.targets.get('a1')!;
    expect(Math.abs(a1.x)).toBeGreaterThan(Math.abs(a.x));
  });

  it('radial mode keeps root at the centre and children on a ring', () => {
    const tree = starTree();
    const geo = mindmapLayout({ ...tree, context: context({ orientation: 'radial' }) });
    const root = geo.targets.get('root')!;
    expect(Math.hypot(root.x, root.y)).toBeLessThan(1e-6);
    const radii = tree.childrenOf('root').map((id) => {
      const t = geo.targets.get(id)!;
      return Math.hypot(t.x, t.y);
    });
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
  });

  it('handles an empty graph', () => {
    const geo = mindmapLayout({ ids: [], roots: [], childrenOf: () => [], context: context() });
    expect(geo.targets.size).toBe(0);
  });
});
