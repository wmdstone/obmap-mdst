import { supabase } from "@/shared/lib/untypedSupabase";
import type { VaultMemberRole } from "@/types/collaboration";
import type { VaultMemberWithProfile } from "@/types/admin";

export interface UserSearchResult {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export class VaultMemberService {
  /**
   * Mengambil daftar seluruh anggota vault, termasuk Pemilik Vault (Owner) di urutan pertama
   */
  static async getVaultMembers(vaultId: string): Promise<VaultMemberWithProfile[]> {
    if (!vaultId) return [];

    try {
      // 1. Ambil data pemilik vault dari user_vaults
      const { data: vaultData } = await supabase
        .from("user_vaults")
        .select("id, user_id, created_at")
        .eq("id", vaultId)
        .maybeSingle();

      // 2. Ambil daftar kolaborator dari vault_members
      const { data: members, error: mError } = await supabase
        .from("vault_members")
        .select("id, vault_id, user_id, role, created_at")
        .eq("vault_id", vaultId);

      if (mError) {
        console.error("[VaultMemberService] Gagal mengambil anggota vault:", mError);
      }

      const rawMembers = members || [];
      const allUserIds = new Set<string>();

      if (vaultData?.user_id) {
        allUserIds.add(vaultData.user_id);
      }
      rawMembers.forEach((m) => allUserIds.add(m.user_id));

      if (allUserIds.size === 0) return [];

      // 3. Ambil profil untuk semua user id
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, avatar_url")
        .in("user_id", Array.from(allUserIds));

      const profileMap = new Map<
        string,
        { email: string | null; display_name: string | null; avatar_url: string | null }
      >();
      (profiles || []).forEach((p) => {
        profileMap.set(p.user_id, {
          email: p.email,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        });
      });

      const result: VaultMemberWithProfile[] = [];

      // Masukkan Pemilik Vault di posisi teratas jika ada
      if (vaultData?.user_id) {
        const ownerProfile = profileMap.get(vaultData.user_id);
        result.push({
          id: `owner-${vaultData.user_id}`,
          vault_id: vaultId,
          user_id: vaultData.user_id,
          role: "admin" as VaultMemberRole, // Owner memiliki wewenang Admin penuh
          created_at: vaultData.created_at || new Date().toISOString(),
          email: ownerProfile?.email || null,
          display_name: ownerProfile?.display_name ? `${ownerProfile.display_name} (Pemilik)` : "Pemilik Vault",
          avatar_url: ownerProfile?.avatar_url || null,
        });
      }

      // Masukkan kolaborator lain (abaikan jika ID sama dengan pemilik)
      rawMembers.forEach((m) => {
        if (m.user_id === vaultData?.user_id) return;
        const p = profileMap.get(m.user_id);
        result.push({
          id: m.id,
          vault_id: m.vault_id,
          user_id: m.user_id,
          role: m.role as VaultMemberRole,
          created_at: m.created_at,
          email: p?.email || null,
          display_name: p?.display_name || null,
          avatar_url: p?.avatar_url || null,
        });
      });

      return result;
    } catch (err) {
      console.error("[VaultMemberService] Error getVaultMembers:", err);
      return [];
    }
  }

  /**
   * Pencarian Akun Cerdas (Auto-Suggestion)
   * Bebas error PostgreSQL UUID type casting
   */
  static async searchUsers(query: string, excludeUserIds: string[] = []): Promise<UserSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || cleanQuery.length < 2) return [];

    try {
      // Cek apakah query adalah UUID valid
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);

      let queryBuilder = supabase
        .from("profiles")
        .select("user_id, email, display_name, avatar_url");

      if (isUuid) {
        queryBuilder = queryBuilder.or(
          `email.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%,user_id.eq.${cleanQuery}`
        );
      } else {
        queryBuilder = queryBuilder.or(
          `email.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`
        );
      }

      const { data, error } = await queryBuilder.limit(10);

      if (error || !data) {
        console.warn("[VaultMemberService] Gagal mencari profil:", error?.message);
        return [];
      }

      const excludeSet = new Set(excludeUserIds);
      return data
        .filter((u) => !excludeSet.has(u.user_id))
        .map((u) => ({
          id: u.user_id,
          email: u.email,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        }));
    } catch (err) {
      console.error("[VaultMemberService] Error pencarian user:", err);
      return [];
    }
  }

    /**
   * Mencari satu pengguna berdasarkan email eksak untuk kebutuhan undang anggota (invitation).
   */
  static async lookupUserByEmail(email: string): Promise<UserSearchResult | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, avatar_url")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.user_id,
        email: data.email,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
      };
    } catch (err) {
      console.error("[VaultMemberService] Error lookupUserByEmail:", err);
      return null;
    }
  }

  /**
   * Menambahkan atau memperbarui peran anggota di dalam vault
   */
  static async addOrUpdateMember(
    vaultId: string,
    userId: string,
    role: VaultMemberRole,
    currentActorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Pastikan vault sudah tercatat di user_vaults tanpa menimpa pemilik asli
      const { data: existingVault } = await supabase
        .from("user_vaults")
        .select("id, user_id")
        .eq("id", vaultId)
        .maybeSingle();

      if (!existingVault) {
        await supabase.from("user_vaults").insert({
          id: vaultId,
          user_id: currentActorId,
          name: "Collaborative Vault",
          updated_at: new Date().toISOString(),
        });
      } else if (existingVault.user_id === userId) {
        return { success: false, error: "Pengguna ini adalah pemilik utama vault ini." };
      }

      // 2. Simpan atau perbarui peran kolaborator
      const { error } = await supabase.from("vault_members").upsert(
        {
          vault_id: vaultId,
          user_id: userId,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vault_id,user_id" }
      );

      if (error) {
        return { success: false, error: error.message };
      }

      // 3. Catat jejak audit
      await supabase.from("audit_logs").insert({
        actor_id: currentActorId,
        action: "UPSERT_VAULT_MEMBER",
        resource_type: "vault_members",
        resource_id: vaultId,
        metadata: { target_user_id: userId, role },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Terjadi kesalahan sistem" };
    }
  }

  /**
   * Menghapus hak akses anggota dari vault (oleh Admin/Owner)
   */
  static async removeMember(
    vaultId: string,
    userId: string,
    currentActorId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("vault_members")
      .delete()
      .eq("vault_id", vaultId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from("audit_logs").insert({
      actor_id: currentActorId,
      action: "REMOVE_VAULT_MEMBER",
      resource_type: "vault_members",
      resource_id: vaultId,
      metadata: { target_user_id: userId },
    });

    return { success: true };
  }

  /**
   * Kolaborator meninggalkan vault secara mandiri
   */
  static async leaveVault(vaultId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("vault_members")
      .delete()
      .eq("vault_id", vaultId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "LEAVE_VAULT",
      resource_type: "vault_members",
      resource_id: vaultId,
      metadata: { user_id: userId },
    });

    return { success: true };
  }
}