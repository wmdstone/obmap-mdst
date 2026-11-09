import { describe, it, expect } from 'vitest';
import { usesPhysicsSimulation, isDeterministicLayout } from '../layout/layoutCategory';

describe('layoutCategory', () => {
  it('only free-force runs the physics simulation', () => {
    expect(usesPhysicsSimulation('free-force')).toBe(true);
  });
  it('network solvers stay deterministic (no forces on top)', () => {
    for (const m of ['fr-standard', 'fr-radial', 'kamada-kawai', 'grid']) {
      expect(usesPhysicsSimulation(m)).toBe(false);
      expect(isDeterministicLayout(m)).toBe(true);
    }
  });
});
