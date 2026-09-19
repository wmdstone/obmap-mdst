import { describe, expect, it } from 'vitest';
import { fishboneLayout } from '../layout/fishbone';
import { context, deepTree, starTree } from './fixtures';

describe('fishboneLayout', () => {
  it('alternates major categories above and below the spine', () => {
    const tree = starTree();
    const geo = fishboneLayout({ ...tree, context: context() });
    const ys = tree.childrenOf('root').map((id) => geo.targets.get(id)!.y);
    expect(ys.some((y) => y < 0)).toBe(true);
    expect(ys.some((y) => y > 0)).toBe(true);
  });

  it('gives every category a distinct spine anchor', () => {
    const tree = starTree();
    const geo = fishboneLayout({ ...tree, context: context() });
    const xs = tree.childrenOf('root').map((id) => geo.targets.get(id)!.x);
    expect(new Set(xs.map((x) => x.toFixed(4))).size).toBe(xs.length);
  });

  it('respects the configured rib angle', () => {
    const tree = starTree();
    const shallow = fishboneLayout({ ...tree, context: context({ ribAngle: Math.PI / 9 }) });
    const steep = fishboneLayout({ ...tree, context: context({ ribAngle: Math.PI / 3 }) });
    const first = tree.childrenOf('root')[0];
    expect(Math.abs(steep.targets.get(first)!.y)).toBeGreaterThan(
      Math.abs(shallow.targets.get(first)!.y)
    );
  });

  it('emits a spine and one rib per major category', () => {
    const tree = starTree();
    const geo = fishboneLayout({ ...tree, context: context() });
    expect(geo.decorations.filter((d) => d.kind === 'fishbone-spine')).toHaveLength(1);
    const majors = geo.decorations.filter((d) => d.kind === 'fishbone-rib' && d.major);
    expect(majors).toHaveLength(tree.childrenOf('root').length);
  });

  it('produces finite coordinates for nested causes', () => {
    const tree = deepTree();
    const geo = fishboneLayout({ ...tree, context: context() });
    for (const id of tree.ids) {
      const t = geo.targets.get(id)!;
      expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    }
  });

  it('is deterministic', () => {
    const tree = deepTree();
    const a = fishboneLayout({ ...tree, context: context() });
    const b = fishboneLayout({ ...tree, context: context() });
    for (const id of tree.ids) expect(a.targets.get(id)).toEqual(b.targets.get(id));
  });
});
