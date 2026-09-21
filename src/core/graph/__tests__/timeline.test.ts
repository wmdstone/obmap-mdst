import { describe, expect, it } from 'vitest';
import { timelineLayout } from '../layout/timeline';
import { context } from './fixtures';

const day = 86_400_000;

describe('timelineLayout', () => {
  it('keeps X monotonic in chronological order', () => {
    const nodes = [
      { id: 'c', time: 3 * day },
      { id: 'a', time: 1 * day },
      { id: 'b', time: 2 * day },
    ];
    const geo = timelineLayout({ nodes, parentOf: () => null, context: context() });
    const xs = ['a', 'b', 'c'].map((id) => geo.targets.get(id)!.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('spreads evenly when all timestamps are identical', () => {
    const nodes = [1, 2, 3, 4].map((n) => ({ id: `n${n}`, time: day }));
    const geo = timelineLayout({ nodes, parentOf: () => null, context: context() });
    const xs = nodes.map((n) => geo.targets.get(n.id)!.x);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
  });

  it('handles missing dates without producing NaN', () => {
    const nodes = [{ id: 'a' }, { id: 'b', time: day }, { id: 'c' }];
    const geo = timelineLayout({ nodes, parentOf: () => null, context: context() });
    for (const node of nodes) {
      const t = geo.targets.get(node.id)!;
      expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    }
  });

  it('alternates lanes for dense milestones', () => {
    const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, time: day + i * 1000 }));
    const geo = timelineLayout({ nodes, parentOf: () => null, context: context() });
    const ys = nodes.map((n) => geo.targets.get(n.id)!.y);
    expect(new Set(ys).size).toBeGreaterThan(1);
    expect(ys.some((y) => y < 0)).toBe(true);
    expect(ys.some((y) => y > 0)).toBe(true);
  });

  it('does not overlap cards assigned to the same visual row', () => {
    const nodes = Array.from({ length: 24 }, (_, i) => ({ id: `n${i}`, time: day + i }));
    const metrics = new Map(nodes.map((node, index) => [
      node.id,
      { width: 100 + (index % 3) * 30, height: 40 },
    ]));
    const gap = 24;
    const geo = timelineLayout({
      nodes,
      parentOf: () => null,
      context: context({ nodeMetrics: metrics, siblingGap: gap }),
    });
    const rows = new Map<number, typeof nodes>();
    for (const node of nodes) {
      const y = geo.targets.get(node.id)!.y;
      rows.set(y, [...(rows.get(y) ?? []), node]);
    }
    for (const row of rows.values()) {
      const sorted = [...row].sort((a, b) => geo.targets.get(a.id)!.x - geo.targets.get(b.id)!.x);
      for (let index = 1; index < sorted.length; index += 1) {
        const left = sorted[index - 1];
        const right = sorted[index];
        const leftEdge = geo.targets.get(left.id)!.x + metrics.get(left.id)!.width / 2;
        const rightEdge = geo.targets.get(right.id)!.x - metrics.get(right.id)!.width / 2;
        expect(rightEdge - leftEdge).toBeGreaterThanOrEqual(gap);
      }
    }
  });

  it('emits a single axis decoration with ticks', () => {
    const nodes = [
      { id: 'a', time: day },
      { id: 'b', time: 40 * day },
    ];
    const geo = timelineLayout({ nodes, parentOf: () => null, context: context() });
    const axes = geo.decorations.filter((d) => d.kind === 'timeline-axis');
    expect(axes).toHaveLength(1);
    expect((axes[0] as { ticks: unknown[] }).ticks.length).toBeGreaterThan(0);
  });

  it('places details near their milestone', () => {
    const nodes = [
      { id: 'm', time: day },
      { id: 'd1' },
    ];
    const geo = timelineLayout({
      nodes,
      parentOf: (id) => (id === 'd1' ? 'm' : null),
      context: context(),
    });
    const m = geo.targets.get('m')!;
    const d = geo.targets.get('d1')!;
    expect(Math.abs(d.x - m.x)).toBeLessThan(600);
    expect(d.y).not.toBe(m.y);
  });

  it('treats dated descendants as milestones and attaches undated details to them', () => {
    const nodes = [
      { id: 'root' },
      { id: 'm', time: day },
      { id: 'detail' },
    ];
    const geo = timelineLayout({
      nodes,
      parentOf: (id) => (id === 'm' ? 'root' : id === 'detail' ? 'm' : null),
      context: context(),
    });
    const milestone = geo.targets.get('m')!;
    const detail = geo.targets.get('detail')!;
    expect(Math.abs(detail.x - milestone.x)).toBeLessThan(300);
    expect(detail.y).not.toBe(milestone.y);
    expect(Number.isFinite(geo.targets.get('root')!.x)).toBe(true);
  });
});
