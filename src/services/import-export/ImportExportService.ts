/**
 * Import/Export Service - Universal file handling
 * 
 * Supports importing: files, folders, ZIP, images, audio, video
 * Supports exporting: entire vault, folders, files, media
 */

import JSZip from 'jszip';
import { eventBus, EventType } from '../events/DomainEvents';
import { ContentParser } from '../graph/ContentParser';

export interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'video';
  mimeType: string;
  size: number;
  data: Blob;
  parentId: string | null;
  path: string[];
}

export interface ImportResult {
  success: boolean;
  folders: number;
  files: number;
  media: number;
  errors: string[];
}

export interface ExportOptions {
  type: 'vault' | 'folder' | 'files' | 'media';
  nodeIds?: string[];
  includeMedia?: boolean;
  format?: 'zip' | 'json';
}

interface GraphNode {
  id: string;
  name: string;
  content: string;
  type: 'folder' | 'file' | 'media';
  parentId: string | null;
  depth: number;
  tags: string[];
  wikilinks?: string[];
  mediaType?: 'image' | 'audio' | 'video';
  mimeType?: string;
  dataUrl?: string;
}

const SUPPORTED_EXTENSIONS = {
  markdown: ['.md', '.markdown', '.txt'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.flv'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total
const MAX_FILES = 10000;

export class ImportExportService {
  private parser: ContentParser;
  private mediaStore: Map<string, MediaFile> = new Map();

  constructor() {
    this.parser = new ContentParser();
  }

  /**
   * Get file type from extension
   */
  private getFileType(filename: string): 'markdown' | 'image' | 'audio' | 'video' | 'unknown' {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (SUPPORTED_EXTENSIONS.markdown.includes(ext)) return 'markdown';
    if (SUPPORTED_EXTENSIONS.image.includes(ext)) return 'image';
    if (SUPPORTED_EXTENSIONS.audio.includes(ext)) return 'audio';
    if (SUPPORTED_EXTENSIONS.video.includes(ext)) return 'video';
    
    return 'unknown';
  }

  /**
   * Import files from file input
   */
  async importFiles(files: FileList): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      folders: 0,
      files: 0,
      media: 0,
      errors: [],
    };

    let totalSize = 0;
    const folderMap = new Map<string, string>();
    let nodeIdCounter = 0;

    // Process each file
    for (const file of Array.from(files)) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          result.errors.push(`File too large: ${file.name} (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
          continue;
        }

        totalSize += file.size;
        if (totalSize > MAX_TOTAL_SIZE) {
          result.errors.push('Total import size exceeded 200MB limit');
          break;
        }

        const fileType = this.getFileType(file.name);
        
        // Handle ZIP files
        if (file.name.endsWith('.zip')) {
          const zipResult = await this.importZip(file);
          result.folders += zipResult.folders;
          result.files += zipResult.files;
          result.media += zipResult.media;
          result.errors.push(...zipResult.errors);
          continue;
        }

        // Get path from webkitRelativePath or just use filename
        const relativePath = (file as any).webkitRelativePath || file.name;
        const pathParts = relativePath.split('/').filter(Boolean);
        
        // Create folder hierarchy
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderPath = pathParts.slice(0, i + 1).join('/');
          if (!folderMap.has(folderPath)) {
            const folderId = `folder-${nodeIdCounter++}`;
            const parentPath = i > 0 ? pathParts.slice(0, i).join('/') : null;
            const parentId = parentPath ? folderMap.get(parentPath) || null : null;

            eventBus.emit({
              type: EventType.FOLDER_CREATED,
              timestamp: Date.now(),
              payload: {
                id: folderId,
                name: pathParts[i],
                path: pathParts.slice(0, i + 1),
                parentId,
              },
            });

            folderMap.set(folderPath, folderId);
            result.folders++;
          }
        }

        // Get parent folder ID
        const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
        const parentId = parentPath ? folderMap.get(parentPath) || null : null;
        const fileName = pathParts[pathParts.length - 1];
        const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

        if (fileType === 'markdown') {
          const content = await file.text();
          const fileId = `file-${nodeIdCounter++}`;

          eventBus.emit({
            type: EventType.NOTE_CREATED,
            timestamp: Date.now(),
            payload: {
              id: fileId,
              name: fileNameWithoutExt,
              content,
              path: pathParts,
              parentId,
            },
          });
          result.files++;
        } else if (fileType !== 'unknown') {
          const dataUrl = await this.fileToDataUrl(file);
          const mediaId = `media-${nodeIdCounter++}`;

          // Store media in memory
          this.mediaStore.set(mediaId, {
            id: mediaId,
            name: fileName,
            type: fileType as 'image' | 'audio' | 'video',
            mimeType: file.type,
            size: file.size,
            data: file,
            parentId,
            path: pathParts,
          });

          // Emit as a special note type for media
          eventBus.emit({
            type: EventType.NOTE_CREATED,
            timestamp: Date.now(),
            payload: {
              id: mediaId,
              name: fileNameWithoutExt,
              content: `![${fileName}](${dataUrl})`,
              path: pathParts,
              parentId,
              mediaType: fileType,
              mimeType: file.type,
              dataUrl,
            },
          });
          result.media++;
        }
      } catch (error) {
        result.errors.push(`Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Import from ZIP file
   */
  async importZip(file: File): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      folders: 0,
      files: 0,
      media: 0,
      errors: [],
    };

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (error) {
      result.errors.push('Failed to read ZIP file. File may be corrupted.');
      result.success = false;
      return result;
    }

    const folderMap = new Map<string, string>();
    let nodeIdCounter = 0;
    const allFolderPaths = new Set<string>();

    // First pass: collect all folder paths
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith('.') || relativePath === '_graph_metadata.json') return;

      if (zipEntry.dir) {
        const cleanPath = relativePath.replace(/\/$/, '');
        if (cleanPath) allFolderPaths.add(cleanPath);
      } else {
        const pathParts = relativePath.split('/');
        for (let i = 1; i < pathParts.length; i++) {
          const folderPath = pathParts.slice(0, i).join('/');
          if (folderPath) allFolderPaths.add(folderPath);
        }
      }
    });

    // Create folders in order
    const sortedFolders = Array.from(allFolderPaths).sort((a, b) => 
      a.split('/').length - b.split('/').length
    );

    for (const folderPath of sortedFolders) {
      const pathParts = folderPath.split('/');
      const folderName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
      const parentId = parentPath ? folderMap.get(parentPath) || null : null;
      const folderId = `folder-${nodeIdCounter++}`;

      eventBus.emit({
        type: EventType.FOLDER_CREATED,
        timestamp: Date.now(),
        payload: {
          id: folderId,
          name: folderName,
          path: pathParts,
          parentId,
        },
      });

      folderMap.set(folderPath, folderId);
      result.folders++;
    }

    // Second pass: process files
    const filePromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith('.') || relativePath === '_graph_metadata.json' || zipEntry.dir) return;

      const fileType = this.getFileType(relativePath);
      if (fileType === 'unknown') return;

      filePromises.push(
        (async () => {
          try {
            const pathParts = relativePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
            const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
            const parentId = parentPath ? folderMap.get(parentPath) || null : null;

            if (fileType === 'markdown') {
              const content = await zipEntry.async('string');
              const fileId = `file-${nodeIdCounter++}`;

              eventBus.emit({
                type: EventType.NOTE_CREATED,
                timestamp: Date.now(),
                payload: {
                  id: fileId,
                  name: fileNameWithoutExt,
                  content,
                  path: pathParts,
                  parentId,
                },
              });
              result.files++;
            } else {
              const blob = await zipEntry.async('blob');
              const dataUrl = await this.blobToDataUrl(blob);
              const mediaId = `media-${nodeIdCounter++}`;

              this.mediaStore.set(mediaId, {
                id: mediaId,
                name: fileName,
                type: fileType as 'image' | 'audio' | 'video',
                mimeType: this.getMimeType(fileName),
                size: blob.size,
                data: blob,
                parentId,
                path: pathParts,
              });

              eventBus.emit({
                type: EventType.NOTE_CREATED,
                timestamp: Date.now(),
                payload: {
                  id: mediaId,
                  name: fileNameWithoutExt,
                  content: `![${fileName}](${dataUrl})`,
                  path: pathParts,
                  parentId,
                  mediaType: fileType,
                  mimeType: this.getMimeType(fileName),
                  dataUrl,
                },
              });
              result.media++;
            }
          } catch (error) {
            result.errors.push(`Failed to import ${relativePath}`);
          }
        })()
      );
    });

    await Promise.all(filePromises);
    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Export data based on options
   */
  async exportData(
    nodes: GraphNode[],
    options: ExportOptions
  ): Promise<Blob> {
    const zip = new JSZip();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Get nodes to export based on options
    let nodesToExport: GraphNode[] = [];

    switch (options.type) {
      case 'vault':
        nodesToExport = nodes;
        break;
      case 'folder':
        if (options.nodeIds?.length) {
          const collectChildren = (parentId: string, collected: Set<string>) => {
            collected.add(parentId);
            nodes.forEach(n => {
              if (n.parentId === parentId) {
                collected.add(n.id);
                if (n.type === 'folder') collectChildren(n.id, collected);
              }
            });
          };
          const nodeIds = new Set<string>();
          options.nodeIds.forEach(id => collectChildren(id, nodeIds));
          nodesToExport = nodes.filter(n => nodeIds.has(n.id));
        }
        break;
      case 'files':
        if (options.nodeIds?.length) {
          nodesToExport = nodes.filter(n => options.nodeIds!.includes(n.id));
        }
        break;
      case 'media':
        nodesToExport = nodes.filter(n => n.type === 'media' || n.mediaType);
        break;
    }

    // Filter by media if needed
    if (options.type !== 'media' && !options.includeMedia) {
      nodesToExport = nodesToExport.filter(n => n.type !== 'media' && !n.mediaType);
    }

    // Build path for each node
    const getNodePath = (node: GraphNode): string => {
      const parts: string[] = [];
      let current: GraphNode | undefined = node;
      while (current) {
        parts.unshift(current.name);
        current = current.parentId ? nodeMap.get(current.parentId) : undefined;
      }
      return parts.join('/');
    };

    // Process nodes
    for (const node of nodesToExport) {
      const path = getNodePath(node);

      if (node.type === 'folder') {
        zip.folder(path);
      } else if (node.mediaType && node.dataUrl) {
        // Export media file
        const ext = this.getExtensionFromMimeType(node.mimeType || '');
        const blob = await this.dataUrlToBlob(node.dataUrl);
        zip.file(`${path}${ext}`, blob);
      } else {
        // Export markdown file
        const frontmatter = [
          '---',
          `id: ${node.id}`,
          `tags: [${node.tags.join(', ')}]`,
          `depth: ${node.depth}`,
          `parentId: ${node.parentId || 'null'}`,
          '---',
          '',
        ].join('\n');
        zip.file(`${path}.md`, frontmatter + node.content);
      }
    }

    // Add metadata
    zip.file('_graph_metadata.json', JSON.stringify({
      exportDate: new Date().toISOString(),
      nodeCount: nodesToExport.length,
      exportType: options.type,
    }, null, 2));

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Get stored media files
   */
  getMediaStore(): Map<string, MediaFile> {
    return this.mediaStore;
  }

  /**
   * Clear media store
   */
  clearMediaStore(): void {
    this.mediaStore.clear();
  }

  // Helper methods
  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
    };
    return extensions[mimeType] || '';
  }
}

export const importExportService = new ImportExportService();
