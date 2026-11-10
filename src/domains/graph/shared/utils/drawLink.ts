/**
 * Layout-aware link rendering with Precision Orthogonal Routing for Timeline,
 * Bezier branches for Mindmaps, and Clean Straight links for Networks.
 */

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

interface Point {
  x: number;
  y: number;
}

interface LinkGeometry {
  trace: (ctx: CanvasRenderingContext2D) => void;
  pointAt: (t: number) => Point;
  tangentAt: (t: number) => number;
}

// ==========================================
// PURE MATH & UTILITIES
// ==========================================

const cubicPoint = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const cubicTangent = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
};

// ==========================================
// PRECISION TIMELINE ORTHOGONAL ROUTING (XMIND-GRADE)
// ==========================================

// Tambahkan boxed ke DrawLinkState
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
  boxed?: boolean; // <-- Deteksi apakah node berupa kotak bento atau dot lingkaran
}

// ==========================================
// PRECISION TIMELINE & XMIND TREE ROUTING
// ==========================================

function createTimelineGeometry(
  source: RenderNode,
  target: RenderNode,
  metricOf: (node: RenderNode) => NodeMetric,
  boxed = false,
  curvature = 0
): LinkGeometry {
  const sx = source.x ?? 0;
  const sy = source.y ?? 0;
  const tx = target.x ?? 0;
  const ty = target.y ?? 0;

  const sMetric = metricOf(source);
  const tMetric = metricOf(target);

  // 1. Target Anchor: Jika unboxed, garis langsung masuk ke dot lingkaran (tx, ty)
  //    Jika boxed, garis masuk ke tepi kiri kotak bento (tx - width/2, ty)
  const targetX = boxed ? tx - tMetric.width / 2 : tx;
  const targetY = ty;

  // 2. Hubungan dari Baseline Waktu (y = 0) ke Milestone Utama
  const isFromBaseline = Math.abs(sy) < 5;
  if (isFromBaseline) {
    const a: Point = { x: sx + (boxed ? sMetric.width / 2 : sMetric.width), y: sy };
    const b: Point = {
      x: tx,
      y: ty < sy ? ty + (boxed ? tMetric.height / 2 : 6) : ty - (boxed ? tMetric.height / 2 : 6),
    };
    return createElbowGeometry([a, { x: tx, y: a.y }, b], 8);
  }

  // 3. Hubungan Milestone Utama ke Kolom Level 2 (Tiang vertikal lurus + rak horizontal)
  const isTrunkLink = Math.abs(tx - sx) <= 50;
  if (isTrunkLink) {
    const a: Point = {
      x: sx,
      y: sy < 0 ? sy - (boxed ? sMetric.height / 2 : 6) : sy + (boxed ? sMetric.height / 2 : 6),
    };
    const b: Point = { x: targetX, y: targetY };
    return createElbowGeometry([a, { x: sx, y: b.y }, b], 6);
  }

  // 4. Hubungan Cabang Level 2+ ke Anak-anaknya (Level 3 s.d. Level 15)
  // Garis keluar SETELAH teks induk agar tulisan tidak tertembus garis
  const sourceRightX = boxed ? sx + sMetric.width / 2 : sx + sMetric.width + 4;
  const sourceY = sy;

  const dx = targetX - sourceRightX;
  const dy = targetY - sourceY;

  // Jika anak berada tepat sejajar horizontal
  if (Math.abs(dy) < 3) {
    return createStraightGeometry({ x: sourceRightX, y: sourceY }, { x: targetX, y: targetY });
  }

  // Gaya Cabang XMind: S-Curve Bezier halus yang memancar tanpa pernah bertumpuk
  // Jika curvature > 0 atau mode pohon bertingkat
  const k = 0.42;
  const c1 = { x: sourceRightX + dx * k, y: sourceY };
  const c2 = { x: targetX - dx * k, y: targetY };

  return {
    trace: (ctx) => {
      ctx.moveTo(sourceRightX, sourceY);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, targetX, targetY);
    },
    pointAt: (t) => ({
      x: cubicPoint(sourceRightX, c1.x, c2.x, targetX, t),
      y: cubicPoint(sourceY, c1.y, c2.y, targetY, t),
    }),
    tangentAt: (t) =>
      Math.atan2(
        cubicTangent(sourceY, c1.y, c2.y, targetY, t),
        cubicTangent(sourceRightX, c1.x, c2.x, targetX, t)
      ),
  };
}

// ==========================================
// STANDARD GEOMETRIES (MINDMAP, ELBOW, STRAIGHT)
// ==========================================

function createStraightGeometry(start: Point, end: Point): LinkGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    trace: (ctx) => {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    },
    pointAt: (t) => ({ x: start.x + dx * t, y: start.y + dy * t }),
    tangentAt: () => Math.atan2(dy, dx),
  };
}

function createMindmapBezierGeometry(
  start: Point,
  end: Point,
  curvature: number,
  curveRotation: number
): LinkGeometry {
  const dx = end.x - start.x;
  const k = 0.2 + curvature * 0.65;
  const bend = Math.sin(curveRotation) * Math.abs(dx) * curvature * 0.35;
  const c1 = { x: start.x + k * dx, y: start.y + bend };
  const c2 = { x: end.x - k * dx, y: end.y + bend };

  return {
    trace: (ctx) => {
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    },
    pointAt: (t) => ({
      x: cubicPoint(start.x, c1.x, c2.x, end.x, t),
      y: cubicPoint(start.y, c1.y, c2.y, end.y, t),
    }),
    tangentAt: (t) =>
      Math.atan2(
        cubicTangent(start.y, c1.y, c2.y, end.y, t),
        cubicTangent(start.x, c1.x, c2.x, end.x, t)
      ),
  };
}

