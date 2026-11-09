/**
 * NoteService
 *
 * Granular note management service for ObMap v4.
 * Handles CRUD operations, optimistic concurrency, wikilink indexing,
 * revision history, and seamless publishing transitions for local & cloud notes.
 */

import { supabase } from "@/shared/lib/untypedSupabase";
import type { Json } from "@/integrations/supabase/types";
import type {
  NoteRecord,
  NoteRevisionRecord,
  NoteLinkRecord,
  NoteStatus,
} from "@/types/collaboration";

export interface CreateNoteInput {
  vaultId: string;
  title: string;
  content?: string;
  slug?: string;
  frontmatter?: Record<string, any>;
  status?: NoteStatus;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  frontmatter?: Record<string, any>;
  status?: NoteStatus;
  expectedVersion?: number;
}

export interface PublishNoteInput {
  vaultId: string;
  nodeId: string; // ID lokal dari graph (misal: "file-123" atau UUID)
  title: string;
  content: string;
  status?: "published" | "in_review";
  frontmatter?: Record<string, any>;
}

export class NoteService {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  static extractWikilinks(content: string): string[] {
    if (!content) return [];
    const wikilinkRegex = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
    const targets = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = wikilinkRegex.exec(content)) !== null) {
      const rawTarget = match[1].trim();
      if (rawTarget) {
        targets.add(this.slugify(rawTarget));
      }
    }

    return Array.from(targets);
  }

  /**
   * Mencari catatan di dalam vault baik berdasarkan UUID, slug judul, atau ID node lokal.
   */
  static async findNoteInVault(
    vaultId: string,
    nodeId: string,
    title?: string
  ): Promise<NoteRecord | null> {
    // 1. Cek jika nodeId adalah UUID valid
    if (this.UUID_REGEX.test(nodeId)) {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("id", nodeId)
        .maybeSingle();
      if (data) return data as NoteRecord;
    }

    // 2. Cek berdasarkan slug judul di vault tersebut
    const targetSlug = this.slugify(title || nodeId);
    if (targetSlug) {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("vault_id", vaultId)
        .eq("slug", targetSlug)
        .maybeSingle();
      if (data) return data as NoteRecord;
    }

    return null;
  }

  static async getNote(noteId: string): Promise<NoteRecord | null> {
    if (!this.UUID_REGEX.test(noteId)) return null;

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .maybeSingle();

    if (error) {
      throw new Error(`Gagal memuat catatan: ${error.message}`);
    }

    return (data as NoteRecord | null) ?? null;
  }

  static async getRevisions(noteId: string): Promise<NoteRevisionRecord[]> {
    if (!this.UUID_REGEX.test(noteId)) return [];

    const { data, error } = await supabase
      .from("note_revisions")
      .select("*")
      .eq("note_id", noteId)
      .order("version", { ascending: false });

    if (error) {
      throw new Error(`Gagal memuat riwayat revisi: ${error.message}`);
    }

    return (data as NoteRevisionRecord[]) || [];
  }

  /**
   * Publikasikan atau ajukan catatan secara fail-safe.
   * Jika belum ada di tabel notes, fungsi ini otomatis melakukan INSERT.
   * Jika sudah ada, fungsi ini melakukan UPDATE dan mencatat versi baru.
   */
  static async publishOrUpdateNote(input: PublishNoteInput): Promise<NoteRecord> {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) {
      throw new Error("Anda harus masuk (login) untuk mempublikasikan catatan.");
    }

    const targetStatus = input.status || "published";
    const nowIso = new Date().toISOString();

    // 1. Cari apakah catatan sudah terdaftar sebelumnya di database
    const existing = await this.findNoteInVault(
      input.vaultId,
      input.nodeId,
      input.title
    );

    if (existing) {
      // Perbarui catatan yang sudah ada
      const nextVersion = existing.version + 1;
      const { data: updated, error: updateError } = await supabase
        .from("notes")
        .update({
          title: input.title,
          content: input.content,
          status: targetStatus,
          version: nextVersion,
          published_at:
            targetStatus === "published"
              ? existing.published_at || nowIso
              : existing.published_at,
          updated_at: nowIso,
          frontmatter: {
            ...((existing.frontmatter as Record<string, any>) || {}),
            ...(input.frontmatter || {}),
            local_node_id: input.nodeId,
          } as Json,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error(`Gagal memperbarui catatan: ${updateError?.message}`);
      }

      const updatedRecord = updated as NoteRecord;

      // Simpan riwayat revisi
      await supabase.from("note_revisions").insert({
        note_id: updatedRecord.id,
        version: nextVersion,
        title: updatedRecord.title,
        content: input.content,
        frontmatter: updatedRecord.frontmatter as Json,
        diff_summary: `Publikasi versi ${nextVersion}`,
        created_by: currentUserId,
      });

      await this.syncNoteLinks(updatedRecord.id, input.vaultId, input.content);
      return updatedRecord;
    } else {
      // Buat catatan baru di database
      let baseSlug = this.slugify(input.title) || "catatan-terbit";
      let finalSlug = baseSlug;
      let counter = 1;

      while (true) {
        const { data: slugCheck } = await supabase
          .from("notes")
          .select("id")
          .eq("vault_id", input.vaultId)
          .eq("slug", finalSlug)
          .maybeSingle();

        if (!slugCheck) break;
        finalSlug = `${baseSlug}-${counter++}`;
      }

      const insertPayload: Record<string, any> = {
        vault_id: input.vaultId,
        slug: finalSlug,
        title: input.title || "Untitled",
        content: input.content,
        status: targetStatus,
        version: 1,
        author_id: currentUserId,
        published_at: targetStatus === "published" ? nowIso : null,
        frontmatter: {
          ...(input.frontmatter || {}),
          local_node_id: input.nodeId,
        } as Json,
      };

      // Gunakan ID node jika sudah merupakan UUID valid
      if (this.UUID_REGEX.test(input.nodeId)) {
        insertPayload.id = input.nodeId;
      }

      const { data: created, error: insertError } = await supabase
        .from("notes")
        .insert(insertPayload)
        .select()
        .single();

      if (insertError || !created) {
        throw new Error(`Gagal mempublikasikan catatan baru: ${insertError?.message}`);
      }

      const createdRecord = created as NoteRecord;

      // Simpan revisi awal (v1)
      await supabase.from("note_revisions").insert({
        note_id: createdRecord.id,
        version: 1,
        title: createdRecord.title,
        content: input.content,
        frontmatter: createdRecord.frontmatter as Json,
        diff_summary: "Publikasi pertama ke Web",
        created_by: currentUserId,
      });

      await this.syncNoteLinks(createdRecord.id, input.vaultId, input.content);
      return createdRecord;
    }
  }

    /**
   * Membuat catatan baru granular di database.
   * Digunakan oleh sinkronisasi otomatis dan migrasi.
   */
  static async createNote(input: CreateNoteInput): Promise<NoteRecord> {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) {
      throw new Error("Anda harus masuk (login) untuk membuat catatan.");
    }

    const slug = input.slug || this.slugify(input.title);
    const nowIso = new Date().toISOString();
    const status = input.status || "draft";

    const { data, error } = await (supabase.from("notes") as any)
      .insert({
        vault_id: input.vaultId,
        title: input.title,
        content: input.content || "",
        slug,
        frontmatter: (input.frontmatter || {}) as Json,
        status,
        version: 1,
        author_id: currentUserId,
        published_at: status === "published" ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Gagal membuat catatan: ${error?.message}`);
    }

    const record = data as NoteRecord;

    // Indeks wikilinks jika catatan memiliki isi konten
    if (input.content) {
      await this.syncNoteLinks(input.vaultId, record.id, input.content);
    }

    return record;
  }

  /**
   * Memperbarui catatan yang sudah ada dengan deteksi versi optimistik.
   */
  static async updateNote(
    noteId: string,
    updates: UpdateNoteInput
  ): Promise<NoteRecord> {
    const existing = await this.getNote(noteId);
    if (!existing) {
      throw new Error(`Catatan dengan ID ${noteId} tidak ditemukan.`);
    }

    if (
      updates.expectedVersion !== undefined &&
      existing.version !== updates.expectedVersion
    ) {
      throw new Error("Konflik pengeditan: versi catatan di server telah berubah.");
    }

    const nextVersion = existing.version + 1;
    const nowIso = new Date().toISOString();
    const newStatus = updates.status || existing.status;

    const updatePayload: Record<string, any> = {
      version: nextVersion,
      updated_at: nowIso,
    };

    if (updates.title !== undefined) {
      updatePayload.title = updates.title;
      updatePayload.slug = this.slugify(updates.title);
    }
    if (updates.content !== undefined) {
      updatePayload.content = updates.content;
    }
    if (updates.frontmatter !== undefined) {
      updatePayload.frontmatter = {
        ...((existing.frontmatter as Record<string, any>) || {}),
        ...updates.frontmatter,
      } as Json;
    }
    if (updates.status !== undefined) {
      updatePayload.status = newStatus;
      if (newStatus === "published" && !existing.published_at) {
        updatePayload.published_at = nowIso;
      }
    }

    const { data, error } = await (supabase.from("notes") as any)
      .update(updatePayload)
      .eq("id", noteId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Gagal memperbarui catatan: ${error?.message}`);
    }

    const updatedRecord = data as NoteRecord;

    if (updates.content !== undefined) {
      await this.syncNoteLinks(
        updatedRecord.vault_id,
        updatedRecord.id,
        updates.content
      );
    }

    return updatedRecord;
  }

    /**
   * Menarik catatan dari publikasi web (status kembali ke draf dan published_at dihapus).
   */
  static async unpublishNote(noteId: string): Promise<NoteRecord> {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("notes")
      .update({
        status: "draft",
        published_at: null,
        updated_at: nowIso,
      })
      .eq("id", noteId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Gagal membatalkan publikasi catatan: ${error?.message}`);
    }

    return data as NoteRecord;
  }


  private static async syncNoteLinks(
    noteId: string,
    vaultId: string,
    content: string
  ): Promise<void> {
    const targetSlugs = this.extractWikilinks(content);

    await supabase.from("note_links").delete().eq("source_note_id", noteId);

    if (targetSlugs.length === 0) return;

    const linkRows = targetSlugs.map((slug) => ({
      vault_id: vaultId,
      source_note_id: noteId,
      target_slug: slug,
    }));

    const { error } = await supabase.from("note_links").insert(linkRows);
    if (error) {
      console.warn(`[NoteService] Catatan tautan gagal disinkronkan: ${error.message}`);
    }
  }
}