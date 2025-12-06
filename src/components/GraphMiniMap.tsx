/**
 * GraphMiniMap - Mini-map overview of the network graph
 * Shows a bird's eye view with viewport indicator and click-to-navigate
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Map, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Node {
  id: string;
  name: string;
  type: "folder" | "file" | "media";
  x?: number;
  y?: number;
  mediaType?: "image" | "audio" | "video";
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface GraphMiniMapProps {
  nodes: Node[];
  links: Link[];
  graphRef: React.MutableRefObject<any>;
  folderColor?: string;
  fileColor?: string;
  linkColor?: string;
  selectedNodeId?: string | null;
}

export function GraphMiniMap({
  nodes,
  links,
  graphRef,
  folderColor = 'hsl(48, 100%, 60%)',
  fileColor = 'hsl(270, 70%, 65%)',
  linkColor = 'hsl(var(--primary))',
  selectedNodeId,
}: GraphMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLarge, setIsLarge] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const animationRef = useRef<number>();

  const size = isLarge ? { width: 280, height: 200 } : { width: 180, height: 130 };

  // Calculate bounds of all nodes
  const getBounds = useCallback(() => {
    if (nodes.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    
    const validNodes = nodes.filter(n => n.x !== undefined && n.y !== undefined);
    if (validNodes.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };

    const padding = 50;
    const xs = validNodes.map(n => n.x!);
    const ys = validNodes.map(n => n.y!);
    
    return {
      minX: Math.min(...xs) - padding,
      maxX: Math.max(...xs) + padding,
      minY: Math.min(...ys) - padding,
      maxY: Math.max(...ys) + padding,
    };
  }, [nodes]);

  // Render mini-map
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = size;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'hsl(var(--card) / 0.95)';
    ctx.fillRect(0, 0, width, height);

    const bounds = getBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;

    // Scale to fit
    const scaleX = width / graphWidth;
    const scaleY = height / graphHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (width - graphWidth * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - graphHeight * scale) / 2 - bounds.minY * scale;

    // Draw links
    ctx.strokeStyle = 'hsl(var(--muted-foreground) / 0.3)';
    ctx.lineWidth = 0.5;
    links.forEach(link => {
      const sourceNode = typeof link.source === 'string' 
        ? nodes.find(n => n.id === link.source)
        : link.source;
      const targetNode = typeof link.target === 'string'
        ? nodes.find(n => n.id === link.target)
        : link.target;

      if (sourceNode?.x !== undefined && targetNode?.x !== undefined) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x * scale + offsetX, sourceNode.y! * scale + offsetY);
        ctx.lineTo(targetNode.x * scale + offsetX, targetNode.y! * scale + offsetY);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;

      const x = node.x * scale + offsetX;
      const y = node.y * scale + offsetY;
      const nodeSize = node.type === 'folder' ? 3 : 2;

      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
      
      if (selectedNodeId === node.id) {
        ctx.fillStyle = 'hsl(var(--accent))';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'hsl(var(--accent))';
      } else {
        ctx.fillStyle = node.type === 'folder' ? folderColor : fileColor;
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw viewport rectangle
    if (graphRef.current) {
      try {
        const fg = graphRef.current;
        const { x, y, k } = fg.zoom?.() || { x: 0, y: 0, k: 1 };
        const containerWidth = fg.width?.() || window.innerWidth;
        const containerHeight = fg.height?.() || window.innerHeight;

        const vpWidth = containerWidth / k;
        const vpHeight = containerHeight / k;
        const vpX = -x / k;
        const vpY = -y / k;

        // Transform viewport coords to mini-map coords
        const mapVpX = vpX * scale + offsetX;
        const mapVpY = vpY * scale + offsetY;
        const mapVpWidth = vpWidth * scale;
        const mapVpHeight = vpHeight * scale;

        // Draw viewport rectangle
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(mapVpX, mapVpY, mapVpWidth, mapVpHeight);
        ctx.setLineDash([]);

        // Fill with semi-transparent
        ctx.fillStyle = 'hsl(var(--primary) / 0.1)';
        ctx.fillRect(mapVpX, mapVpY, mapVpWidth, mapVpHeight);

        setViewport({ x: vpX, y: vpY, width: vpWidth, height: vpHeight });
      } catch (e) {
        // Ignore zoom errors
      }
    }
  }, [nodes, links, size, getBounds, folderColor, fileColor, selectedNodeId, graphRef]);

  // Periodic render with throttling (not in render callback to avoid infinite loop)
  useEffect(() => {
    if (!isExpanded) return;
    
    // Initial render
    render();
    
    // Periodic updates for viewport tracking
    const intervalId = setInterval(() => {
      render();
    }, 100);
    
    return () => {
      clearInterval(intervalId);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isExpanded, render]);

  // Handle click to navigate
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !graphRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bounds = getBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;

    const scaleX = size.width / graphWidth;
    const scaleY = size.height / graphHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (size.width - graphWidth * scale) / 2 - bounds.minX * scale;
    const offsetY = (size.height - graphHeight * scale) / 2 - bounds.minY * scale;

    // Convert click to graph coordinates
    const graphX = (clickX - offsetX) / scale;
    const graphY = (clickY - offsetY) / scale;

    // Center the view on clicked position
    graphRef.current.centerAt(graphX, graphY, 500);
  }, [getBounds, size, graphRef]);

  if (!isExpanded) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="absolute bottom-4 right-4 z-10 shadow-lg gap-2"
      >
        <Map className="w-4 h-4" />
        Mini-Map
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-10 rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden transition-all duration-200",
        isLarge ? "w-[280px]" : "w-[180px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/50">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Map className="w-3 h-3" />
          <span>Mini-Map</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setIsLarge(!isLarge)}
          >
            {isLarge ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setIsExpanded(false)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
        className="cursor-crosshair"
        onClick={handleCanvasClick}
      />

      {/* Stats footer */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
        <span>{nodes.length} nodes</span>
        <span>{links.length} links</span>
      </div>
    </div>
  );
}
