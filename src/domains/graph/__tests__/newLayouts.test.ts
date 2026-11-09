import { describe, expect, it } from 'vitest';
import { fruchtermanReingoldLayout, gridLayout, kamadaKawaiLayout } from '../layout/networkLayouts';
import { braceMapLayout, orgChartLayout } from '../layout/treeLayouts';
import { context, deepTree } from './fixtures';
import type { LayoutGeometry } from '../model/graphTypes';

const tree = deepTree();
const edges = tree.ids.flatMap((id) => tree.childrenOf(id).map((c) => [id, c] as [string, string]));
const net = () => ({ ids: tree.ids, edges, context: context() });

const cases: Array<[string, () => LayoutGeometry]> = [
  ['fr-standard', () => fruchtermanReingoldLayout(net(), false)],
  ['fr-radial', () => fruchtermanReingoldLayout(net(), true)],
  ['kamada-kawai', () => kamadaKawaiLayout(net())],
  ['grid', () => gridLayout(net(), (id) => id)],
  ['org-chart', () => orgChartLayout({ ...tree, context: context() })],
  ['brace-map', () => braceMapLayout({ ...tree, context: context() })],
];

describe.each(cases)('%s layout', (_name, run) => {
  it('places every node at finite coordinates', () => {
    const geo = run();
    expect(geo.targets.size).toBe(tree.ids.length);
    for (const id of tree.ids) {
      const t = geo.targets.get(id)!;
      expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    }
  });
  it('is deterministic', () => {
    const a = run();
    const b = run();
    for (const id of tree.ids) expect(a.targets.get(id)).toEqual(b.targets.get(id));
  });
  it('does not stack nodes on the same point', () => {
    const geo = run();
    const keys = new Set(tree.ids.map((id) => {
      const t = geo.targets.get(id)!;
      return `${Math.round(t.x)}:${Math.round(t.y)}`;
    }));
    expect(keys.size).toBe(tree.ids.length);
  });
});
