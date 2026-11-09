/**
 * Service VCS Cloud terpusat (P1, P2, P5, P9).
 * Menggunakan src/shared/lib/untypedSupabase.ts untuk tabel migrasi VCS baru.
 */

import { supabase } from '@/shared/lib/untypedSupabase';
import { VcsHashUtil } from '../utils/vcsHash';
import {
  VcsBranch,
  VcsCommit,
  VcsCommitItem,
  VcsMergeRequest,
  VcsScope,
  VcsChangeType,
  VcsItemType,
} from '../types/vcs';

export class VcsCloudService {
  // ============================================================================
  // 1. PENGELOLAAN CABANG (BRANCHES - P2 & P3)
  // ============================================================================

  /**
   * Mengambil seluruh branch dalam satu vault.
   */
  static async listBranches(vaultId: string, includeArchived = false): Promise<VcsBranch[]> {
    let query = supabase
      .from('vault_branches')
      .select('*')
      .eq('vault_id', vaultId);

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw new Error(`Gagal memuat cabang: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      vaultId: row.vault_id,
      name: row.name,
      isDefault: row.is_default,
      isProtected: row.is_protected,
      isArchived: row.is_archived,
      autoDeleteOnMerge: row.auto_delete_on_merge,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Menginisialisasi branch 'main' jika vault baru belum memiliki branch.
   */
  static async ensureDefaultBranch(vaultId: string, userId: string): Promise<VcsBranch> {
    const branches = await this.listBranches(vaultId, true);
    const existingMain = branches.find((b) => b.isDefault || b.name === 'main');
    if (existingMain) return existingMain;

    return this.createBranch({
      vaultId,
      name: 'main',
      isDefault: true,
      isProtected: true, // Main secara default terlindungi
      createdBy: userId,
    });
  }

  /**
   * Membuat branch baru.
   */
  static async createBranch(params: {
    vaultId: string;
    name: string;
    isDefault?: boolean;
    isProtected?: boolean;
    autoDeleteOnMerge?: boolean;
    createdBy: string;
  }): Promise<VcsBranch> {
    const { data, error } = await supabase
      .from('vault_branches')
      .insert({
        vault_id: params.vaultId,
        name: params.name.trim().toLowerCase().replace(/\s+/g, '-'),
        is_default: !!params.isDefault,
        is_protected: !!params.isProtected,
        auto_delete_on_merge: !!params.autoDeleteOnMerge,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Gagal membuat branch: ${error.message}`);

    return {
      id: data.id,
      vaultId: data.vault_id,
      name: data.name,
      isDefault: data.is_default,
      isProtected: data.is_protected,
      isArchived: data.is_archived,
      autoDeleteOnMerge: data.auto_delete_on_merge,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Mengubah properti branch (Proteksi, Arsip, Hapus Otomatis).
   */
  static async updateBranch(
    branchId: string,
    updates: Partial<{
      isProtected: boolean;
      isArchived: boolean;
      autoDeleteOnMerge: boolean;
      name: string;
    }>
  ): Promise<void> {
    const payload: Record<string, any> = {};
    if (updates.isProtected !== undefined) payload.is_protected = updates.isProtected;
    if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;
    if (updates.autoDeleteOnMerge !== undefined) payload.auto_delete_on_merge = updates.autoDeleteOnMerge;
    if (updates.name !== undefined) payload.name = updates.name.trim().toLowerCase();

    const { error } = await supabase
      .from('vault_branches')
      .update(payload)
      .eq('id', branchId);

    if (error) throw new Error(`Gagal memperbarui status branch: ${error.message}`);
  }

  // ============================================================================
  // 2. CONTENT-ADDRESSABLE BLOBS (DEDUPLIKASI - P9)
  // ============================================================================

  /**
   * Menyimpan blob ke vcs_blobs hanya jika hash belum pernah ada (deduplikasi cloud).
   */
  static async ensureBlobStored(vaultId: string, content: string, mimeType = 'text/markdown'): Promise<string> {
    const blobHash = await VcsHashUtil.hashText(content);
    const sizeBytes = VcsHashUtil.getByteSize(content);

    // Cek keberadaan blob (read query cepat)
    const { data: existing } = await supabase
      .from('vcs_blobs')
      .select('blob_hash')
      .eq('blob_hash', blobHash)
      .maybeSingle();

    if (existing) {
      return blobHash; // Sudah tersimpan, hemat bandwidth & write query
    }

    const { error: insertError } = await supabase.from('vcs_blobs').insert({
      blob_hash: blobHash,
      vault_id: vaultId,
      content_text: content,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    });

    if (insertError && !insertError.message.includes('duplicate key')) {
      throw new Error(`Gagal menyimpan blob dokumen: ${insertError.message}`);
    }

    return blobHash;
  }

  /**
   * Mengambil konten teks blob berdasarkan blobHash.
   */
  static async getBlobContent(blobHash: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('vcs_blobs')
      .select('content_text')
      .eq('blob_hash', blobHash)
      .maybeSingle();

    if (error || !data) return null;
    return data.content_text;
  }

  // ============================================================================
  // 3. EXPLICIT NAMED COMMITS (P1, P2)
  // ============================================================================

  /**
   * Membuat explicit named commit dengan deduplikasi item dan snapshot atomic.
   */
  static async createExplicitCommit(params: {
    vaultId: string;
    branchId: string;
    message: string;
    authorId: string;
    scope: VcsScope;
    targetPath?: string | null;
    parentCommitId?: string | null;
    items: {
      path: string;
      title: string;
      content: string;
      itemType: VcsItemType;
      changeType: VcsChangeType;
    }[];
  }): Promise<VcsCommit> {
    // 1. Simpan semua blob konten secara paralel terdeduplikasi
    const preparedItems = await Promise.all(
      params.items.map(async (item) => {
        const blobHash = await this.ensureBlobStored(params.vaultId, item.content);
        const sizeBytes = VcsHashUtil.getByteSize(item.content);
        return {
          path: item.path,
          title: item.title,
          blob_hash: blobHash,
          item_type: item.itemType,
          change_type: item.changeType,
          size_bytes: sizeBytes,
        };
      })
    );

    // 2. Hitung commit hash deterministik
    const commitSeed = `${params.vaultId}:${params.branchId}:${params.authorId}:${Date.now()}:${params.message}`;
    const commitHash = await VcsHashUtil.hashText(commitSeed);

    // 3. Insert entri commit
    const { data: commitRow, error: commitError } = await supabase
      .from('vcs_commits')
      .insert({
        vault_id: params.vaultId,
        branch_id: params.branchId,
        commit_hash: commitHash,
        parent_commit_id: params.parentCommitId || null,
        message: params.message.trim(),
        scope: params.scope,
        target_path: params.targetPath || null,
        author_id: params.authorId,
        is_revert: false,
      })
      .select()
      .single();

    if (commitError) throw new Error(`Gagal menyimpan commit: ${commitError.message}`);

    // 4. Insert seluruh commit items
    if (preparedItems.length > 0) {
      const itemRows = preparedItems.map((p) => ({
        commit_id: commitRow.id,
        path: p.path,
        blob_hash: p.blob_hash,
        item_type: p.item_type,
        title: p.title,
        change_type: p.change_type,
        size_bytes: p.size_bytes,
      }));

      const { error: itemsError } = await supabase.from('vcs_commit_items').insert(itemRows);
      if (itemsError) throw new Error(`Gagal menyimpan snapshot item commit: ${itemsError.message}`);
    }

    return {
      id: commitRow.id,
      vaultId: commitRow.vault_id,
      branchId: commitRow.branch_id,
      commitHash: commitRow.commit_hash,
      parentCommitId: commitRow.parent_commit_id,
      message: commitRow.message,
      scope: commitRow.scope,
      targetPath: commitRow.target_path,
      authorId: commitRow.author_id,
      isRevert: commitRow.is_revert,
      revertedCommitId: commitRow.reverted_commit_id,
      createdAt: commitRow.created_at,
    };
  }

  /**
   * Mengambil daftar riwayat commit dengan filter opsional (path atau scope).
   */
  static async listCommitHistory(params: {
    vaultId: string;
    branchId: string;
    scope?: VcsScope;
    targetPath?: string;
    limit?: number;
  }): Promise<VcsCommit[]> {
    let query = supabase
      .from('vcs_commits')
      .select(`
        *,
        author:profiles(id, display_name, avatar_url, email)
      `)
      .eq('vault_id', params.vaultId)
      .eq('branch_id', params.branchId);

    if (params.scope) {
      query = query.eq('scope', params.scope);
    }
    if (params.targetPath) {
      query = query.eq('target_path', params.targetPath);
    }

    query = query.order('created_at', { ascending: false }).limit(params.limit || 50);

    const { data, error } = await query;
    if (error) throw new Error(`Gagal memuat riwayat commit: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      vaultId: row.vault_id,
      branchId: row.branch_id,
      commitHash: row.commit_hash,
      parentCommitId: row.parent_commit_id,
      message: row.message,
      scope: row.scope,
      targetPath: row.target_path,
      authorId: row.author_id,
      isRevert: row.is_revert,
      revertedCommitId: row.reverted_commit_id,
      createdAt: row.created_at,
      author: row.author
        ? {
            displayName: row.author.display_name || 'Kolaborator',
            avatarUrl: row.author.avatar_url || undefined,
            email: row.author.email || undefined,
          }
        : undefined,
    }));
  }

  /**
   * Mengambil item snapshot di dalam satu commit.
   */
  static async getCommitItems(commitId: string): Promise<VcsCommitItem[]> {
    const { data, error } = await supabase
      .from('vcs_commit_items')
      .select('*')
      .eq('commit_id', commitId);

    if (error) throw new Error(`Gagal memuat item commit: ${error.message}`);

    return (data || []).map((r: any) => ({
      id: r.id,
      commitId: r.commit_id,
      path: r.path,
      blobHash: r.blob_hash,
      itemType: r.item_type,
      title: r.title,
      changeType: r.change_type,
      sizeBytes: r.size_bytes,
    }));
  }

  // ============================================================================
  // 4. NON-DESTRUCTIVE REVERT (P5)
  // ============================================================================

  /**
   * Melakukan Revert Non-Destruktif:
   * Mengambil snapshot dari target commit, lalu membuat entri commit baru
   * yang mengembalikan dokumen ke keadaan semula.
   */
  static async revertCommit(params: {
    targetCommitId: string;
    vaultId: string;
    branchId: string;
    authorId: string;
  }): Promise<VcsCommit> {
    const items = await this.getCommitItems(params.targetCommitId);

    // Ambil konten dari masing-masing blob
    const restoredItems = await Promise.all(
      items.map(async (item) => {
        const content = (await this.getBlobContent(item.blobHash)) || '';
        return {
          path: item.path,
          title: item.title,
          content,
          itemType: item.itemType,
          changeType: 'modified' as VcsChangeType,
        };
      })
    );

    const { data: targetCommit } = await supabase
      .from('vcs_commits')
      .select('commit_hash, message')
      .eq('id', params.targetCommitId)
      .single();

    const shortHash = targetCommit ? VcsHashUtil.shortHash(targetCommit.commit_hash) : 'rev';
    const revertMessage = `Revert "${targetCommit?.message || shortHash}" (${shortHash})`;

    // Buat commit baru
    const commit = await this.createExplicitCommit({
      vaultId: params.vaultId,
      branchId: params.branchId,
      message: revertMessage,
      authorId: params.authorId,
      scope: 'vault',
      items: restoredItems,
    });

    // Tandai flag is_revert dan reverted_commit_id
    await supabase
      .from('vcs_commits')
      .update({
        is_revert: true,
        reverted_commit_id: params.targetCommitId,
      })
      .eq('id', commit.id);

    return {
      ...commit,
      isRevert: true,
      revertedCommitId: params.targetCommitId,
    };
  }

  // ============================================================================
  // 5. MERGE REQUESTS & MERGE WORKFLOW (P2, P4)
  // ============================================================================

  /**
   * Membuat Merge Request dari source branch ke target branch.
   */
  static async createMergeRequest(params: {
    vaultId: string;
    sourceBranchId: string;
    targetBranchId: string;
    title: string;
    description?: string;
    authorId: string;
  }): Promise<VcsMergeRequest> {
    const { data, error } = await supabase
      .from('vcs_merge_requests')
      .insert({
        vault_id: params.vaultId,
        source_branch_id: params.sourceBranchId,
        target_branch_id: params.targetBranchId,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        author_id: params.authorId,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw new Error(`Gagal membuat merge request: ${error.message}`);

    return {
      id: data.id,
      vaultId: data.vault_id,
      sourceBranchId: data.source_branch_id,
      targetBranchId: data.target_branch_id,
      title: data.title,
      description: data.description,
      status: data.status,
      authorId: data.author_id,
      mergedBy: data.merged_by,
      mergedAt: data.merged_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Menandai status Merge Request sebagai merged atau closed.
   */
  static async updateMergeRequestStatus(
    mrId: string,
    status: 'merged' | 'closed',
    userId: string
  ): Promise<void> {
    const payload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'merged') {
      payload.merged_by = userId;
      payload.merged_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('vcs_merge_requests')
      .update(payload)
      .eq('id', mrId);

    if (error) throw new Error(`Gagal memperbarui merge request: ${error.message}`);
  }
}