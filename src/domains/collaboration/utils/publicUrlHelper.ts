import { PublicReaderService } from "@/domains/public-reader/services/PublicReaderService";
import { supabase } from "@/global/api/supabaseClient";

/**
 * Mengambil username pemilik vault untuk membentuk tautan publik kanonikal yang valid:
 * /p/:username/:vaultSlug/:noteSlug
 */
export async function getPublicNoteUrl(vaultId: string, noteSlug: string): Promise<string> {
  try {
    // 1. Ambil vault dan nama pemilik (user_vaults tidak memiliki kolom slug fisik di DB)
    const { data: vault } = await supabase
      .from("user_vaults")
      .select("user_id, name")
      .eq("id", vaultId)
      .maybeSingle();

    if (!vault) {
      return `/p/${vaultId}/${PublicReaderService.slugify(noteSlug)}`;
    }

    // 2. Ambil username pemilik vault
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("username")
      .eq("user_id", vault.user_id)
      .maybeSingle();

    const username = profile?.username;
    // Slug vault diturunkan secara kanonikal dari nama vault
    const vaultSlug = PublicReaderService.slugify(vault.name);
    const cleanNoteSlug = PublicReaderService.slugify(noteSlug);

    if (username) {
      return PublicReaderService.buildPublicUrl(username, vaultSlug, cleanNoteSlug);
    }

    // Fallback: jika profil belum menentukan username, tetap arahkan via UUID resolver
    return `/p/${vaultId}/${cleanNoteSlug}`;
  } catch (err) {
    console.error("[publicUrlHelper] Gagal membuat URL publik:", err);
    return `/p/${vaultId}/${PublicReaderService.slugify(noteSlug)}`;
  }
}