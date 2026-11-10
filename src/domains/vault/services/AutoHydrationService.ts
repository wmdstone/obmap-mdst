/**
 * AutoHydrationService
 *
 * Seamlessly migrates legacy monolithic `user_vaults.graph_data` into granular
 * `notes`, `note_links`, and `note_revisions` records upon opening a vault.
 *
 * Non-destructive: The original `graph_data` JSON remains intact as a safety backup.
 */

import { supabase } from "@/shared/lib/untypedSupabase";
import { NoteService } from "@/domains/vault/services/NoteService";
import type { Node as LegacyNode } from "@/shared/stores/types";

export interface HydrationResult {
  vaultId: string;
  alreadyHydrated: boolean;
  migratedNotesCount: number;
  migratedLinksCount: number;
  error?: string;
}

export class AutoHydrationService {
  /**
   * Memeriksa apakah suatu vault sudah pernah dimigrasi ke tabel granular `notes`.
   */
  static async isVaultHydrated(vaultId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("vault_id", vaultId);

    if (error) {
      console.error(`[AutoHydration] Gagal memeriksa status hidrasi: ${error.message}`);
      return false;
    }

    return (count ?? 0) > 0;
  }

  /**
   * Menjalankan hidrasi otomatis di latar belakang untuk satu vault.
   * Aman dipanggil berkali-kali (idempotent).
   */
  static async hydrateVaultIfNeeded(vaultId: string): Promise<HydrationResult> {
    try {
      // 1. Cek apakah sudah terhidrasi
      const alreadyHydrated = await this.isVaultHydrated(vaultId);
      if (alreadyHydrated) {
        return {
          vaultId,
          alreadyHydrated: true,
          migratedNotesCount: 0,
          migratedLinksCount: 0,
        };
      }

      // 2. Ambil graph_data lama dari user_vaults
      const { data: vaultRecord, error: vaultError } = await supabase
        .from("user_vaults")
        .select("id, name, graph_data")
        .eq("id", vaultId)
        .single();

      if (vaultError || !vaultRecord) {
        throw new Error(`Vault dengan ID ${vaultId} tidak ditemukan.`);
      }

      const graphData = vaultRecord.graph_data as {
        nodes?: LegacyNode[];
        links?: Array<{ source: string; target: string; type?: string }>;
      } | null;

      const rawNodes = graphData?.nodes || [];
      // Hanya migrasikan node bertipe berkas dokumen (file/pdf), lewati sekadar folder murni
      const documentNodes = rawNodes.filter(
        (n) => n.type === "file" || (!n.type && Boolean(n.content))
      );

      if (documentNodes.length === 0) {
        return {
          vaultId,
          alreadyHydrated: false,
          migratedNotesCount: 0,
          migratedLinksCount: 0,
        };
      }

      let migratedNotesCount = 0;
      let migratedLinksCount = 0;

      // 3. Konversi setiap node ke baris catatan granular
      for (const node of documentNodes) {
        const title = node.name || "Catatan Tanpa Judul";
        const content = node.content || "";
        const slug = NoteService.slugify(title);

        const createdNote = await NoteService.createNote({
          vaultId,
          title,
          content,
          slug,
          frontmatter: {
            legacyId: node.id,
            parentId: node.parentId,
            depth: node.depth,
            tags: node.tags || [],
          },
          status: "draft",
        });

        migratedNotesCount++;

        // Hitung tautan keluar yang terindeks
        const links = NoteService.extractWikilinks(content);
        migratedLinksCount += links.length;
      }

      // 4. Catat event hidrasi ke audit_logs
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id;
      if (actorId) {
        await supabase.from("audit_logs").insert({
          actor_id: actorId,
          action: "vault.auto_hydrate",
          resource_type: "user_vaults",
          resource_id: vaultId,
          metadata: {
            migratedNotesCount,
            migratedLinksCount,
            originalNodeCount: rawNodes.length,
          },
        });
      }

      console.info(
        `[AutoHydration] Sukses: Vault "${vaultRecord.name}" (${vaultId}) berhasil dihidrasi. ${migratedNotesCount} catatan terkonversi.`
      );

      return {
        vaultId,
        alreadyHydrated: false,
        migratedNotesCount,
        migratedLinksCount,
      };
    } catch (err: any) {
      console.error(`[AutoHydration] Terjadi kesalahan:`, err);
      return {
        vaultId,
        alreadyHydrated: false,
        migratedNotesCount: 0,
        migratedLinksCount: 0,
        error: err?.message || "Kesalahan hidrasi tidak diketahui.",
      };
    }
  }
}