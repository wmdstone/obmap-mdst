import { describe, expect, it } from 'vitest';
import {
  buildNodeMap,
  getBreadcrumbPath,
  getAncestorIdSet,
  isNodeDescendant,
} from '@/domains/graph/shared/utils/hierarchyTraversal';
import { makeNode } from '@/domains/graph/__tests__/fixtures';

describe('hierarchyTraversal', () => {
  const nodes = [
    makeNode('root'),
    makeNode('folder-a', 'root', { type: 'folder' }),
    makeNode('file-a1', 'folder-a'),
    makeNode('file-a2', 'folder-a'),
    makeNode('folder-b', 'root', { type: 'folder' }),
    makeNode('subfolder-b1', 'folder-b', { type: 'folder' }),
    makeNode('file-b1a', 'subfolder-b1'),
  ];

  describe('buildNodeMap', () => {
    it('creates O(1) lookup map from array', () => {
      const map = buildNodeMap(nodes);
      expect(map.size).toBe(nodes.length);
      expect(map.get('file-a1')?.id).toBe('file-a1');
    });

    it('returns existing map directly', () => {
      const map = buildNodeMap(nodes);
      expect(buildNodeMap(map)).toBe(map);
    });
  });

  describe('getBreadcrumbPath', () => {
    it('returns empty array when target node is null or undefined', () => {
      expect(getBreadcrumbPath(null, nodes)).toEqual([]);
      expect(getBreadcrumbPath(undefined, nodes)).toEqual([]);
    });

    it('builds full path from root to leaf', () => {
      const target = nodes.find((n) => n.id === 'file-b1a')!;
      const path = getBreadcrumbPath(target, nodes);
      expect(path.map((n) => n.id)).toEqual(['root', 'folder-b', 'subfolder-b1', 'file-b1a']);
    });

    it('handles root node correctly', () => {
      const rootNode = nodes.find((n) => n.id === 'root')!;
      const path = getBreadcrumbPath(rootNode, nodes);
      expect(path.map((n) => n.id)).toEqual(['root']);
    });

    it('safely breaks out of circular parent references without infinite loop', () => {
      const cyclicNodes = [
        makeNode('cycle-1', 'cycle-2'),
        makeNode('cycle-2', 'cycle-1'),
      ];
      const path = getBreadcrumbPath(cyclicNodes[0], cyclicNodes);
      expect(path.length).toBe(2);
    });

    it('handles dangling/missing parentId gracefully', () => {
      const orphan = makeNode('orphan', 'non-existent-parent');
      const path = getBreadcrumbPath(orphan, [orphan]);
      expect(path.map((n) => n.id)).toEqual(['orphan']);
    });
  });

  describe('getAncestorIdSet', () => {
    it('returns empty set for null or invalid target', () => {
      expect(getAncestorIdSet(null, nodes).size).toBe(0);
      expect(getAncestorIdSet('unknown-id', nodes).size).toBe(0);
    });

    it('includes self and all ancestors when includeSelf = true', () => {
      const ancestors = getAncestorIdSet('file-b1a', nodes, true);
      expect(ancestors).toEqual(new Set(['file-b1a', 'subfolder-b1', 'folder-b', 'root']));
    });

    it('excludes self when includeSelf = false', () => {
      const ancestors = getAncestorIdSet('file-b1a', nodes, false);
      expect(ancestors).toEqual(new Set(['subfolder-b1', 'folder-b', 'root']));
    });
  });

  describe('isNodeDescendant', () => {
    it('returns true if candidateId is identical to ancestorId', () => {
      expect(isNodeDescendant('folder-a', 'folder-a', nodes)).toBe(true);
    });

    it('correctly detects nested descendants', () => {
      expect(isNodeDescendant('file-b1a', 'folder-b', nodes)).toBe(true);
      expect(isNodeDescendant('file-b1a', 'subfolder-b1', nodes)).toBe(true);
      expect(isNodeDescendant('file-b1a', 'root', nodes)).toBe(true);
    });

    it('returns false for sibling or unrelated nodes', () => {
      expect(isNodeDescendant('file-a1', 'folder-b', nodes)).toBe(false);
      expect(isNodeDescendant('folder-b', 'file-b1a', nodes)).toBe(false);
    });
  });
});