import { useState, useRef, useCallback } from "react";
import type { Node } from "@/shared/stores/types";
import type { RenderNode } from "../model/graphTypes";

export interface UseCanvasGestureBridgeOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  graphRef: React.RefObject<any>;
  zoomRef: React.MutableRefObject<number>;
  nodes: RenderNode[];
  rawNodes: Node[];
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  onNodeOpen?: (node: Node) => void;
  onToggleCollapse: (nodeId: string) => void;
  setSelected: (id: string | null) => void;
  onCanvasInteraction?: () => void;
}

export function useCanvasGestureBridge({
  containerRef,
  graphRef,
  zoomRef,
  nodes,
  rawNodes,
  selectedNode,
  onNodeSelect,
  onNodeOpen,
  onToggleCollapse,
  setSelected,
  onCanvasInteraction,
}: UseCanvasGestureBridgeOptions) {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [toolbarCoords, setToolbarCoords] = useState<{ x: number; y: number } | null>(null);

  // Tracker untuk deteksi double tap di touchpad / mobile screen
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  // Update posisi toolbar saat node terpilih bergerak atau kamera dizoom/pan
  const updateToolbarPosition = useCallback(() => {
    if (!selectedNode || !graphRef.current) {
      if (toolbarCoords !== null) setToolbarCoords(null);
      return;
    }

    const renderNode = nodes.find((n) => n.id === selectedNode.id);
    if (!renderNode || renderNode.x === undefined || renderNode.y === undefined) {
      if (toolbarCoords !== null) setToolbarCoords(null);
      return;
    }

    const screenPos = graphRef.current.graph2ScreenCoords?.(renderNode.x, renderNode.y);
    if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
      setToolbarCoords({ x: screenPos.x, y: screenPos.y });
    }
  }, [selectedNode, nodes, toolbarCoords, graphRef]);

  // 1. Single click: Select node / Toggle Collapse | Double click: Buka note editor tab
  const handleClick = useCallback(
    (node: RenderNode, event: MouseEvent | TouchEvent) => {
      onCanvasInteraction?.();
      // A. Deteksi klik pada tombol collapse / expand (— atau +N)
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const mouseEvt = event as MouseEvent;

      const screenX =
        mouseEvt.clientX !== undefined && rect
          ? mouseEvt.clientX - rect.left
          : "offsetX" in mouseEvt && typeof mouseEvt.offsetX === "number"
            ? mouseEvt.offsetX
            : 0;

      const screenY =
        mouseEvt.clientY !== undefined && rect
          ? mouseEvt.clientY - rect.top
          : "offsetY" in mouseEvt && typeof mouseEvt.offsetY === "number"
            ? mouseEvt.offsetY
            : 0;

      const coords = graphRef.current?.screen2GraphCoords?.(screenX, screenY);
      const toggle = node.toggle;

      if (coords && toggle) {
        const distance = Math.hypot(coords.x - toggle.x, coords.y - toggle.y);
        if (distance <= toggle.r + 4) {
          onToggleCollapse(node.id);
          setIsToolbarVisible(false);
          return;
        }
      }

      // B. Deteksi double click (buka tab editor)
      const matchedNode = rawNodes.find((item) => item.id === node.id) ?? null;
      const now = Date.now();
      const last = lastTapRef.current;
      const isDoubleClick =
        (last.id === node.id && now - last.time < 350) ||
        (event as MouseEvent).detail === 2;
      lastTapRef.current = { id: node.id, time: now };

      if (isDoubleClick) {
        if (matchedNode) {
          onNodeOpen?.(matchedNode);
        }
        setIsToolbarVisible(false);
        return;
      }

      // C. Single click biasa: seleksi node
      setSelected(node.id);
      onNodeSelect(matchedNode);
      setIsToolbarVisible(false);
    },
    [containerRef, graphRef, onToggleCollapse, rawNodes, onNodeOpen, setSelected, onNodeSelect, onCanvasInteraction]
  );

  // 2. Klik kanan: trigger floating toolbar
  const handleNodeRightClick = useCallback(
    (node: RenderNode, event: MouseEvent) => {
      event.preventDefault?.();
      onCanvasInteraction?.();
      const matchedNode = rawNodes.find((item) => item.id === node.id) ?? null;

      setSelected(node.id);
      onNodeSelect(matchedNode);
      setIsToolbarVisible(true);

      const screenPos = graphRef.current?.graph2ScreenCoords?.(node.x ?? 0, node.y ?? 0);
      if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
        setToolbarCoords({ x: screenPos.x, y: screenPos.y });
      }
    },
    [graphRef, rawNodes, setSelected, onNodeSelect, onCanvasInteraction]
  );

  // 3. Deteksi double tap (2 jari) di layar sentuh / tablet / HP
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect || !graphRef.current) return;

        const midScreenX = (touch1.clientX + touch2.clientX) / 2 - containerRect.left;
        const midScreenY = (touch1.clientY + touch2.clientY) / 2 - containerRect.top;

        const graphCoords = graphRef.current.screen2GraphCoords?.(midScreenX, midScreenY);
        if (!graphCoords) return;

        let closestNode: RenderNode | null = null;
        let minDistance = Infinity;

        for (const n of nodes) {
          if (n.x === undefined || n.y === undefined) continue;
          const dx = n.x - graphCoords.x;
          const dy = n.y - graphCoords.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestNode = n;
          }
        }

        const currentZoom = zoomRef.current || 1;
        const maxThreshold = Math.max(30, 45 / currentZoom);

        if (closestNode && minDistance <= maxThreshold) {
          e.preventDefault();
          const matchedNode = rawNodes.find((item) => item.id === closestNode.id) ?? null;
          setSelected(closestNode.id);
          onNodeSelect(matchedNode);
          setIsToolbarVisible(true);
          const screenPos = graphRef.current.graph2ScreenCoords?.(closestNode.x ?? 0, closestNode.y ?? 0);
          if (screenPos && Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y)) {
            setToolbarCoords({ x: screenPos.x, y: screenPos.y });
          }
        }
      }
    },
    [containerRef, graphRef, nodes, zoomRef, rawNodes, setSelected, onNodeSelect]
  );

const handleBackgroundClick = useCallback(() => {
  onCanvasInteraction?.();
  setSelected(null);
  onNodeSelect(null);
  setIsToolbarVisible(false);
}, [onCanvasInteraction, setSelected, onNodeSelect]);

  const handleBackgroundRightClick = useCallback(() => {
    setIsToolbarVisible(false);
  }, []);

  // Smart Zoom handler
  const smartZoom = useCallback(
    (action: "fit" | "selection" | "reset") => {
      const graph = graphRef.current;
      if (!graph) return;

      if (action === "fit") {
        graph.zoomToFit?.(500, 60);
        return;
      }

      if (action === "selection") {
        const targetId = selectedNode?.id;
        const selected = nodes.find((node) => node.id === targetId);
        if (!selected || selected.x === undefined || selected.y === undefined) return;

        graph.centerAt?.(selected.x, selected.y, 450);
        graph.zoom?.(2.25, 450);
        return;
      }

      graph.centerAt?.(0, 0, 400);
      graph.zoom?.(1, 400);
    },
    [graphRef, selectedNode?.id, nodes]
  );

  return {
    isToolbarVisible,
    setIsToolbarVisible,
    toolbarCoords,
    updateToolbarPosition,
    handleClick,
    handleNodeRightClick,
    handleTouchStart,
    handleBackgroundClick,
    handleBackgroundRightClick,
    smartZoom,
  };
}