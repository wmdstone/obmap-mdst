import { usesPhysicsSimulation, isDeterministicLayout } from '../layout/layoutCategory';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutArrangement } from '../model/useGraphInteractionStore';
import type { LayoutMode, NodeTarget, RenderNode } from '../model/graphTypes';
import {
  findHoveredDropTarget,
  validateReparent,
  type DragReparentState,
} from '../interactions/dragReparent';
import {
  LayoutTransitionController,
  prefersReducedMotion,
} from '../layout/transitionController';

interface GraphHandleLike {
  refresh?: () => unknown;
  d3ReheatSimulation?: () => unknown;
}

export interface UseCanvasDragReparentOptions {
  nodes: RenderNode[];
  parentByChild: Map<string, string | null>;
  childrenByParent: Map<string, string[]>;
  layoutMode: LayoutMode;
  layoutArrangement: LayoutArrangement;
  layoutTargets: Map<string, NodeTarget>;
  transitionRef: React.RefObject<LayoutTransitionController>;
  graphRef: React.RefObject<GraphHandleLike | undefined>;
  onNodeMove?: (nodeId: string, newParentId: string | null) => Promise<void> | void;
}

export function useCanvasDragReparent({
  nodes,
  parentByChild,
  childrenByParent,
  layoutMode,
  layoutArrangement,
  layoutTargets,
  transitionRef,
  graphRef,
  onNodeMove,
}: UseCanvasDragReparentOptions) {
  // Simpan state drag di Ref agar tidak memicu re-render canvas loop pada 60fps mouse drag
  const dragRef = useRef<DragReparentState>({
    draggedNodeId: null,
    draggedNodeOriginalPos: null,
    hoveredTargetId: null,
    isValidDrop: false,
  });

  const customPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Reset custom manual positions saat mode layout berganti
  useEffect(() => {
    customPositions.current.clear();
  }, [layoutMode]);

  const handleNodeDrag = useCallback(
    (node: RenderNode) => {
      // Simpan koordinat awal saat pertama kali node mulai di-drag
      if (dragRef.current.draggedNodeId !== node.id) {
        dragRef.current = {
          draggedNodeId: node.id,
          draggedNodeOriginalPos: { x: node.x ?? 0, y: node.y ?? 0 },
          hoveredTargetId: null,
          isValidDrop: false,
        };
      }

      // Deteksi folder target di bawah kursor (toleransi 60px) di semua mode
      const hoveredTarget = findHoveredDropTarget(node, nodes, 60);
      if (!hoveredTarget) {
        dragRef.current.hoveredTargetId = null;
        dragRef.current.isValidDrop = false;
        return;
      }

      const validation = validateReparent(
        node,
        hoveredTarget,
        parentByChild,
        childrenByParent
      );

      dragRef.current.hoveredTargetId = hoveredTarget.id;
      dragRef.current.isValidDrop = validation.valid;
      dragRef.current.dropReason = validation.reason;
    },
    [nodes, parentByChild, childrenByParent]
  );

  const handleNodeDragEnd = useCallback(
    (node: RenderNode) => {
      const { hoveredTargetId, isValidDrop } = dragRef.current;

      // KASUS 1: REPARENTING VALID DIJALANKAN (BERFUNGSI DI GRAPH & MINDMAP)
      if (isValidDrop && hoveredTargetId) {
        delete node.fx;
        delete node.fy;
        customPositions.current.delete(node.id);

        onNodeMove?.(node.id, hoveredTargetId);
      } else {
        // KASUS 2: DROP DI RUANG KOSONG
        if (layoutArrangement === 'auto') {
          customPositions.current.delete(node.id);
          delete node.fx;
          delete node.fy;

          // Jalankan transisi kembali ke target layout secara mulus
          const target = layoutTargets.get(node.id);
          if (target && isDeterministicLayout(layoutMode)) {
            const singleTarget = new Map(layoutTargets);
            transitionRef.current?.run(nodes, singleTarget, {
              duration: 350,
              reducedMotion: prefersReducedMotion(),
              onTick: () => graphRef.current?.refresh?.(),
            });
          } else if (usesPhysicsSimulation(layoutMode)) {
            graphRef.current?.d3ReheatSimulation?.();
          }
        } else {
          node.fx = node.x;
          node.fy = node.y;
          if (node.x !== undefined && node.y !== undefined) {
            customPositions.current.set(node.id, { x: node.x, y: node.y });
          }
        }
      }

      // Reset state drag
      dragRef.current = {
        draggedNodeId: null,
        draggedNodeOriginalPos: null,
        hoveredTargetId: null,
        isValidDrop: false,
        dropReason: undefined,
      };

      // Segarkan tampilan kanvas
      graphRef.current?.refresh?.();
    },
    [layoutMode, layoutArrangement, layoutTargets, onNodeMove, nodes, transitionRef, graphRef]
  );

  return {
    dragRef,
    customPositions,
    handleNodeDrag,
    handleNodeDragEnd,
  };
}