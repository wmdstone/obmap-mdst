/** Card node renderer with level-of-detail and a collapse toggle hit region. */

import type { RenderNode } from '../model/graphTypes';
import type { NodeConfig } from '@/shared/stores/useGraphStore';
import { cardFont, cardLayout, CARD_FONT_SIZE } from './textLayout';
import { accentFor, dim, type GraphTheme } from './theme';

export interface DrawNodeState {
  theme: GraphTheme;
  zoom: number;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  collapsed: boolean;
  isRoot: boolean;
  showLabels: boolean;
  labelThreshold: number;
  preserveDetail: boolean;
  config: NodeConfig;
  /** 0..1 pulse phase for animated glow; static halo when omitted. */
  glowPhase?: number;
  isDragged?: boolean;
  isDropTarget?: boolean;
  dropTargetValid?: boolean;
}

/** Soft radial halo around a node marker, drawn beneath the node itself. */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity: number,
  phase: number,
  boost: number
) {
  const pulse = 0.65 + 0.35 * Math.sin(phase * Math.PI * 2);
  const strength = Math.max(0, Math.min(1, intensity)) * pulse * boost;
  if (strength <= 0.01) return;
  const outer = radius * (2.2 + intensity * 2.2);
  const gradient = ctx.createRadialGradient(x, y, radius * 0.4, x, y, outer);
  gradient.addColorStop(0, dim(color, 0.55 * strength));
  gradient.addColorStop(0.55, dim(color, 0.22 * strength));
  gradient.addColorStop(1, dim(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function labelForNode(node: RenderNode, config: NodeConfig): string {
  if (config.labelField === 'id') return node.id;
  return node.name || 'Untitled';
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: NodeConfig['shape'],
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else if (shape === 'square') {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const sides = shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : 6;
    const offset = shape === 'diamond' ? -Math.PI / 4 : -Math.PI / 2;
    for (let index = 0; index < sides; index += 1) {
      const angle = offset + (index * Math.PI * 2) / sides;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: RenderNode,
  state: DrawNodeState
) {
  const { theme, zoom } = state;
  if (!state.config.visible) {
    node.toggle = null;
    return;
  }
  const accent = accentFor(node, theme, state.selected);
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const alpha = state.dimmed ? 0.18 : theme.nodeOpacity;

  // Below the threshold only a marker is drawn.
  if (!state.preserveDetail && zoom < state.labelThreshold * 0.6) {
    if (state.config.glow && !state.dimmed) {
      drawGlow(ctx, x, y, 5, accent, state.config.glowIntensity, state.glowPhase ?? 0, state.selected || state.hovered ? 1.3 : 1);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    node.toggle = null;
    return;
  }

  // Keep the configured node appearance at a stable screen size. Canvas
  // coordinates are normally scaled by the camera, so counter-scale around
  // the node while leaving its graph position unchanged.
  const detailScale = state.preserveDetail ? 1 / Math.max(0.05, zoom) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(detailScale, detailScale);
  ctx.translate(-x, -y)

  if (state.isDragged) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
  }


  const label = labelForNode(node, state.config);
  const fontSize = state.config.labelSize + (state.isRoot ? 2 : 0);
  const boxed = state.config.labelBox;
  const layout = cardLayout(label, {
    root: state.isRoot,
    badge: node.childCount > 0,
    fontSize,
  });

  const depthScale = state.config.sizeByDepth
    ? Math.max(0.45, 1 - node.depth * state.config.depthSizeInterval * 0.08)
    : 1;
  const markerRadius = Math.max(3, state.config.relSize * depthScale);

  const w = boxed ? layout.width : markerRadius * 2;
  const h = boxed ? layout.height : markerRadius * 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // ============= NODE DEPTH & ELEVATION (SOFT GLOW & GLASSMORPHISM) =============
  const isElevated = state.selected || state.hovered;

  if (isElevated) {
    // Multi-layer ambient drop shadow (Physical depth)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 22;
  }

  if (boxed) {
    roundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
    
    // Background fill stabil
    ctx.fillStyle = state.config.labelBackground
      ? dim(theme.labelBackground, state.selected ? 0.95 : Math.max(0.72, state.config.opacity))
      : dim(accent, state.selected ? 0.35 : state.hovered ? 0.25 : 0.16);
    ctx.fill();

    // Reset shadow blur
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Outer border stroke: pertegas saat dipilih/di-hover tanpa mengubah ketebalan geometri
    ctx.lineWidth = state.selected ? 2 : 1;
    ctx.strokeStyle = state.selected 
      ? accent 
      : state.hovered 
        ? dim(accent, 0.85) 
        : dim(accent, 0.5);
    ctx.stroke();
  }


  // Configurable node marker.
  const markerX = boxed ? x - w / 2 + 9 : x;
  if (state.config.glow && !state.dimmed) {
    drawGlow(
      ctx,
      markerX,
      y,
      markerRadius,
      accent,
      state.config.glowIntensity,
      state.glowPhase ?? 0,
      state.selected || state.hovered ? 1.35 : 1
    );
  }
  ctx.fillStyle = accent;
  drawShape(ctx, state.config.shape, markerX, y, markerRadius);
  ctx.fill();
  if (!boxed && state.selected) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

    // Indikator target folder reparenting
  if (state.isDropTarget && state.dropTargetValid) {
    ctx.save();
    // Glow ring warna aksen
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(w, h) / 2 + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Badge kecil "masuk ke folder" di atas kartu
    const badgeText = "masuk ke folder";
    ctx.font = cardFont(9, '600');
    const badgeW = ctx.measureText(badgeText).width + 12;
    const badgeY = y - h / 2 - 14;

    ctx.fillStyle = accent;
    roundedRect(ctx, x - badgeW / 2, badgeY - 8, badgeW, 16, 4);
    ctx.fill();

    ctx.fillStyle = theme.card;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, x, badgeY);
    ctx.restore();
  }

    // ============= COLLAPSE BADGE (TAHAP 6) =============
  // — saat terbuka, pill +N saat tertutup
  if (node.childCount > 0) {
    ctx.save();
    ctx.globalAlpha = state.dimmed ? 0.25 : 1;

    if (state.collapsed) {
      // 1. TAMPILAN PILL "+N" SAAT TERTUTUP
      const pillText = `+${node.childCount}`;
      ctx.font = cardFont(9, '700');
      const textMetrics = ctx.measureText(pillText);
      const pillW = Math.max(22, textMetrics.width + 10);
      const pillH = 15;
      const tx = x + (boxed ? w / 2 : markerRadius) + pillW / 2 + 3;
      const ty = y;

      // Gambar kapsul pill
      ctx.fillStyle = theme.card;
      roundedRect(ctx, tx - pillW / 2, ty - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fill();

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = accent;
      ctx.stroke();

      // Tulisan teks +N
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, tx, ty);

      // Hit-area collapse toggle
      node.toggle = {
        x: x + (tx - x) * detailScale,
        y: y + (ty - y) * detailScale,
        r: Math.max(pillW / 2, 10) * detailScale,
      };
    } else {
      // 2. TAMPILAN CIRCLE MINUS "—" SAAT TERBUKA
      const r = 6;
      const tx = x + (boxed ? w / 2 : markerRadius) + r + 2;
      const ty = y;

      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fillStyle = theme.card;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dim(accent, 0.7);
      ctx.stroke();

      // Garis minus —
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx - 3, ty);
      ctx.lineTo(tx + 3, ty);
      ctx.stroke();

      // Hit-area collapse toggle
      node.toggle = {
        x: x + (tx - x) * detailScale,
        y: y + (ty - y) * detailScale,
        r: (r + 4) * detailScale,
      };
    }

    ctx.restore();
  } else {
    node.toggle = null;
  }


  if (state.showLabels && (state.preserveDetail || zoom >= state.labelThreshold * 0.6)) {
    const italic = state.config.labelFontStyle.includes('italic') ? 'italic ' : '';
    const weight = state.config.labelFontStyle.includes('bold') || state.isRoot ? '600' : '500';
    ctx.font = `${italic}${cardFont(fontSize, weight)}`;
    ctx.fillStyle = theme.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lineHeight = fontSize + 4;
    const startY = y - ((layout.lines.length - 1) * lineHeight) / 2;
    const textX = boxed
      ? x - w / 2 + Math.max(18, markerRadius * 2 + 7)
      : markerX + markerRadius + 5;
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, textX, startY + index * lineHeight);
    });
  }

  // Child-count badge.
  if (
    boxed &&
    node.childCount > 0 &&
    (state.preserveDetail || zoom >= state.labelThreshold)
  ) {
    ctx.font = cardFont(9, '600');
    ctx.fillStyle = dim(accent, 0.9);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(node.childCount), x + w / 2 - 14, y - h / 2 + 8);
  }

  ctx.restore();
}



/** Pointer area covers the card plus its toggle. */
export function paintNodePointerArea(
  ctx: CanvasRenderingContext2D,
  node: RenderNode,
  color: string,
  isRoot: boolean,
  config?: NodeConfig,
  zoom = 1,
  preserveDetail = false
) {
  if (config && !config.visible) return;
  const label = config ? labelForNode(node, config) : node.name;
  const layout = cardLayout(label, {
    root: isRoot,
    badge: node.childCount > 0,
    fontSize: (config?.labelSize ?? CARD_FONT_SIZE) + (isRoot ? 2 : 0),
  });
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const extra = node.childCount > 0 ? 32 : 0;
  const boxed = config ? config.labelBox : true;
  const markerRadius = Math.max(3, config?.relSize ?? 6);
  const width = boxed ? layout.width : markerRadius * 2;
  const height = boxed ? layout.height : markerRadius * 2;
  const detailScale = preserveDetail ? 1 / Math.max(0.05, zoom) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(detailScale, detailScale);
  ctx.translate(-x, -y);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y - height / 2, width + extra, height);
  ctx.restore();
}
