import { describe, expect, it } from 'vitest';
import { buildGraphProjection } from '../model/buildGraphProjection';
import {
  ancestorsOf,
  descendantsOf,
  hiddenByCollapse,
  pathwayOf,
  subtreeOf,
} from '../interactions/graphTraversal';
import { makeLink, makeNode } from './fixtures';

const nodes = [
  makeNode('root'),
  makeNode('a', 'root'),
  makeNode('b', 'root'),
  makeNode('a1', 'a'),
  makeNode('a2', 'a'),
];
const links = [makeLink('root', 'a'), makeLink('root', 'b'), makeLink('a', 'a1'), makeLink('a', 'a2')];

describe('graph projection and traversal', () => {
  const projection = buildGraphProjection(nodes, links);

  it('indexes hierarchy in one pass', () => {
    expect(projection.roots).toEqual(['root']);
    expect(projection.childrenByParent.get('a')).toEqual(['a1', 'a2']);
    expect(projection.parentByChild.get('a1')).toBe('a');
  });

  it('ignores dangling parent references', () => {
    const p = buildGraphProjection([makeNode('x', 'missing')], []);
    expect(p.roots).toEqual(['x']);
    expect(p.parentByChild.get('x')).toBeNull();
  });

  it('cuts cycles so walking up terminates', () => {
    const cyclic = buildGraphProjection(
      [makeNode('p', 'q'), makeNode('q', 'p')],
      []
    );
    expect(cyclic.roots.length).toBeGreaterThan(0);
    expect(() => ancestorsOf(cyclic, 'p')).not.toThrow();
  });

  it('resolves ancestors and descendants', () => {
    expect([...ancestorsOf(projection, 'a1')].sort()).toEqual(['a', 'root']);
    expect([...descendantsOf(projection, 'a')].sort()).toEqual(['a1', 'a2']);
  });

  it('hides only descendants of collapsed nodes', () => {
    const hidden = hiddenByCollapse(projection, new Set(['a']));
    expect([...hidden].sort()).toEqual(['a1', 'a2']);
  });

  it('builds a hover pathway from node to root', () => {
    expect([...pathwayOf(projection, 'a1')].sort()).toEqual(['a', 'a1', 'root']);
    expect(pathwayOf(projection, null).size).toBe(0);
  });

  it('includes the node itself in its subtree', () => {
    expect([...subtreeOf(projection, 'a')].sort()).toEqual(['a', 'a1', 'a2']);
  });
});