function createElbowGeometry(points: Point[], cornerRadius = 6): LinkGeometry {
  const lastIndex = points.length - 1;
  const a = points[lastIndex - 1];
  const b = points[lastIndex];
  return {
    trace: (ctx) => {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < lastIndex; i++) {
        ctx.arcTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, cornerRadius);
      }
      ctx.lineTo(points[lastIndex].x, points[lastIndex].y);
    },
    pointAt: (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
    tangentAt: () => Math.atan2(b.y - a.y, b.x - a.x),
  };
}

// ==========================================
// MAIN LINK RENDERER
// ==========================================

export function drawLink(
  ctx: CanvasRenderingContext2D,
  source: RenderNode,
  target: RenderNode,
  state: DrawLinkState
): void {
  const sx = source.x ?? 0;
  const sy = source.y ?? 0;
  const tx = target.x ?? 0;
  const ty = target.y ?? 0;
  if (![sx, sy, tx, ty].every(Number.isFinite)) return;

  ctx.save();
  ctx.setLineDash(state.dash);
  ctx.lineCap = 'round';

  const configuredWidth = Math.max(0.4, state.width - source.depth * 0.15);
  ctx.lineWidth = state.preserveDetail
    ? configuredWidth / Math.max(0.05, state.zoom)
    : configuredWidth;

  const linkOpacity = state.isAttachedToDragged ? 0.35 : state.dimmed ? 0.08 : state.opacity;
  ctx.strokeStyle = dim(state.color, linkOpacity);

  let geometry: LinkGeometry;

  if (state.mode === 'timeline') {
    geometry = createTimelineGeometry(
      source,
      target,
      state.metricOf,
      state.boxed ?? false,
      state.curvature
    );
  }
else if (state.mode === 'org-chart') {
    const top = sy <= ty;
    const a = { x: sx, y: sy + (top ? 1 : -1) * (state.metricOf(source).height / 2) };
    const b = { x: tx, y: ty - (top ? 1 : -1) * (state.metricOf(target).height / 2) };
    const midY = (a.y + b.y) / 2;
    geometry = createElbowGeometry([a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]);
  } else if (state.mode === 'brace-map') {
    const a = { x: sx + state.metricOf(source).width / 2, y: sy };
    const b = { x: tx - state.metricOf(target).width / 2, y: ty };
    const midX = (a.x + b.x) / 2;
    geometry = createElbowGeometry([a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]);
  } else if (state.mode === 'mindmap') {
    const start = anchorOnCard({ x: sx, y: sy }, state.metricOf(source), { x: tx, y: ty });
    const end = anchorOnCard({ x: tx, y: ty }, state.metricOf(target), { x: sx, y: sy });
    geometry = createMindmapBezierGeometry(start, end, state.curvature, state.curveRotation);
  } else {
    const start = anchorOnCard({ x: sx, y: sy }, state.metricOf(source), { x: tx, y: ty });
    const end = anchorOnCard({ x: tx, y: ty }, state.metricOf(target), { x: sx, y: sy });
    geometry = createStraightGeometry(start, end);
  }

  ctx.beginPath();
  geometry.trace(ctx);
  ctx.stroke();

  // Relasi Panah
  if (state.showArrow && state.arrowLength > 0 && !state.dimmed) {
    const len = state.preserveDetail ? state.arrowLength / Math.max(0.05, state.zoom) : state.arrowLength;
    const arrowT = Math.max(0.05, Math.min(1, state.arrowRelPos));
    const tip = geometry.pointAt(arrowT);
    const tangent = geometry.tangentAt(arrowT);

    ctx.setLineDash([]);
    ctx.fillStyle = dim(state.color, state.opacity);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - len * Math.cos(tangent - Math.PI / 7), tip.y - len * Math.sin(tangent - Math.PI / 7));
    ctx.lineTo(tip.x - len * Math.cos(tangent + Math.PI / 7), tip.y - len * Math.sin(tangent + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  }

  // Flow Particles
  if (state.particles > 0 && !state.dimmed) {
    ctx.setLineDash([]);
    const baseRadius = state.preserveDetail ? state.particleWidth / Math.max(0.05, state.zoom) / 2 : state.particleWidth / 2;
    const particleRadius = Math.max(0.85, baseRadius);

    for (let index = 0; index < state.particles; index += 1) {
      const t = (state.particleProgress + index / state.particles) % 1;
      const point = geometry.pointAt(t);

      // Comet Tail
      for (let s = 1; s <= 3; s++) {
        const trailT = (t - s * 0.02 + 1) % 1;
        const trailPoint = geometry.pointAt(trailT);
        ctx.fillStyle = dim(state.particleColor, (1 - s / 4) * 0.35 * state.opacity);
        ctx.beginPath();
        ctx.arc(trailPoint.x, trailPoint.y, Math.max(0.5, particleRadius * (1 - s * 0.2)), 0, Math.PI * 2);
        ctx.fill();
      }

      // Glow Halo
      const glowOuter = particleRadius * 2.8;
      const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowOuter);
      grad.addColorStop(0, dim(state.particleColor, 0.95 * state.opacity));
      grad.addColorStop(0.4, dim(state.particleColor, 0.4 * state.opacity));
      grad.addColorStop(1, dim(state.particleColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(point.x, point.y, glowOuter, 0, Math.PI * 2);
      ctx.fill();

      // Crisp Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, particleRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}