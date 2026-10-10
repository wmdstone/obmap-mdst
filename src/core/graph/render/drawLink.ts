/** Layout-aware link rendering: bezier branches, timeline arches, fishbone ribs. */

import type { LayoutMode, NodeMetric, RenderNode } from '../model/graphTypes';
import { anchorOnCard } from '../layout/layoutMath';
import { dim, type GraphTheme } from './theme';

export interface DrawLinkState {
  mode: LayoutMode;
  theme: GraphTheme;
  color: string;
  width: number;
  opacity: number;
  dash: number[];
  dimmed: boolean;
  showArrow: boolean;
  arrowLength: number;
  arrowRelPos: number;
  curvature: number;
  curveRotation: number;
  particles: number;
  particleWidth: number;
  particleColor: string;
  particleProgress: number;
  zoom: number;
  preserveDetail: boolean;
  metricOf: (node: RenderNode) => NodeMetric;
  isAttachedToDragged?: boolean;
}

const cubicPoint = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const cubicTangent = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
};

export function drawLink(
  ctx: CanvasRenderingContext2D,
  source: RenderNode,
  target: RenderNode,
  state: DrawLinkState
) {
  const sx = source.x ?? 0;
  const sy = source.y ?? 0;
  const tx = target.x ?? 0;
  const ty = target.y ?? 0;
  if (![sx, sy, tx, ty].every(Number.isFinite)) return;

  const start = anchorOnCard({ x: sx, y: sy }, state.metricOf(source), { x: tx, y: ty });
  const end = anchorOnCard({ x: tx, y: ty }, state.metricOf(target), { x: sx, y: sy });
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return;

  ctx.save();
  ctx.setLineDash(state.dash);
  const configuredWidth = Math.max(0.4, state.width - source.depth * 0.15);
  ctx.lineWidth = state.preserveDetail
    ? configuredWidth / Math.max(0.05, state.zoom)
    : configuredWidth;
  
  const linkOpacity = state.isAttachedToDragged 
    ? 0.35 
    : state.dimmed ? 0.08 : state.opacity;

  ctx.strokeStyle = dim(state.color, linkOpacity);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);

  let c1 = start;
  let c2 = end;

  let elbow: { x: number; y: number }[] | null = null;
  if (state.mode === 'org-chart') {
    const top = sy <= ty;
    const a = { x: sx, y: sy + (top ? 1 : -1) * state.metricOf(source).height / 2 };
    const b = { x: tx, y: ty - (top ? 1 : -1) * state.metricOf(target).height / 2 };
    const midY = (a.y + b.y) / 2;
    elbow = [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b];
  } else if (state.mode === 'brace-map') {
    const a = { x: sx + state.metricOf(source).width / 2, y: sy };
    const b = { x: tx - state.metricOf(target).width / 2, y: ty };
    const midX = (a.x + b.x) / 2;
    elbow = [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  }

  if (elbow) {
    ctx.moveTo(elbow[0].x, elbow[0].y);
    const radius = 6;
    for (let i = 1; i < elbow.length - 1; i += 1) {
      ctx.arcTo(elbow[i].x, elbow[i].y, elbow[i + 1].x, elbow[i + 1].y, radius);
    }
    ctx.lineTo(elbow[elbow.length - 1].x, elbow[elbow.length - 1].y);
  } else if (state.mode === 'mindmap') {
    const dx = end.x - start.x;
    const k = 0.2 + state.curvature * 0.65;
    const bend = Math.sin(state.curveRotation) * Math.abs(dx) * state.curvature * 0.35;
    c1 = { x: start.x + k * dx, y: start.y + bend };
    c2 = { x: end.x - k * dx, y: end.y + bend };
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  } else if (state.mode === 'timeline') {
    const midX = start.x;
    const midY = end.y;
    ctx.lineTo(midX, midY);
    ctx.lineTo(end.x, end.y);
  } else if (state.mode === 'fishbone') {
    ctx.lineTo(end.x, end.y);
  } else {
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();

  const curved = state.mode === 'mindmap';
  if (elbow) {
    start.x = elbow[elbow.length - 2].x; start.y = elbow[elbow.length - 2].y;
    end.x = elbow[elbow.length - 1].x; end.y = elbow[elbow.length - 1].y;
  }
  const pointAt = (t: number) => curved
    ? { x: cubicPoint(start.x, c1.x, c2.x, end.x, t), y: cubicPoint(start.y, c1.y, c2.y, end.y, t) }
    : { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  const tangentAt = (t: number) => curved
    ? Math.atan2(cubicTangent(start.y, c1.y, c2.y, end.y, t), cubicTangent(start.x, c1.x, c2.x, end.x, t))
    : Math.atan2(end.y - start.y, end.x - start.x);

  // Panah relasi
  if (state.showArrow && state.arrowLength > 0 && !state.dimmed) {
    const len = state.preserveDetail
      ? state.arrowLength / Math.max(0.05, state.zoom)
      : state.arrowLength;
    const arrowT = Math.max(0.05, Math.min(1, state.arrowRelPos));
    const tip = pointAt(arrowT);
    const tangent = tangentAt(arrowT);
    ctx.setLineDash([]);
    ctx.fillStyle = dim(state.color, state.opacity);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - len * Math.cos(tangent - Math.PI / 7),
      tip.y - len * Math.sin(tangent - Math.PI / 7)
    );
    ctx.lineTo(
      tip.x - len * Math.cos(tangent + Math.PI / 7),
      tip.y - len * Math.sin(tangent + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
  }

  // ============= LINK DYNAMIC GLOW (FLOW PARTICLES) =============
  if (state.particles > 0 && !state.dimmed) {
    ctx.setLineDash([]);
    const baseRadius = state.preserveDetail
      ? state.particleWidth / Math.max(0.05, state.zoom) / 2
      : state.particleWidth / 2;
    const particleRadius = Math.max(0.85, baseRadius);

    for (let index = 0; index < state.particles; index += 1) {
      const t = (state.particleProgress + index / state.particles) % 1;
      const point = pointAt(t);

      // 1. Comet Tail (Ekor energi di belakang partikel)
      const tailCount = 3;
      for (let s = 1; s <= tailCount; s++) {
        const trailT = (t - s * 0.02 + 1) % 1;
        const trailPoint = pointAt(trailT);
        const trailAlpha = (1 - s / (tailCount + 1)) * 0.35 * state.opacity;
        ctx.fillStyle = dim(state.particleColor, trailAlpha);
        ctx.beginPath();
        ctx.arc(trailPoint.x, trailPoint.y, Math.max(0.5, particleRadius * (1 - s * 0.2)), 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Soft Dynamic Glow Halo (Aura radial gradient)
      const glowOuter = particleRadius * 2.8;
      const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowOuter);
      grad.addColorStop(0, dim(state.particleColor, 0.95 * state.opacity));
      grad.addColorStop(0.4, dim(state.particleColor, 0.4 * state.opacity));
      grad.addColorStop(1, dim(state.particleColor, 0));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(point.x, point.y, glowOuter, 0, Math.PI * 2);
      ctx.fill();

      // 3. Crisp Bright Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, particleRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}