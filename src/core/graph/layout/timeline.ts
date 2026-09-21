/** Chronological timeline layout with collision-aware alternating lanes. */

import type { LayoutContext, LayoutGeometry, NodeTarget, TimelineAxis } from '../model/graphTypes';
import { boundsOf, formatTimeLabel, niceInterval } from './layoutMath';

export interface TimelineInput {
  nodes: { id: string; time?: number }[];
  parentOf: (id: string) => string | null;
  context: LayoutContext;
}

export function timelineLayout({ nodes, parentOf, context }: TimelineInput): LayoutGeometry {
  const targets = new Map<string, NodeTarget>();
  if (!nodes.length) {
    return { mode: 'timeline', targets, bounds: boundsOf(targets), decorations: [] };
  }

  const axisLeft = 0;
  const maxMetric = nodes.reduce(
    (largest, node) => {
      const current = context.nodeMetrics.get(node.id) ?? { width: 120, height: 36 };
      return { width: Math.max(largest.width, current.width), height: Math.max(largest.height, current.height) };
    },
    { width: 120, height: 36 }
  );
  const baselineY = 0;
  const laneGap = Math.max(context.laneGap, maxMetric.height + context.siblingGap);
  const metric = (id: string) => context.nodeMetrics.get(id) ?? { width: 120, height: 36 };

  const visible = new Set(nodes.map((n) => n.id));
  const datedNodes = nodes.filter((node) => Number.isFinite(node.time));
  // Dates define timeline milestones. If no dates exist, roots remain useful
  // anchors instead of collapsing the entire view into detached details.
  const milestones = datedNodes.length
    ? datedNodes
    : nodes.filter((node) => {
        const parent = parentOf(node.id);
        return !parent || !visible.has(parent);
      });
  const milestoneIds = new Set(milestones.map((node) => node.id));
  const details = nodes.filter((node) => !milestoneIds.has(node.id));

  const detailCountByMilestone = new Map<string, number>();
  const milestoneFor = (id: string): string | null => {
    const seen = new Set<string>();
    let current = id;
    while (!seen.has(current)) {
      seen.add(current);
      const parent = parentOf(current);
      if (!parent || !visible.has(parent)) return null;
      if (milestoneIds.has(parent)) return parent;
      current = parent;
    }
    return null;
  };
  for (const detail of details) {
    const milestone = milestoneFor(detail.id);
    if (milestone) detailCountByMilestone.set(milestone, (detailCountByMilestone.get(milestone) ?? 0) + 1);
  }

  const detailAllowance = Math.max(0, ...detailCountByMilestone.values()) * maxMetric.width * 0.35;
  const hasDateRange = datedNodes.length > 1
    && Math.max(...datedNodes.map((node) => node.time as number))
      > Math.min(...datedNodes.map((node) => node.time as number));
  // Real dates keep their proportional spacing and spill into extra lanes when
  // crowded. Synthetic/equal dates spread evenly and therefore need one card
  // width per milestone.
  const minimumStep = maxMetric.width + context.siblingGap * 2;
  const axisWidth = hasDateRange
    ? Math.max(600, context.width * 1.4, context.width + detailAllowance)
    : Math.max(600, context.width * 1.4, (milestones.length - 1) * minimumStep + detailAllowance);

  const dated = milestones.filter((n) => Number.isFinite(n.time));
  const times = dated.map((n) => n.time as number);
  const timeMin = times.length ? Math.min(...times) : 0;
  const timeMax = times.length ? Math.max(...times) : 0;
  const span = Math.max(0, timeMax - timeMin);

  const ordered = [...milestones].sort((a, b) => {
    const at = Number.isFinite(a.time) ? (a.time as number) : Infinity;
    const bt = Number.isFinite(b.time) ? (b.time as number) : Infinity;
    if (at === bt) return 0;
    return at - bt;
  });

  const undated = ordered.filter((node) => !Number.isFinite(node.time));
  const datedWidth = undated.length && dated.length ? axisWidth * 0.72 : axisWidth;
  const xOf = (node: { id: string; time?: number }, index: number) => {
    if (span > 0 && Number.isFinite(node.time)) {
      return axisLeft + (((node.time as number) - timeMin) / span) * datedWidth;
    }
    if (span > 0 && !Number.isFinite(node.time)) {
      const undatedIndex = undated.findIndex((item) => item.id === node.id);
      return axisLeft + datedWidth + ((undatedIndex + 1) * (axisWidth - datedWidth)) / Math.max(1, undated.length);
    }
    return axisLeft + (index * axisWidth) / Math.max(1, ordered.length - 1);
  };

  const laneEnd = new Map<number, number>();
  ordered.forEach((node, index) => {
    const x = xOf(node, index);
    const half = metric(node.id).width / 2;
    let lane = 1;
    for (let step = 1; step <= ordered.length + 1; step += 1) {
      for (const candidate of [step, -step]) {
        const end = laneEnd.get(candidate) ?? -Infinity;
        if (x - half >= end + context.siblingGap) {
          lane = candidate;
          step = ordered.length + 2;
          break;
        }
      }
    }
    laneEnd.set(lane, x + half);
    // Each collision lane must map to one distinct visual row. Previously
    // lanes 1/2 (and 3/4) shared a y-coordinate despite separate occupancy
    // tracking, allowing cards to overlap on dense timelines.
    const y = baselineY + lane * laneGap;
    targets.set(node.id, { x, y, lane });
  });

  // Detail nodes occupy card-aware rows outward from their nearest dated
  // ancestor. Walking breadth-first keeps every child near its visible parent.
  const children = new Map<string, string[]>();
  for (const detail of details) {
    const parent = parentOf(detail.id);
    if (!parent || !visible.has(parent)) continue;
    const list = children.get(parent) ?? [];
    list.push(detail.id);
    children.set(parent, list);
  }
  for (const milestone of ordered) {
    const anchor = targets.get(milestone.id);
    if (!anchor) continue;
    const side = anchor.y >= baselineY ? 1 : -1;
    let row = 1;
    let frontier = children.get(milestone.id) ?? [];
    while (frontier.length) {
      const rowWidth = frontier.reduce((sum, id) => sum + metric(id).width, 0)
        + Math.max(0, frontier.length - 1) * context.siblingGap;
      let cursor = anchor.x - rowWidth / 2;
      const next: string[] = [];
      for (const id of frontier) {
        const currentMetric = metric(id);
        const x = cursor + currentMetric.width / 2;
        targets.set(id, {
          x,
          y: anchor.y + side * row * laneGap,
          lane: anchor.lane,
        });
        cursor += currentMetric.width + context.siblingGap;
        next.push(...(children.get(id) ?? []));
      }
      frontier = next;
      row += 1;
    }
  }

  // Structural ancestors and malformed branches without a dated ancestor get
  // a dedicated lane, spaced by measured card width so they cannot overlap.
  let detachedCursor = axisLeft;
  details.forEach((detail) => {
    if (targets.has(detail.id)) return;
    const currentMetric = metric(detail.id);
    targets.set(detail.id, {
      x: detachedCursor + currentMetric.width / 2,
      y: baselineY - laneGap * 3,
      lane: 3,
    });
    detachedCursor += currentMetric.width + context.siblingGap;
  });

  const axis: TimelineAxis = {
    kind: 'timeline-axis',
    y: baselineY,
    x1: axisLeft,
    x2: axisLeft + axisWidth,
    ticks: [],
  };

  if (span > 0) {
    const step = niceInterval(span);
    const start = Math.ceil(timeMin / step) * step;
    for (let t = start; t <= timeMax; t += step) {
      axis.ticks.push({
        x: axisLeft + ((t - timeMin) / span) * datedWidth,
        label: formatTimeLabel(t, span),
      });
    }
  }

  return {
    mode: 'timeline',
    targets,
    bounds: boundsOf(targets, context.nodeMetrics),
    decorations: [axis],
  };
}
