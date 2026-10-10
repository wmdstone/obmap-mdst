/** Mini-map panel content. Overlay state and controls live in GraphBottomOverlays. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { colorWithOpacity, resolveColor } from '@/shared/lib/color-utils';
import type { RenderLink, RenderNode } from './model/graphTypes';

export interface GraphMiniMapProps {
  nodes: RenderNode[];
  links: RenderLink[];
  graphRef: React.MutableRefObject<ForceGraphMethods<RenderNode, RenderLink> | undefined>;
  viewportWidth: number;
  viewportHeight: number;
  folderColor?: string;
  fileColor?: string;
  linkColor?: string;
  selectedNodeId?: string | null;
}

export function GraphMiniMap({
  nodes, links, graphRef, viewportWidth, viewportHeight,
  folderColor = 'hsl(var(--primary))',
  fileColor = 'hsl(var(--muted-foreground))',
  linkColor = 'hsl(var(--muted-foreground))', selectedNodeId,
}: GraphMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 216, height: 144 });
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = size;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const positioned = nodes.flatMap((node) => {
      const { x, y } = node;
      return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
        ? [{ node, x, y }] : [];
    });
    if (!positioned.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const { x, y } of positioned) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    minX -= 30; maxX += 30; minY -= 30; maxY += 30;
    const scale = Math.min(width / (maxX - minX), height / (maxY - minY)) * 0.9;
    const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;
    transformRef.current = { scale, offsetX, offsetY };
    const byId = new Map(positioned.map((point) => [point.node.id, point]));
    ctx.strokeStyle = colorWithOpacity(linkColor, 0.35);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (const link of links) {
      const source = byId.get(typeof link.source === 'string' ? link.source : link.source.id);
      const target = byId.get(typeof link.target === 'string' ? link.target : link.target.id);
      if (!source || !target) continue;
      ctx.moveTo(source.x * scale + offsetX, source.y * scale + offsetY);
      ctx.lineTo(target.x * scale + offsetX, target.y * scale + offsetY);
    }
    ctx.stroke();
    for (const { node, x, y } of positioned) {
      ctx.fillStyle = resolveColor(node.id === selectedNodeId ? 'hsl(var(--primary))'
        : node.type === 'folder' ? folderColor : fileColor);
      ctx.beginPath();
      ctx.arc(x * scale + offsetX, y * scale + offsetY, node.type === 'folder' ? 2.5 : 1.75, 0, Math.PI * 2);
      ctx.fill();
    }
    const graph = graphRef.current;
    if (!graph) return;
    const zoom = graph.zoom();
    const center = graph.centerAt();
    if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return;
    const x = (center.x - viewportWidth / zoom / 2) * scale + offsetX;
    const y = (center.y - viewportHeight / zoom / 2) * scale + offsetY;
    const w = viewportWidth / zoom * scale;
    const h = viewportHeight / zoom * scale;
    ctx.fillStyle = colorWithOpacity('hsl(var(--primary))', 0.08);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = resolveColor('hsl(var(--primary))');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }, [nodes, links, graphRef, viewportWidth, viewportHeight, folderColor, fileColor, linkColor, selectedNodeId, size]);

  useEffect(() => {
    render();
    const interval = window.setInterval(render, 100);
    return () => window.clearInterval(interval);
  }, [render]);

  const navigate = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!nodes.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { scale, offsetX, offsetY } = transformRef.current;
    if (!rect.width || !rect.height || scale <= 0) return;
    const x = (event.clientX - rect.left) * size.width / rect.width;
    const y = (event.clientY - rect.top) * size.height / rect.height;
    graphRef.current?.centerAt((x - offsetX) / scale, (y - offsetY) / scale, 350);
  };

  return (
    <div className="min-w-0 p-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={204}
          height={120}
          className="w-full h-[120px] rounded bg-muted/20 border border-border/30 cursor-crosshair"
        />
        {nodes.length === 0 && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No nodes</span>}
      </div>
      <div className="flex min-w-0 justify-between gap-2 pt-2 text-[10px] text-muted-foreground">
        <span className="truncate">{nodes.length} nodes</span>
        <span className="truncate">{links.length} links</span>
      </div>
    </div>
  );
}
