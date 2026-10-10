/**
 * Deterministic network-topology layouts for Graph mode:
 * Fruchterman-Reingold (standard + radial spreading), Kamada-Kawai and Grid.
 * Pure TS, seeded initial positions, so identical input gives identical output.
 */

import type { LayoutContext, LayoutGeometry, LayoutMode, NodeTarget } from '../model/graphTypes';
import { boundsOf } from './layoutMath';

export interface NetworkInput {
  ids: string[];
  edges: Array<[string, string]>;
  context: LayoutContext;
}

/** Stable pseudo-random from a string id (FNV-1a). */
const hash01 = (text: string, salt = 0) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

const geometry = (mode: LayoutMode, targets: Map<string, NodeTarget>, context: LayoutContext): LayoutGeometry => ({
  mode,
  targets,
  bounds: boundsOf(targets, context.nodeMetrics),
  decorations: [],
});

const indexEdges = (ids: string[], edges: Array<[string, string]>) => {
  const index = new Map(ids.map((id, i) => [id, i]));
  const pairs: Array<[number, number]> = [];
  for (const [a, b] of edges) {
    const i = index.get(a);
    const j = index.get(b);
    if (i !== undefined && j !== undefined && i !== j) pairs.push([i, j]);
  }
  return pairs;
};

export function fruchtermanReingoldLayout({ ids, edges, context }: NetworkInput, radial: boolean): LayoutGeometry {
  const mode: LayoutMode = radial ? 'fr-radial' : 'fr-standard';
  const n = ids.length;
  const targets = new Map<string, NodeTarget>();
  if (n === 0) return geometry(mode, targets, context);

  const k = Math.max(60, context.levelGap * 0.9); // ideal edge length
  const area = Math.sqrt(n) * k * 2.2;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  ids.forEach((id, i) => {
    xs[i] = (hash01(id, 1) - 0.5) * area;
    ys[i] = (hash01(id, 2) - 0.5) * area;
  });
  const pairs = indexEdges(ids, edges);
  const iterations = n > 600 ? 80 : n > 200 ? 150 : 260;
  let temperature = area / 8;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const ringRadius = area * 0.55;

  for (let it = 0; it < iterations; it += 1) {
    dx.fill(0);
    dy.fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let ddx = xs[i] - xs[j];
        let ddy = ys[i] - ys[j];
        let dist = Math.hypot(ddx, ddy);
        if (dist < 0.01) { ddx = 0.01 * (i - j); ddy = 0.01; dist = 0.02; }
        const force = (k * k) / dist;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] += fx; dy[i] += fy; dx[j] -= fx; dy[j] -= fy;
      }
    }
    for (const [i, j] of pairs) {
      const ddx = xs[i] - xs[j];
      const ddy = ys[i] - ys[j];
      const dist = Math.max(0.01, Math.hypot(ddx, ddy));
      const force = (dist * dist) / k;
      const fx = (ddx / dist) * force;
      const fy = (ddy / dist) * force;
      dx[i] -= fx; dy[i] -= fy; dx[j] += fx; dy[j] += fy;
    }
    for (let i = 0; i < n; i += 1) {
      const r = Math.max(0.01, Math.hypot(xs[i], ys[i]));
      if (radial) {
        // Radial uniform spreading: pull every node toward a ring band so the
        // centre never collapses into a hairball.
        const pull = (ringRadius - r) * 0.08 * k / 10;
        dx[i] += (xs[i] / r) * pull;
        dy[i] += (ys[i] / r) * pull;
      } else {
        dx[i] -= xs[i] * 0.01; // weak gravity keeps components together
        dy[i] -= ys[i] * 0.01;
      }
      const disp = Math.max(0.01, Math.hypot(dx[i], dy[i]));
      const step = Math.min(disp, temperature);
      xs[i] += (dx[i] / disp) * step;
      ys[i] += (dy[i] / disp) * step;
    }
    temperature *= 0.97;
  }
  ids.forEach((id, i) => targets.set(id, { x: xs[i], y: ys[i] }));
  return geometry(mode, targets, context);
}

export function kamadaKawaiLayout({ ids, edges, context }: NetworkInput): LayoutGeometry {
  const n = ids.length;
  const targets = new Map<string, NodeTarget>();
  if (n === 0) return geometry('kamada-kawai', targets, context);
  // Shortest-path distances via BFS from every node (unweighted).
  const adjacency: number[][] = Array.from({ length: n }, () => []);
  for (const [i, j] of indexEdges(ids, edges)) {
    adjacency[i].push(j);
    adjacency[j].push(i);
  }
  const dist: Int32Array[] = [];
  let maxD = 1;
  for (let s = 0; s < n; s += 1) {
    const d = new Int32Array(n).fill(-1);
    d[s] = 0;
    const queue = [s];
    for (let q = 0; q < queue.length; q += 1) {
      const u = queue[q];
      for (const v of adjacency[u]) if (d[v] < 0) { d[v] = d[u] + 1; queue.push(v); }
    }
    for (let i = 0; i < n; i += 1) if (d[i] > maxD) maxD = d[i];
    dist.push(d);
  }
  const disconnected = maxD + 1;
  const L = Math.max(60, context.levelGap * 0.9);
  // Start on a circle (classic KK seeding), then stress-majorization iterations.
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const R = (L * Math.sqrt(n)) / 1.5;
  ids.forEach((_, i) => {
    const a = (2 * Math.PI * i) / n;
    xs[i] = R * Math.cos(a);
    ys[i] = R * Math.sin(a);
  });
  const iterations = n > 400 ? 30 : 80;
  for (let it = 0; it < iterations; it += 1) {
    for (let i = 0; i < n; i += 1) {
      let sx = 0, sy = 0, sw = 0;
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dij = (dist[i][j] < 0 ? disconnected : dist[i][j]) * L;
        const w = 1 / (dij * dij);
        const ddx = xs[i] - xs[j];
        const ddy = ys[i] - ys[j];
        const cur = Math.max(0.01, Math.hypot(ddx, ddy));
        sx += w * (xs[j] + (dij * ddx) / cur);
        sy += w * (ys[j] + (dij * ddy) / cur);
        sw += w;
      }
      if (sw > 0) { xs[i] = sx / sw; ys[i] = sy / sw; }
    }
  }
  ids.forEach((id, i) => targets.set(id, { x: xs[i], y: ys[i] }));
  return geometry('kamada-kawai', targets, context);
}

export type GridSort = 'degree' | 'name' | 'tag';

export function gridLayout(
  { ids, edges, context }: NetworkInput,
  labelOf: (id: string) => string,
  sort: GridSort = 'degree'
): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  const degree = new Map<string, number>();
  for (const [a, b] of edges) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  const ordered = [...ids].sort((a, b) =>
    sort === 'degree'
      ? (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || labelOf(a).localeCompare(labelOf(b))
      : labelOf(a).localeCompare(labelOf(b))
  );
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length * 1.6)));
  let cellW = 0;
  let cellH = 0;
  for (const id of ordered) {
    const m = context.nodeMetrics.get(id) ?? { width: 120, height: 36 };
    cellW = Math.max(cellW, m.width);
    cellH = Math.max(cellH, m.height);
  }
  cellW += context.siblingGap * 1.5;
  cellH += context.siblingGap * 1.5;
  const rows = Math.ceil(ordered.length / columns);
  ordered.forEach((id, i) => {
    const c = i % columns;
    const r = Math.floor(i / columns);
    targets.set(id, { x: (c - (columns - 1) / 2) * cellW, y: (r - (rows - 1) / 2) * cellH });
  });
  return geometry('grid', targets, context);
}
