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
  config: NodeConfig;
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
  if (zoom < state.labelThreshold * 0.6) {
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

  const label = labelForNode(node, state.config);
  const fontSize = state.config.labelSize + (state.isRoot ? 2 : 0);
  const layout = cardLayout(label, {
    root: state.isRoot,
    badge: node.childCount > 0,
    fontSize,
  });
  const w = layout.width;
  const h = layout.height;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (state.selected || state.hovered) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = dim(accent, 0.75);
  }
  roundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
  ctx.fillStyle = state.config.labelBackground
    ? dim(theme.labelBackground, Math.max(0.72, state.config.opacity))
    : dim(accent, state.selected ? 0.32 : 0.16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = state.selected ? 2 : 1;
  ctx.strokeStyle = state.selected ? accent : dim(accent, 0.6);
  ctx.stroke();

  // Configurable node marker.
  const depthScale = state.config.sizeByDepth
    ? Math.max(0.45, 1 - node.depth * state.config.depthSizeInterval * 0.08)
    : 1;
  const markerRadius = Math.max(3, state.config.relSize * depthScale);
  const markerX = x - w / 2 + 9;
  ctx.fillStyle = accent;
  drawShape(ctx, state.config.shape, markerX, y, markerRadius);
  ctx.fill();

  if (state.showLabels && zoom >= state.labelThreshold * 0.6) {
    const italic = state.config.labelFontStyle.includes('italic') ? 'italic ' : '';
    const weight = state.config.labelFontStyle.includes('bold') || state.isRoot ? '600' : '500';
    ctx.font = `${italic}${cardFont(fontSize, weight)}`;
    ctx.fillStyle = theme.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lineHeight = fontSize + 4;
    const startY = y - ((layout.lines.length - 1) * lineHeight) / 2;
    const textX = x - w / 2 + Math.max(18, markerRadius * 2 + 7);
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, textX, startY + index * lineHeight);
    });
  }

  // Child-count badge.
  if (node.childCount > 0 && zoom >= state.labelThreshold) {
    ctx.font = cardFont(9, '600');
    ctx.fillStyle = dim(accent, 0.9);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(node.childCount), x + w / 2 - 14, y - h / 2 + 8);
  }

  ctx.restore();

  // Collapse toggle on the outward edge of branch nodes.
  if (node.childCount > 0) {
    const r = 6;
    const tx = x + w / 2 + r + 2;
    const ty = y;
    ctx.save();
    ctx.globalAlpha = state.dimmed ? 0.25 : 1;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fillStyle = theme.card;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dim(accent, 0.8);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty);
    ctx.lineTo(tx + 3, ty);
    if (state.collapsed) {
      ctx.moveTo(tx, ty - 3);
      ctx.lineTo(tx, ty + 3);
    }
    ctx.stroke();
    ctx.restore();
    node.toggle = { x: tx, y: ty, r: r + 3 };
  } else {
    node.toggle = null;
  }
}

/** Pointer area covers the card plus its toggle. */
export function paintNodePointerArea(
  ctx: CanvasRenderingContext2D,
  node: RenderNode,
  color: string,
  isRoot: boolean,
  config?: NodeConfig
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
  const extra = node.childCount > 0 ? 18 : 0;
  ctx.fillStyle = color;
  ctx.fillRect(
    x - layout.width / 2,
    y - layout.height / 2,
    layout.width + extra,
    layout.height
  );
}
