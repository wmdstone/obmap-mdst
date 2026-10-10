import { describe, expect, it } from 'vitest';
import { timelineLayout } from '../layout/timeline';
import { context } from './fixtures';

describe('timelineLayout', () => {
  it('returns valid coordinates for every visible node', () => {
    const ids = ['root', 'm1', 'm2', 'd1'];
    const roots = ['root'];
    const childrenMap: Record<string, string[]> = {
      root: ['m1', 'm2'],
      m1: ['d1'],
      m2: [],
      d1: [],
    };

    const geo = timelineLayout({
      ids,
      roots,
      childrenOf: (id) => childrenMap[id] ?? [],
      context: context(),
    });

    expect(geo.targets.size).toBe(ids.length);
    for (const id of ids) {
      const t = geo.targets.get(id)!;
      expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    }
  });

  it('keeps milestones monotonic along X axis', () => {
    const ids = ['root', 'm1', 'm2', 'm3'];
    const roots = ['root'];
    const childrenMap: Record<string, string[]> = {
      root: ['m1', 'm2', 'm3'],
      m1: [],
      m2: [],
      m3: [],
    };

    const geo = timelineLayout({
      ids,
      roots,
      childrenOf: (id) => childrenMap[id] ?? [],
      context: context(),
    });

    const x1 = geo.targets.get('m1')!.x;
    const x2 = geo.targets.get('m2')!.x;
    const x3 = geo.targets.get('m3')!.x;

    expect(x1).toBeLessThan(x2);
    expect(x2).toBeLessThan(x3);
  });

  it('alternates lanes across the central axis for successive milestones', () => {
    const ids = ['root', 'm1', 'm2', 'm3', 'm4'];
    const roots = ['root'];
    const childrenMap: Record<string, string[]> = {
      root: ['m1', 'm2', 'm3', 'm4'],
      m1: [],
      m2: [],
      m3: [],
      m4: [],
    };

    const geo = timelineLayout({
      ids,
      roots,
      childrenOf: (id) => childrenMap[id] ?? [],
      context: context(),
    });

    const y1 = geo.targets.get('m1')!.y;
    const y2 = geo.targets.get('m2')!.y;

    // Satu berada di atas baseline (< 0) dan satu di bawah baseline (> 0)
    expect(y1 * y2).toBeLessThan(0);
  });

  it('emits no decorations so the timeline has no horizontal axis line', () => {
    const ids = ['root', 'm1', 'm2'];
    const roots = ['root'];
    const childrenMap: Record<string, string[]> = {
      root: ['m1', 'm2'],
      m1: [],
      m2: [],
    };

    const geo = timelineLayout({
      ids,
      roots,
      childrenOf: (id) => childrenMap[id] ?? [],
      context: context(),
    });

    expect(geo.decorations).toHaveLength(0);
  });

  it('handles an empty input cleanly', () => {
    const geo = timelineLayout({
      ids: [],
      roots: [],
      childrenOf: () => [],
      context: context(),
    });
    expect(geo.targets.size).toBe(0);
    expect(geo.decorations.length).toBe(0);
  });
});
