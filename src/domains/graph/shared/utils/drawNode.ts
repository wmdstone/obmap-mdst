/** Card node renderer with level-of-detail and a collapse toggle hit region. */

import type { RenderNode } from '@/domains/graph/shared/model/graphTypes';
import type { NodeConfig } from '@/domains/graph/shared/stores/useGraphStore';
import { cardFont, cardLayout, CARD_FONT_SIZE } from '@/domains/graph/shared/utils/textLayout';
import { accentFor, dim, type GraphTheme } from '@/domains/graph/shared/utils/theme';


export type FormatItemType = 'folder' | 'pdf' | 'image' | 'audio' | 'video' | 'file';

export function resolveNodeFormat(node: RenderNode): FormatItemType {
  if (node.type === 'folder') return 'folder';
  if (node.type === 'pdf' || (node.type === 'media' && node.mediaType === 'pdf')) return 'pdf';
  if (node.type === 'media') {
    if (node.mediaType === 'image') return 'image';
    if (node.mediaType === 'audio') return 'audio';
    if (node.mediaType === 'video') return 'video';
  }
  return 'file';
}

export function formatColorForNode(format: FormatItemType, fallbackAccent: string): string {
  switch (format) {
    case 'folder': return '#eab308'; // yellow-500
    case 'pdf': return '#f43f5e';    // rose-500
    case 'image': return '#10b981';  // emerald-500
    case 'audio': return '#a855f7';  // purple-500
    case 'video': return '#ef4444';  // red-500
    case 'file': return fallbackAccent;
  }
}

// Cache objek Path2D Lucide (viewBox 24x24)
const ICON_PATHS = {
  folder: new Path2D(
    "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
  ),
  fileText: new Path2D(
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"
  ),
  image: new Path2D(
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
  ),
  music: new Path2D(
    "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
  ),
  video: new Path2D(
    "M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM16 13l5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"
  ),
};

function drawFormatIcon(
  ctx: CanvasRenderingContext2D,
  format: FormatItemType,
  x: number,
  y: number,
  radius: number,
  color: string,
  boxed: boolean,
  isSelected: boolean
) {
  const path =
    format === 'folder'
      ? ICON_PATHS.folder
      : format === 'image'
      ? ICON_PATHS.image
      : format === 'audio'
      ? ICON_PATHS.music
      : format === 'video'
      ? ICON_PATHS.video
      : ICON_PATHS.fileText;

  // Ukuran icon proporsional terhadap radius node
  const iconSize = Math.max(12, radius * 2.2);
  const scale = iconSize / 24;

  ctx.save();

  // Reset shadow agar tidak ada bayangan lingkaran atau blur yang bocor ke icon
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Translasi ke titik tengah dan skalakan ke 24x24
  ctx.translate(x - iconSize / 2, y - iconSize / 2);
  ctx.scale(scale, scale);

  // Stroke icon murni tanpa lingkaran disc di belakangnya
  ctx.strokeStyle = isSelected ? '#ffffff' : color;
  ctx.lineWidth = isSelected ? 2.2 : 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(path);

  ctx.restore();
}


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

// src/domains/graph/render/drawNode.ts

/**
 * Menghasilkan bentuk geometris node secara dinamis berdasarkan format berkas.
 * Menjamin pemisahan: Bentuk mewakili Format, Warna mewakili Hierarki/Tags.
 */
export function resolveNodeShape(
  node: RenderNode,
  config: NodeConfig
): NodeConfig['shape'] {
  if (!config.autoShapeByFormat) {
    return config.shape;
  }

  // 1. Wadah Folder
  if (node.type === 'folder') {
    return 'hexagon';
  }

  // 2. Format Media (Gambar, Audio/Voice, PDF)
  if (node.type === 'media') {
    if (node.mediaType === 'image') return 'square';
    if (node.mediaType === 'audio') return 'triangle';
    if (node.mediaType === 'pdf') return 'diamond';
    if (node.mediaType === 'video') return 'hexagon';
    return 'square';
  }

  // 3. Catatan File Markdown / Text biasa
  return 'circle';
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

  const resolvedShape = resolveNodeShape(node, state.config);

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

  const useFormatIcons =
    Boolean(state.config.autoShapeByFormat) &&
    state.config.formatMarkerStyle === 'icons';
  const nodeFormat = resolveNodeFormat(node);
  const iconColor = formatColorForNode(nodeFormat, accent);

  if (useFormatIcons) {
    // Render ikon Lucide asli yang identik dengan File Explorer
    drawFormatIcon(
      ctx,
      nodeFormat,
      markerX,
      y,
      markerRadius,
      iconColor,
      boxed,
      state.selected
    );
  } else {
    // Render bentuk geometri
    ctx.fillStyle = accent;
    drawShape(ctx, resolvedShape, markerX, y, markerRadius);
    ctx.fill();
    if (!boxed && state.selected) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke();
    }
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

  
  // Selalu tampilkan label teks jika diaktifkan
  if (state.showLabels) {
    const italic = state.config.labelFontStyle.includes('italic') ? 'italic ' : '';
    const weight = state.config.labelFontStyle.includes('bold') || state.isRoot ? '600' : '500';
    ctx.font = `${italic}${cardFont(fontSize, weight)}`;
    ctx.fillStyle = theme.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lineHeight = fontSize + 4;
    const startY = y - ((layout.lines.length - 1) * lineHeight) / 2;

    // Hitung offset ruang tombol collapse agar tidak menutupi huruf awal
    let toggleOffset = 0;
    if (!boxed && node.childCount > 0) {
      toggleOffset = state.collapsed ? 28 : 18;
    }

    const textX = boxed
      ? x - w / 2 + Math.max(18, markerRadius * 2 + 7)
      : markerX + markerRadius + 5 + toggleOffset;

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
