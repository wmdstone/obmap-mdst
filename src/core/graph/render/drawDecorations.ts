/** Axis, spine and rib decorations, drawn once per frame before links. */

import type { FishboneRib, FishboneSpine, LayoutDecoration } from '../model/graphTypes';
import { cardFont } from './textLayout';
import { dim, type GraphTheme } from './theme';

export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  decorations: LayoutDecoration[],
  theme: GraphTheme,
  zoom: number,
  fishboneStyle?: { color: string; opacity: number; width: number; dash: number[] },
  /** Hierarchy-level paint for spine/rib geometry; null keeps the type style. */
  hierarchyPaint?: (
    decoration: FishboneSpine | FishboneRib
  ) => { color: string; opacity?: number } | null,
  preserveDetail = false
) {
  if (!decorations.length) return;
  ctx.save();
  for (const decoration of decorations) {
    if (decoration.kind === 'timeline-axis') {
      ctx.strokeStyle = dim(theme.decoration, 0.5);
      ctx.lineWidth = preserveDetail ? 1.5 / Math.max(0.05, zoom) : 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(decoration.x1, decoration.y);
      ctx.lineTo(decoration.x2, decoration.y);
      ctx.stroke();

      ctx.font = cardFont(10, '500');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const tick of decoration.ticks) {
        ctx.strokeStyle = dim(theme.decoration, 0.25);
        ctx.lineWidth = preserveDetail ? 1 / Math.max(0.05, zoom) : 1;
        ctx.beginPath();
        ctx.moveTo(tick.x, decoration.y - 6);
        ctx.lineTo(tick.x, decoration.y + 6);
        ctx.stroke();
        if (zoom > 0.4) {
          ctx.fillStyle = dim(theme.label, 0.75);
          ctx.fillText(tick.label, tick.x, decoration.y + 10);
        }
      }
    } else if (decoration.kind === 'fishbone-spine') {
      const paint = hierarchyPaint?.(decoration) ?? null;
      ctx.strokeStyle = dim(
        paint?.color ?? fishboneStyle?.color ?? theme.decoration,
        paint?.opacity ?? fishboneStyle?.opacity ?? 0.8
      );
      const spineWidth = Math.max(2, (fishboneStyle?.width ?? 2) * 1.4);
      ctx.lineWidth = preserveDetail ? spineWidth / Math.max(0.05, zoom) : spineWidth;
      ctx.setLineDash(fishboneStyle?.dash ?? []);
      ctx.beginPath();
      ctx.moveTo(decoration.x1, decoration.y1);
      ctx.lineTo(decoration.x2, decoration.y2);
      ctx.stroke();
    } else {
      const paint = hierarchyPaint?.(decoration) ?? null;
      const opacity = paint?.opacity ?? fishboneStyle?.opacity ?? 0.8;
      const width = fishboneStyle?.width ?? 2;
      ctx.strokeStyle = dim(
        paint?.color ?? fishboneStyle?.color ?? theme.decoration,
        decoration.major ? opacity : opacity * 0.65
      );
      const ribWidth = decoration.major ? width : Math.max(0.75, width * 0.65);
      ctx.lineWidth = preserveDetail ? ribWidth / Math.max(0.05, zoom) : ribWidth;
      ctx.setLineDash(fishboneStyle?.dash ?? []);
      ctx.beginPath();
      ctx.moveTo(decoration.x1, decoration.y1);
      ctx.lineTo(decoration.x2, decoration.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
