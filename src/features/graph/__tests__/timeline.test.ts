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
});
