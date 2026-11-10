/**
 * Layout categories — the single source of truth for which engine owns node positions.
 *
 * - Physics layouts: the D3 simulation runs continuously and owns positions (free-force).
 * - Deterministic layouts: a solver computes targets once, nodes are tweened there and
 *   pinned with fx/fy. The D3 simulation stays off, so they never jitter.
 *
 * Never mix the two (e.g. anchoring D3 forces to Kamada-Kawai targets): the two energy
 * functions have different minima and the graph oscillates forever.
 */
import type { LayoutMode } from '../model/graphTypes';

const PHYSICS_LAYOUTS: ReadonlySet<LayoutMode> = new Set<LayoutMode>(['free-force']);

/** True when the live D3 force simulation owns node positions. */
export function usesPhysicsSimulation(mode: LayoutMode | string): boolean {
  return PHYSICS_LAYOUTS.has(mode as LayoutMode);
}

/** True when a solver computes fixed target positions (nodes are pinned after transition). */
export function isDeterministicLayout(mode: LayoutMode | string): boolean {
  return !usesPhysicsSimulation(mode);
}
