/**
 * ProfileService - Pengelolaan Identitas Username, Validasi Keunikan,
 * Reservasi Pengalihan 14 Hari, dan Resolusi Namespace Publik.
 */

import { supabase } from "@/global/api/supabaseClient";

export interface UsernameAvailabilityResult {
  available: boolean;
  normalizedUsername: string;
  reason?: string;
}

export interface UsernameResolutionResult {
  userId: string;
  currentUsername: string;
  isRedirect: boolean;
  oldUsername?: string;
}

export interface UsernameRedirectRecord {
  id: string;
  user_id: string;
  old_username: string;
  expires_at: string;
  created_at: string;
}

export class ProfileService {
  /**
   * Kata kunci terlarang yang tidak boleh digunakan sebagai username
   * untuk menghindari tabrakan dengan rute internal aplikasi.
   */
  private static readonly RESERVED_USERNAMES = new Set([
    "admin",
    "api",
    "auth",
    "settings",
    "profile",
    "p",
    "public",
    "explore",
    "vault",
    "graph",
    "root",
    "login",
    "signup",
    "register",
    "dashboard",
    "static",
    "system",
    "terms",
    "privacy",
    "help",
    "status",
  ]);

  /**
   * Mengubah teks bebas menjadi format slug standar.
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Validasi format username (panjang 3-30 karakter, alphanumeric, underscore, hyphen).
   */
  static validateUsernameFormat(username: string): { valid: boolean; error?: string; normalized: string } {
    const normalized = username.trim().toLowerCase();

    if (!normalized) {
      return { valid: false, error: "Username tidak boleh kosong", normalized: "" };
    }

    if (normalized.length < 3) {
      return { valid: false, error: "Username minimal 3 karakter", normalized };
    }

    if (normalized.length > 30) {
      return { valid: false, error: "Username maksimal 30 karakter", normalized };
    }

    if (!/^[a-z0-9_-]+$/.test(normalized)) {
      return {
        valid: false,
        error: "Username hanya boleh memuat huruf kecil, angka, underscore (_), atau hyphen (-)",
        normalized,
      };
    }

    if (this.RESERVED_USERNAMES.has(normalized)) {
      return { valid: false, error: `'${normalized}' adalah kata cadangan sistem dan tidak dapat digunakan`, normalized };
    }

    return { valid: true, normalized };
  }

  /**
   * Memeriksa ketersediaan username di database (case-insensitive).
   * Memeriksa tabel profiles dan reservasi username_redirects aktif (14 hari).
   */
  static async checkUsernameAvailability(
    candidateUsername: string,
    currentUserId?: string
  ): Promise<UsernameAvailabilityResult> {
    const validation = this.validateUsernameFormat(candidateUsername);
    if (!validation.valid) {
      return {
        available: false,
        normalizedUsername: validation.normalized,
        reason: validation.error,
      };
    }

    const normalized = validation.normalized;

    try {
      // 1. Cek tabel profiles via type-cast adapter
      const { data: profileMatch, error: profileErr } = await (supabase.from("profiles") as any)
        .select("user_id, username")
        .ilike("username", normalized)
        .maybeSingle();

      if (profileErr) {
        console.error("[ProfileService] Error checking profiles:", profileErr);
        return { available: false, normalizedUsername: normalized, reason: "Gagal memeriksa database." };
      }

      if (profileMatch) {
        const matched = profileMatch as { user_id: string; username: string };
        if (currentUserId && matched.user_id === currentUserId) {
          return { available: true, normalizedUsername: normalized }; // Username milik pengguna sendiri
        }
        return {
          available: false,
          normalizedUsername: normalized,
          reason: "Username ini sudah digunakan oleh akun lain.",
        };
      }

      // 2. Cek tabel username_redirects yang masih aktif (belum 14 hari)
      const nowIso = new Date().toISOString();
      const { data: redirectMatch, error: redirectErr } = await (supabase as any)
        .from("username_redirects")
        .select("user_id, old_username, expires_at")
        .ilike("old_username", normalized)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (redirectErr) {
        console.error("[ProfileService] Error checking redirects:", redirectErr);
        return { available: false, normalizedUsername: normalized, reason: "Gagal memeriksa reservasi pengalihan." };
      }

      if (redirectMatch) {
        const matchedRedirect = redirectMatch as { user_id: string; old_username: string; expires_at: string };
        if (currentUserId && matchedRedirect.user_id === currentUserId) {
          return { available: true, normalizedUsername: normalized };
        }
        return {
          available: false,
          normalizedUsername: normalized,
          reason: "Username ini sedang dalam masa pengalihan cadangan (14 hari) oleh akun lain.",
        };
      }

      return { available: true, normalizedUsername: normalized };
    } catch (err: any) {
      return {
        available: false,
        normalizedUsername: normalized,
        reason: err.message || "Terjadi kesalahan koneksi.",
      };
    }
  }

// Gantikan method claimOrUpdateUsername dan resolveUsernameOrRedirect di ProfileService.ts:

