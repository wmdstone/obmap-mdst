/**
 * BulkPublishService
 *
 * Mengelola alur publikasi massal (bulk publishing pipeline) untuk folder & subfolder:
 * 1. Mengumpulkan folder, subfolder, dan sub-item secara rekursif
 * 2. Mempublikasikan folder sebagai simpul hierarki di database
 * 3. Mengunggah aset media untuk catatan Markdown secara otomatis
 * 4. Melacak kegagalan inline dan memfasilitasi retry per catatan
 */

import { supabase } from "@/global/api/supabaseClient";
import { NoteService } from "@/domains/vault/services/NoteService";
import { AssetBundlerService } from "@/domains/vault/services/AssetBundlerService";
import type { Node } from "@/shared/stores/types";
import type { ExplorerNode } from "@/domains/workspace/sidebar/FileExplorerTree";

export type BulkItemStatus = "idle" | "bundling" | "publishing" | "success" | "failed";

export interface BulkPublishItemState {
  nodeId: string;
  title: string;
  content: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId: string | null;
  depth: number;
  status: BulkItemStatus;
  version?: number;
  isUpdate?: boolean;
  errorReason?: string;
  publishedSlug?: string;
}

export interface BulkPublishProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  percent: number;
}

export class BulkPublishService {
  /**
   * Mengumpulkan folder saat ini, seluruh sub-folder, dan seluruh sub-item (file)
   * secara rekursif berbasis relasi parentId.
   */
  static collectDescendantsRecursive(
    rootFolderId: string,
    allNodes: (ExplorerNode | Node)[],
    includeRootFolder = true
  ): (ExplorerNode | Node)[] {
    const results: (ExplorerNode | Node)[] = [];
    const visited = new Set<string>();

    if (includeRootFolder) {
      const rootNode = allNodes.find((n) => n.id === rootFolderId);
      if (rootNode) {
        results.push(rootNode);
        visited.add(rootNode.id);
      }
    }

    const traverse = (parentId: string) => {
      const children = allNodes.filter((n) => n.parentId === parentId);
      // Urutkan: Folder diproses terlebih dahulu agar relasi parent terbentuk sebelum anak
      const sorted = [...children].sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });

      for (const child of sorted) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          results.push(child);
          if (child.type === "folder") {
            traverse(child.id);
          }
        }
      }
    };

    traverse(rootFolderId);
    return results;
  }

  /**
   * Inisialisasi status awal untuk setiap node yang akan diterbitkan
   */
  static initializeItems(nodes: (ExplorerNode | Node)[]): BulkPublishItemState[] {
    return nodes.map((node) => ({
      nodeId: node.id,
      title: node.name.replace(/\.md$/i, ""),
      content: node.content || "",
      type: node.type,
      parentId: node.parentId,
      depth: node.depth ?? 0,
      status: "idle",
    }));
  }

  /**
   * Menerbitkan satu item (baik folder maupun catatan):
   * - Folder: diterbitkan sebagai note dengan metadata type: 'folder'
   * - File: bundel aset media lalu simpan ke database dengan type: 'file'
   */
  static async publishSingleNote(
    vaultId: string,
    item: BulkPublishItemState,
    onStateChange?: (updated: BulkPublishItemState) => void
  ): Promise<BulkPublishItemState> {
    try {
      const isFolder = item.type === "folder";
      let finalContent = item.content;

      // 1. Fase Pemrosesan Aset Media (hanya untuk file catatan)
      if (!isFolder && item.content) {
        const stateBundling: BulkPublishItemState = {
          ...item,
          status: "bundling",
          errorReason: undefined,
        };
        onStateChange?.(stateBundling);

        const { bundledContent } = await AssetBundlerService.bundleAndUploadAssets(
          vaultId,
          item.nodeId,
          item.content
        );
        finalContent = bundledContent;
      }

      // 2. Fase Publikasi ke Database (NoteService)
      const statePublishing: BulkPublishItemState = {
        ...item,
        content: finalContent,
        status: "publishing",
      };
      onStateChange?.(statePublishing);

      const record = await NoteService.publishOrUpdateNote({
        vaultId,
        nodeId: item.nodeId,
        title: item.title,
        content: finalContent || (isFolder ? "Folder Overview" : ""),
        status: "published",
        frontmatter: {
          type: item.type,
          parentId: item.parentId,
          depth: item.depth,
          is_folder: isFolder,
          local_node_id: item.nodeId,
        },
      });

      const successState: BulkPublishItemState = {
        ...statePublishing,
        status: "success",
        version: record.version,
        isUpdate: record.version > 1,
        publishedSlug: record.slug,
        errorReason: undefined,
      };

      onStateChange?.(successState);
      return successState;
    } catch (err: any) {
      const failedState: BulkPublishItemState = {
        ...item,
        status: "failed",
        errorReason: err?.message || "Gagal mempublikasikan item.",
      };

      onStateChange?.(failedState);
      return failedState;
    }
  }

  /**
   * Menjalankan publikasi batch dengan kontrol konkurensi (2 worker simultan)
   */
  static async runBulkPublish(
    vaultId: string,
    items: BulkPublishItemState[],
    onProgress: (progress: BulkPublishProgress, currentItems: BulkPublishItemState[]) => void,
    signal?: AbortSignal
  ): Promise<BulkPublishItemState[]> {
    const results = [...items];
    const concurrency = 2;
    let index = 0;

    const computeProgress = (): BulkPublishProgress => {
      const completed = results.filter((r) => r.status === "success" || r.status === "failed").length;
      const succeeded = results.filter((r) => r.status === "success").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const percent = results.length > 0 ? Math.round((completed / results.length) * 100) : 0;
      return { total: results.length, completed, succeeded, failed, percent };
    };

    const worker = async () => {
      while (index < results.length) {
        if (signal?.aborted) break;

        const currentIndex = index++;
        const currentItem = results[currentIndex];

        if (currentItem.status === "success") continue;

        const updated = await this.publishSingleNote(vaultId, currentItem, (state) => {
          results[currentIndex] = state;
          onProgress(computeProgress(), results);
        });

        results[currentIndex] = updated;
        onProgress(computeProgress(), results);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }
}