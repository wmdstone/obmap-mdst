import { describe, expect, it } from 'vitest';
import { isDescendant, validateReparent } from '../interactions/dragReparent';
import type { RenderNode } from '../model/graphTypes';

const makeRenderNode = (id: string, type: 'folder' | 'file', parentId: string | null = null): RenderNode => ({
  id,
  name: id,
  type,
  depth: 0,
  parentId,
  content: '',
  tags: [],
  childCount: 0,
});

describe('Drag & Drop Reparenting Logic', () => {
  const childrenByParent = new Map<string, string[]>([
    ['root', ['folderA', 'folderB']],
    ['folderA', ['subA1', 'fileA2']],
    ['subA1', ['subSubA']],
    ['folderB', ['fileB1']],
  ]);

  const parentByChild = new Map<string, string | null>([
    ['root', null],
    ['folderA', 'root'],
    ['folderB', 'root'],
    ['subA1', 'folderA'],
    ['fileA2', 'folderA'],
    ['subSubA', 'subA1'],
    ['fileB1', 'folderB'],
  ]);

  it('mendeteksi hubungan keturunan (descendant) secara akurat', () => {
    expect(isDescendant('subSubA', 'folderA', childrenByParent)).toBe(true);
    expect(isDescendant('subA1', 'folderA', childrenByParent)).toBe(true);
    expect(isDescendant('folderB', 'folderA', childrenByParent)).toBe(false);
    expect(isDescendant('root', 'folderA', childrenByParent)).toBe(false);
  });

  it('menolak reparenting jika target adalah file biasa', () => {
    const fileTarget = makeRenderNode('fileB1', 'file', 'folderB');
    const dragged = makeRenderNode('fileA2', 'file', 'folderA');
    const result = validateReparent(dragged, fileTarget, parentByChild, childrenByParent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Target bukan folder');
  });

  it('menolak pemindahan folder induk ke sub-foldernya sendiri (circular)', () => {
    const draggedFolder = makeRenderNode('folderA', 'folder', 'root');
    const subTargetFolder = makeRenderNode('subSubA', 'folder', 'subA1');
    const result = validateReparent(draggedFolder, subTargetFolder, parentByChild, childrenByParent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Tidak dapat memindahkan induk');
  });

  it('menyetujui pemindahan valid dari satu folder ke folder lain', () => {
    const draggedFile = makeRenderNode('fileA2', 'file', 'folderA');
    const targetFolder = makeRenderNode('folderB', 'folder', 'root');
    const result = validateReparent(draggedFile, targetFolder, parentByChild, childrenByParent);
    expect(result.valid).toBe(true);
  });
});