  /**
   * Mengklaim atau memperbarui username pengguna.
   * Otomatis mengaktifkan is_public = true agar langsung dapat diakses publik.
   */
  static async claimOrUpdateUsername(
    userId: string,
    newUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    const availability = await this.checkUsernameAvailability(newUsername, userId);
    if (!availability.available) {
      return { success: false, error: availability.reason || "Username tidak valid atau tidak tersedia." };
    }

    const normalizedNew = availability.normalizedUsername;

    // Ambil username saat ini
    const { data: currentProfile, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) {
      return { success: false, error: "Gagal mengambil data profil saat ini." };
    }

    const profileData = currentProfile as { username?: string | null } | null;
    const oldUsername = profileData?.username ? profileData.username.trim().toLowerCase() : null;

    // Jika username sama persis, pastikan is_public tetap true
    if (oldUsername === normalizedNew) {
      await (supabase.from("profiles") as any)
        .update({ is_public: true })
        .eq("user_id", userId);
      return { success: true };
    }

    // Jika ada username lama dan berbeda, catat di username_redirects (14 hari)
    if (oldUsername) {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error: redirectInsertErr } = await (supabase as any)
        .from("username_redirects")
        .insert({
          user_id: userId,
          old_username: oldUsername,
          expires_at: expiresAt,
        });

      if (redirectInsertErr) {
        console.warn("[ProfileService] Gagal mencatat username_redirect:", redirectInsertErr);
      }
    }

    // Update kolom username dan pastikan is_public = true di tabel profiles
    const { error: updateErr } = await (supabase.from("profiles") as any)
      .update({ 
        username: normalizedNew,
        is_public: true 
      })
      .eq("user_id", userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  }

  /**
   * Menemukan pemilik username untuk kebutuhan routing publik /p/:username.
   * Mendukung auto-resolusi ke username baru jika pengunjung mengakses username lama dalam masa 14 hari.
   */
  static async resolveUsernameOrRedirect(inputUsername: string): Promise<UsernameResolutionResult | null> {
    const normalized = inputUsername.trim().toLowerCase();

    // 1. Cek langsung ke profiles berdasarkan kolom username
    const { data: directProfile } = await (supabase.from("profiles") as any)
      .select("user_id, username")
      .ilike("username", normalized)
      .maybeSingle();

    if (directProfile) {
      const profile = directProfile as { user_id: string; username: string | null };
      if (profile.username) {
        return {
          userId: profile.user_id,
          currentUsername: profile.username,
          isRedirect: false,
        };
      }
    }

    // 2. Cek ke username_redirects yang belum kedaluwarsa (14 hari)
    const nowIso = new Date().toISOString();
    const { data: redirect } = await (supabase as any)
      .from("username_redirects")
      .select("user_id, old_username, expires_at")
      .ilike("old_username", normalized)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (redirect) {
      const redirectData = redirect as { user_id: string; old_username: string };

      // Ambil username aktif pemiliknya saat ini
      const { data: currentOwner } = await (supabase.from("profiles") as any)
        .select("username")
        .eq("user_id", redirectData.user_id)
        .maybeSingle();

      const ownerData = currentOwner as { username?: string | null } | null;
      if (ownerData && ownerData.username) {
        return {
          userId: redirectData.user_id,
          currentUsername: ownerData.username,
          isRedirect: true,
          oldUsername: redirectData.old_username,
        };
      }
    }

    return null;
  }
}