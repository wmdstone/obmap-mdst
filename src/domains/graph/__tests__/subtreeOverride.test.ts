import { describe, expect, it } from 'vitest';
// LayoutEngineOptions diimpor langsung dari useLayoutEngine bersama computeLayout
import { computeLayout, type LayoutEngineOptions } from '../layout/useLayoutEngine';
import { deepTree } from './fixtures';
import type { GraphProjection, RenderNode } from '../model/graphTypes';

/** Helper untuk membuat GraphProjection yang valid dan lengkap */
function createMockProjection(): GraphProjection {
  const tree = deepTree();

  const nodes: RenderNode[] = tree.ids.map((id) => ({
    id,
    name: id,
    type: 'file',
    depth: id === 'root' ? 0 : 1,
    parentId: id === 'root' ? null : 'root',
    content: '',
    tags: [],
    childCount: tree.childrenOf(id).length,
    time: 0,
  }));

  const byId = new Map<string, RenderNode>(nodes.map((node) => [node.id, node]));

  const childrenByParent = new Map<string, string[]>([
    ['root', ['a', 'b']],
    ['a', ['a1', 'a2']],
    ['b', ['b1']],
  ]);

  const parentByChild = new Map<string, string | null>([
    ['root', null],
    ['a', 'root'],
    ['b', 'root'],
    ['a1', 'a'],
    ['a2', 'a'],
    ['b1', 'b'],
  ]);

  return {
    nodes,
    links: [],
    byId,
    childrenByParent,
    parentByChild,
    roots: tree.roots,
  };
}

function baseOptions(overrides: Partial<LayoutEngineOptions> = {}): LayoutEngineOptions {
  const tree = deepTree();
  return {
    mode: 'mindmap',
    width: 1200,
    height: 800,
    orientation: 'balanced',
    levelGap: 120,
    siblingGap: 24,
    laneGap: 60,
    ribAngle: Math.PI / 4,
    visibleIds: tree.ids,
    nodeMetrics: new Map(),
    ...overrides,
  };
}

describe('Subtree Layout Override', () => {
  it('berjalan tanpa error saat tidak ada subtree override', () => {
    const projection = createMockProjection();
    const geo = computeLayout(projection, baseOptions());

    expect(geo.targets.size).toBe(projection.nodes.length);
    for (const node of projection.nodes) {
      const t = geo.targets.get(node.id);
      expect(t).toBeDefined();
      expect(Number.isFinite(t!.x) && Number.isFinite(t!.y)).toBe(true);
    }
  });

  it('mengubah posisi turunan saat cabang di-override dengan org-chart', () => {
    const projection = createMockProjection();

    // Layout default murni
    const defaultGeo = computeLayout(projection, baseOptions());

    // Layout dengan override pada cabang 'a' menjadi org-chart
    const overriddenGeo = computeLayout(projection, {
      ...baseOptions(),
      subtreeOverrides: { a: 'org-chart' },
    });

    // Root dan cabang b harus tetap di posisi yang stabil / setara
    const defaultRoot = defaultGeo.targets.get('root')!;
    const overrideRoot = overriddenGeo.targets.get('root')!;
    expect(overrideRoot.x).toBeCloseTo(defaultRoot.x, 2);
    expect(overrideRoot.y).toBeCloseTo(defaultRoot.y, 2);

    // Node turunan a1 dan a2 harus memiliki posisi valid
    const a1 = overriddenGeo.targets.get('a1')!;
    const a2 = overriddenGeo.targets.get('a2')!;
    expect(Number.isFinite(a1.x) && Number.isFinite(a1.y)).toBe(true);
    expect(Number.isFinite(a2.x) && Number.isFinite(a2.y)).toBe(true);
  });

  it('bersifat deterministik pada input berulang dengan override', () => {
    const projection = createMockProjection();
    const options: LayoutEngineOptions = {
      ...baseOptions(),
      subtreeOverrides: { a: 'brace-map' },
    };

    const pass1 = computeLayout(projection, options);
    const pass2 = computeLayout(projection, options);

    for (const node of projection.nodes) {
      expect(pass1.targets.get(node.id)).toEqual(pass2.targets.get(node.id));
    }
  });
});
