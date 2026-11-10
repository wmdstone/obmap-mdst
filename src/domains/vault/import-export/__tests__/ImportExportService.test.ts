import { describe, expect, it, beforeEach } from 'vitest';
import {
  ImportExportService,
  type GraphNode,
} from '@/domains/vault/import-export/services/ImportExportService';

describe('ImportExportService Characterization Tests', () => {
  let service: ImportExportService;

  beforeEach(() => {
    service = new ImportExportService();
  });

  it('exports vault to ZIP blob and imports back with structure intact', async () => {
    const nodes: GraphNode[] = [
      {
        id: 'folder-root',
        name: 'Projects',
        content: '',
        type: 'folder',
        parentId: null,
        depth: 0,
        tags: [],
      },
      {
        id: 'note-1',
        name: 'Roadmap',
        content: '# Roadmap 2026\nNext milestone [[Architecture]] #planning',
        type: 'file',
        parentId: 'folder-root',
        depth: 1,
        tags: ['planning'],
        wikilinks: ['Architecture'],
      },
    ];

    // 1. Export ke format ZIP Blob
    const blob = await service.exportData(nodes, { type: 'vault', format: 'zip' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    // 2. Import kembali dari ZIP file
    const zipFile = new File([blob], 'export.zip', { type: 'application/zip' });
    const result = await service.importZip(zipFile);

    expect(result.success).toBe(true);
    expect(result.folders).toBe(1);
    expect(result.files).toBe(1);
    expect(result.errors.length).toBe(0);

    // Periksa folder yang diimpor
    const importedFolder = result.nodes.find((n) => n.type === 'folder');
    expect(importedFolder).toBeDefined();
    expect(importedFolder?.name).toBe('Projects');

    // Periksa note yang diimpor beserta metadata wikilink & tag
    const importedFile = result.nodes.find((n) => n.type === 'file');
    expect(importedFile).toBeDefined();
    expect(importedFile?.name).toBe('Roadmap');
    expect(importedFile?.wikilinks).toContain('Architecture');
    expect(importedFile?.tags).toContain('planning');
    expect(importedFile?.parentId).toBe(importedFolder?.id);
  });

  it('handles corrupted ZIP archive gracefully', async () => {
    const corruptFile = new File(['invalid binary data'], 'corrupt.zip', {
      type: 'application/zip',
    });
    const result = await service.importZip(corruptFile);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('corrupted');
  });

  describe('Duplicate Strategies on Import', () => {
    const existingNodes: GraphNode[] = [
      {
        id: 'doc-original',
        name: 'Spec',
        content: 'Original Specification Content',
        type: 'file',
        parentId: null,
        depth: 0,
        tags: ['v1'],
      },
    ];

    const makeDuplicateZip = async () => {
      const incomingNodes: GraphNode[] = [
        {
          id: 'doc-incoming',
          name: 'Spec',
          content: 'Updated Specification Content #v2',
          type: 'file',
          parentId: null,
          depth: 0,
          tags: ['v2'],
        },
      ];
      const blob = await service.exportData(incomingNodes, { type: 'vault', format: 'zip' });
      return new File([blob], 'incoming.zip', { type: 'application/zip' });
    };

    it('strategy "skip": leaves original intact and increments skipped count', async () => {
      const zipFile = await makeDuplicateZip();
      const result = await service.importZip(zipFile, existingNodes, new Map(), 'skip');

      expect(result.skipped).toBe(1);
      expect(result.nodes.length).toBe(0);
      expect(result.updatedNodes.length).toBe(0);
    });

    it('strategy "overwrite": updates node content and tags', async () => {
      const zipFile = await makeDuplicateZip();
      const result = await service.importZip(zipFile, existingNodes, new Map(), 'overwrite');

      expect(result.overwritten).toBe(1);
      expect(result.updatedNodes.length).toBe(1);
      expect(result.updatedNodes[0].id).toBe('doc-original');
      expect(result.updatedNodes[0].content).toContain('Updated Specification Content');
      expect(result.updatedNodes[0].tags).toContain('v2');
    });

    it('strategy "rename": imports file with unique numbered suffix', async () => {
      const zipFile = await makeDuplicateZip();
      const result = await service.importZip(zipFile, existingNodes, new Map(), 'rename');

      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].name).toBe('Spec (1)');
    });

    it('strategy "merge": appends new content with markdown divider and merges tags', async () => {
      const zipFile = await makeDuplicateZip();
      const result = await service.importZip(zipFile, existingNodes, new Map(), 'merge');

      expect(result.merged).toBe(1);
      expect(result.updatedNodes.length).toBe(1);
      expect(result.updatedNodes[0].content).toContain('Original Specification Content');
      expect(result.updatedNodes[0].content).toContain('---');
      expect(result.updatedNodes[0].content).toContain('Updated Specification Content');
      expect(result.updatedNodes[0].tags).toContain('v1');
      expect(result.updatedNodes[0].tags).toContain('v2');
    });
  });

  describe('Selective Export Filtering', () => {
    const nodes: GraphNode[] = [
      { id: 'f1', name: 'Design', content: '', type: 'folder', parentId: null, depth: 0, tags: [] },
      { id: 'n1', name: 'Mockup', content: 'Figma link', type: 'file', parentId: 'f1', depth: 1, tags: [] },
      { id: 'n2', name: 'Notes', content: 'Random notes', type: 'file', parentId: null, depth: 0, tags: [] },
    ];

    it('exports only selected node ids when type is "files"', async () => {
      const blob = await service.exportData(nodes, {
        type: 'files',
        nodeIds: ['n2'],
        format: 'zip',
      });
      const result = await service.importZip(new File([blob], 'files.zip'));

      expect(result.files).toBe(1);
      expect(result.nodes[0].name).toBe('Notes');
      expect(result.folders).toBe(0);
    });

    it('exports folder and its subtree when type is "folder"', async () => {
      const blob = await service.exportData(nodes, {
        type: 'folder',
        nodeIds: ['f1'],
        format: 'zip',
      });
      const result = await service.importZip(new File([blob], 'folder.zip'));

      expect(result.folders).toBe(1);
      expect(result.files).toBe(1);
      expect(result.nodes.find((n) => n.name === 'Design')).toBeDefined();
      expect(result.nodes.find((n) => n.name === 'Mockup')).toBeDefined();
      expect(result.nodes.find((n) => n.name === 'Notes')).toBeUndefined();
    });
  });
});