import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/untypedSupabase";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import type { VaultMemberRole } from "@/types/collaboration";

export interface VaultPermissions {
  role: VaultMemberRole | "owner" | "superadmin" | "none";
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  canManageMembers: boolean;
  isReadOnly: boolean;
  loading: boolean;
}

export function useVaultPermission(): VaultPermissions {
  const { user } = useAuth();
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const [role, setRole] = useState<VaultPermissions["role"]>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function evaluatePermissions() {
      if (!user) {
        if (isMounted) {
          setRole("none");
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      // 1. Cek apakah Superadmin global
      const { data: superadminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superadmin")
        .maybeSingle();

      if (superadminRole) {
        if (isMounted) {
          setRole("superadmin");
          setLoading(false);
        }
        return;
      }

      if (!currentVaultId) {
        if (isMounted) {
          setRole("none");
          setLoading(false);
        }
        return;
      }

      // 2. Cek apakah pengguna adalah anggota kolaborator di vault_members
      const { data: memberRow } = await supabase
        .from("vault_members")
        .select("role")
        .eq("vault_id", currentVaultId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberRow) {
        if (isMounted) {
          setRole(memberRow.role as VaultMemberRole);
          setLoading(false);
        }
        return;
      }

      // 3. Cek di tabel user_vaults di cloud (apakah pemilik sah)
      const { data: vaultRow } = await supabase
        .from("user_vaults")
        .select("user_id")
        .eq("id", currentVaultId)
        .maybeSingle();

      if (vaultRow) {
        if (vaultRow.user_id === user.id) {
          if (isMounted) {
            setRole("owner");
            setLoading(false);
          }
          return;
        }
        // Vault milik orang lain dan user BUKAN anggota
        if (isMounted) {
          setRole("none");
          setLoading(false);
        }
        return;
      }

      // 4. Jika vault tidak ditemukan di cloud dan user bukan siapa-siapa,
      // JANGAN upsert kepemilikan orang lain! Strict NONE.
      if (isMounted) {
        setRole("none");
        setLoading(false);
      }
    }

    evaluatePermissions();

    return () => {
      isMounted = false;
    };
  }, [user, currentVaultId]);

  const canEdit = ["contributor", "editor", "admin", "owner", "superadmin"].includes(role);
  const canReview = ["editor", "admin", "owner", "superadmin"].includes(role);
  const canPublish = ["editor", "admin", "owner", "superadmin"].includes(role);
  const canManageMembers = ["admin", "owner", "superadmin"].includes(role);
  const isReadOnly = role === "viewer" || role === "none";

  return {
    role,
    canEdit,
    canReview,
    canPublish,
    canManageMembers,
    isReadOnly,
    loading,
  };
}