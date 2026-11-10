import { supabase } from "@/global/api/supabaseClient";


export interface VaultValidationResult {
  available: boolean;
  slug: string;
  reason?: string;
}

export interface CheckVaultAvailabilityParams {
  name: string;
  excludeVaultId?: string;
  currentUserId?: string;
  /**
   * Menyediakan koleksi vault lokal langsung (berguna untuk testing atau decoupling)
   */
  existingVaults?: Array<{ id: string; name: string }>;
}

export class VaultValidationService {
  /**
   * Menghasilkan slug URL yang konsisten dan aman untuk rute /p/:username/:vaultSlug
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Bersihkan aksen/diakritik
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Validasi format nama dasar (panjang, karakter ilegal sistem berkas)
   */
  static validateFormat(name: string): { valid: boolean; reason?: string } {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, reason: "Nama vault tidak boleh kosong." };
    }
    if (trimmed.length < 2) {
      return { valid: false, reason: "Nama vault minimal 2 karakter." };
    }
    if (trimmed.length > 50) {
      return { valid: false, reason: "Nama vault maksimal 50 karakter." };
    }
    // Karakter yang merusak path sistem berkas OS dan URL
    const invalidCharsRegex = /[\\/:*?"<>|]/;
    if (invalidCharsRegex.test(trimmed)) {
      return {
        valid: false,
        reason: 'Nama tidak boleh mengandung karakter khusus sistem: \\ / : * ? " < > |',
      };
    }

    const slug = this.slugify(trimmed);
    if (!slug) {
      return {
        valid: false,
        reason: "Nama vault harus mengandung setidaknya satu huruf atau angka.",
      };
    }

    return { valid: true };
  }

  /**
   * Pemeriksaan ketersediaan nama & slug (Real-time Checker):
   * 1. Format nama
   * 2. Duplikasi di cache lokal (IndexedDB)
   * 3. Duplikasi di database cloud (jika user login)
   */
  static async checkAvailability({
    name,
    excludeVaultId,
    currentUserId,
    existingVaults,
  }: CheckVaultAvailabilityParams): Promise<VaultValidationResult> {
    const formatCheck = this.validateFormat(name);
    const targetSlug = this.slugify(name);

    if (!formatCheck.valid) {
      return {
        available: false,
        slug: targetSlug,
        reason: formatCheck.reason,
      };
    }

    const normalizedName = name.trim().toLowerCase();

    // -------------------------------------------------------------
    // LAPIS 1: Cek Koleksi Vault Lokal (Gunakan VaultManagerSingleton)
    // -------------------------------------------------------------
    try {
      let localVaults = existingVaults;
      if (!localVaults) {
        // Ambil instance singleton secara dinamis untuk memutus circular dependency
        const { getVaultManager } = await import("@/domains/vault/services/VaultManagerSingleton");
        const vm = getVaultManager();
        localVaults = vm && typeof vm.getAllVaults === "function" ? vm.getAllVaults() : [];
      }

      if (Array.isArray(localVaults)) {
        const duplicateLocal = localVaults.find((v) => {
          if (excludeVaultId && v.id === excludeVaultId) return false;
          const vNameNorm = (v.name || "").trim().toLowerCase();
          const vSlug = this.slugify(v.name || "");
          return vNameNorm === normalizedName || vSlug === targetSlug;
        });

        if (duplicateLocal) {
          return {
            available: false,
            slug: targetSlug,
            reason: `Nama atau slug "${targetSlug}" sudah digunakan oleh vault lokal "${duplicateLocal.name}".`,
          };
        }
      }
    } catch (e) {
      console.warn("VaultValidationService: Gagal memeriksa vault lokal:", e);
    }

    // -------------------------------------------------------------
    // LAPIS 2: Cek Koleksi Vault Cloud (Supabase user_vaults dengan safe cast)
    // -------------------------------------------------------------
    if (currentUserId) {
      try {
        const { data, error } = await (supabase.from("user_vaults" as any) as any)
          .select("id, name, slug")
          .eq("user_id", currentUserId);

        if (!error && Array.isArray(data)) {
          // Gunakan 'as unknown as Array<...>' untuk mematuhi aturan strict compiler TS
          const cloudList = data as unknown as Array<{ id: string; name: string; slug?: string }>;
          const duplicateCloud = cloudList.find((v) => {
            if (excludeVaultId && v.id === excludeVaultId) return false;
            const cloudNameNorm = (v.name || "").trim().toLowerCase();
            const cloudSlug = v.slug || this.slugify(v.name || "");
            return cloudNameNorm === normalizedName || cloudSlug === targetSlug;
          });

          if (duplicateCloud) {
            return {
              available: false,
              slug: targetSlug,
              reason: `Nama vault "${duplicateCloud.name}" sudah digunakan pada akun cloud Anda.`,
            };
          }
        }
      } catch (e) {
        console.warn("VaultValidationService: Gagal memeriksa keunikan cloud:", e);
      }
    }

    return {
      available: true,
      slug: targetSlug,
    };
  }
}