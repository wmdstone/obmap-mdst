/**
 * src/core/graph/layout/transitionController.ts
 */

import type { NodeTarget, RenderNode } from '../model/graphTypes';
import { easeOutCubic } from './layoutMath';

export interface TransitionOptions {
  duration?: number;
  reducedMotion?: boolean;
  onTick?: () => void;
  onDone?: () => void;
}

export class LayoutTransitionController {
  private frame: number | null = null;
  private token = 0;

  cancel() {
    this.token += 1;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** Releases fixed positions so the wrapper simulation owns the nodes again. */
  release(nodes: RenderNode[]) {
    this.cancel();
    for (const node of nodes) {
      delete node.fx;
      delete node.fy;
      node.vx = 0;
      node.vy = 0;
    }
  }

  run(nodes: RenderNode[], targets: Map<string, NodeTarget>, options: TransitionOptions = {}) {
    this.cancel();
    const token = this.token;
    const duration = Math.max(0, options.duration ?? 450);

    const plan = nodes
      .map((node) => {
        const target = targets.get(node.id);
        if (!target) return null;
        const fromX = Number.isFinite(node.fx) ? node.fx! : Number.isFinite(node.x) ? node.x! : target.x;
        const fromY = Number.isFinite(node.fy) ? node.fy! : Number.isFinite(node.y) ? node.y! : target.y;
        return { node, fromX, fromY, toX: target.x, toY: target.y };
      })
      .filter(Boolean) as {
      node: RenderNode;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }[];

    const settle = () => {
      for (const item of plan) {
        item.node.fx = item.toX;
        item.node.fy = item.toY;
        item.node.x = item.toX;
        item.node.y = item.toY;
        item.node.vx = 0;
        item.node.vy = 0;
      }
      options.onTick?.();
      options.onDone?.();
    };

    if (!plan.length || duration === 0 || options.reducedMotion) {
      settle();
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      if (token !== this.token) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      for (const item of plan) {
        const x = item.fromX + (item.toX - item.fromX) * eased;
        const y = item.fromY + (item.toY - item.fromY) * eased;
        item.node.fx = x;
        item.node.fy = y;
        item.node.x = x;
        item.node.y = y;
      }
      options.onTick?.();
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        this.frame = null;
        settle();
      }
    };
    this.frame = requestAnimationFrame(step);
  }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;