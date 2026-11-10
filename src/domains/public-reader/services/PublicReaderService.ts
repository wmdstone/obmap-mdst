/**
 * PublicReaderService
 *
 * Mengelola pembacaan data publik (anon-safe) untuk portal terstruktur:
 * /p/:username/:vaultSlug/:noteSlug
 *
 * Dilengkapi Smart UUID Interceptor untuk kompatibilitas tautan lama/UUID.
 */

import { supabase } from "@/global/api/untypedSupabase";
import { ProfileService } from "@/domains/settings/profile/services/ProfileService";
import type { NoteRecord } from "@/types/collaboration";
import type { GraphData, Node, Link } from "@/shared/stores/types";

export interface PublicVaultOwnerInfo {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface PublicVaultInfo {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  owner: PublicVaultOwnerInfo;
}

export interface ResolvePublicRouteResult {
  status: "success" | "redirect" | "not_found";
  redirectUrl?: string;
  vault?: PublicVaultInfo;
  notes?: NoteRecord[];
  activeNote?: NoteRecord;
  graph?: GraphData;
  errorReason?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PublicReaderService {
  /**
   * Mengubah teks menjadi slug standar yang konsisten.
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
   * Helper pembuat URL publik yang konsisten di seluruh aplikasi.
   */
  static buildPublicUrl(username: string, vaultSlugOrName: string, noteSlug?: string): string {
    const cleanUser = username.trim().toLowerCase();
    const cleanVault = this.slugify(vaultSlugOrName);
    const cleanNote = noteSlug ? `/${this.slugify(noteSlug)}` : "";
    return `/p/${cleanUser}/${cleanVault}${cleanNote}`;
  }

  /**
   * Resolusi penuh rute publik dengan Smart UUID Fallback:
   * 1. Deteksi apakah parameter pertama adalah Vault UUID (/p/:vaultId/:noteSlug)
   * 2. Resolusi Username / Redirect 14 Hari
   * 3. Resolusi Vault spesifik milik user tersebut (vaultSlug unik per pemilik)
   * 4. Resolusi Catatan Terbit & Graf Interaktif
   */
  static async resolvePublicRoute(
    param1: string,
    param2?: string,
    param3?: string
  ): Promise<ResolvePublicRouteResult> {
    const cleanParam1 = (param1 || "").trim();
    const cleanParam2 = (param2 || "").trim();
    const cleanParam3 = (param3 || "").trim();

    // ------------------------------------------------------------------
    // SMART INTERCEPTOR: Jika param1 adalah UUID (Legacy /p/:vaultId/:noteSlug)
    // ------------------------------------------------------------------
    if (UUID_REGEX.test(cleanParam1)) {
      const { data: legacyVault } = await supabase
        .from("user_vaults")
        .select("id, user_id, name, description")
        .eq("id", cleanParam1)
        .maybeSingle();

      if (!legacyVault) {
        return {
          status: "not_found",
          errorReason: `Vault dengan ID '${cleanParam1}' tidak ditemukan atau bersifat privat.`,
        };
      }

      // Ambil username pemilik vault
      const { data: ownerProfile } = await (supabase.from("profiles") as any)
        .select("username")
        .eq("user_id", legacyVault.user_id)
        .maybeSingle();

      const ownerUsername = ownerProfile?.username;
      const canonicalVaultSlug = this.slugify(legacyVault.name);
      const noteSlug = cleanParam2 || cleanParam3;
      const notePart = noteSlug ? `/${this.slugify(noteSlug)}` : "";

      if (ownerUsername) {
        return {
          status: "redirect",
          redirectUrl: `/p/${ownerUsername.toLowerCase()}/${canonicalVaultSlug}${notePart}`,
        };
      }
    }

    // ------------------------------------------------------------------
    // RUTE NORMAL KANONIKAL: /p/:username/:vaultSlug/:noteSlug
    // ------------------------------------------------------------------
    const usernameParam = cleanParam1.toLowerCase();
    const vaultSlugParam = this.slugify(cleanParam2);
    const noteSlugParam = cleanParam3 ? this.slugify(cleanParam3) : undefined;

    // Langkah 1: Resolusi Username & Deteksi Pengalihan Cadangan 14 Hari
    const userResolution = await ProfileService.resolveUsernameOrRedirect(usernameParam);

    if (!userResolution) {
      return {
        status: "not_found",
        errorReason: `Penulis dengan username '@${cleanParam1}' tidak ditemukan.`,
      };
    }

    // Jika username dalam masa pengalihan 14 hari
    if (userResolution.isRedirect && userResolution.currentUsername !== usernameParam) {
      const targetNote = noteSlugParam ? `/${noteSlugParam}` : "";
      return {
        status: "redirect",
        redirectUrl: `/p/${userResolution.currentUsername}/${vaultSlugParam}${targetNote}`,
      };
    }

    // Ambil data profil penulis
    const { data: profileData } = await (supabase.from("profiles") as any)
      .select("user_id, username, full_name, avatar_url")
      .eq("user_id", userResolution.userId)
      .maybeSingle();

    const ownerInfo: PublicVaultOwnerInfo = {
      userId: userResolution.userId,
      username: userResolution.currentUsername,
      fullName: profileData?.full_name || null,
      avatarUrl: profileData?.avatar_url || null,
    };

    // Langkah 2: Resolusi Vault scoped ke user_id pemilik
    const { data: userVaults, error: vaultErr } = await supabase
      .from("user_vaults")
      .select("id, user_id, name, description")
      .eq("user_id", userResolution.userId);

    if (vaultErr || !userVaults || userVaults.length === 0) {
      return {
        status: "not_found",
        errorReason: `Tidak ada vault yang ditemukan untuk penulis '@${userResolution.currentUsername}'.`,
      };
    }

    // JIKA vaultSlugParam KOSONG (Pengunjung mengakses akar /p/:username):
    // Otomatis pilih vault pertama yang terdaftar
    let matchedVault: (typeof userVaults)[0] | undefined = undefined;

    if (!vaultSlugParam) {
      matchedVault = userVaults[0];
    } else {
      matchedVault = userVaults.find((v) => {
        const vSlug = this.slugify(v.name);
        return vSlug === vaultSlugParam || v.id.toLowerCase() === vaultSlugParam;
      });
    }

    if (!matchedVault) {
      return {
        status: "not_found",
        errorReason: `Vault '${cleanParam2}' tidak ditemukan pada akun @${userResolution.currentUsername}.`,
      };
    }

    const canonicalVaultSlug = this.slugify(matchedVault.name);

    const vaultInfo: PublicVaultInfo = {
      id: matchedVault.id,
      ownerId: matchedVault.user_id,
      name: matchedVault.name,
      slug: canonicalVaultSlug,
      description: matchedVault.description,
      owner: ownerInfo,
    };


    // Langkah 3: Ambil Catatan Terbit & Visual Graf Publik
    const [notes, graph] = await Promise.all([
      this.getPublishedNotes(vaultInfo.id),
      this.getPublishedGraph(vaultInfo.id),
    ]);

    let activeNote: NoteRecord | undefined = undefined;

    if (notes.length > 0) {
      if (noteSlugParam) {
        activeNote = notes.find((n) => n.slug === noteSlugParam) || notes[0];
      } else {
        activeNote = notes[0];
      }
    }

    // Jika pengunjung membuka /p/:username tanpa spesifikasi vault,
    // arahkan otomatis ke alamat kanonikal lengkap bila ada catatan terbit
    if (!cleanParam2 && activeNote) {
      return {
        status: "redirect",
        redirectUrl: `/p/${userResolution.currentUsername}/${canonicalVaultSlug}/${activeNote.slug}`,
      };
    }

    return {
      status: "success",
      vault: vaultInfo,
      notes,
      activeNote,
      graph,
    };
  }

  /**
   * Mengambil semua catatan berstatus 'published' dalam vault tertentu.
   */
  static async getPublishedNotes(vaultId: string): Promise<NoteRecord[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("vault_id", vaultId)
      .eq("status", "published")
      .order("title", { ascending: true });

    if (error) {
      console.error("[PublicReaderService] Gagal memuat catatan terbit:", error);
      return [];
    }

    return (data as NoteRecord[]) || [];
  }

// src/domains/public-reader/services/PublicReaderService.ts

  /**
   * Menghasilkan data graf publik (node & relasi hierarkis + wikilink) yang lengkap.
   */
  static async getPublishedGraph(vaultId: string): Promise<GraphData> {
    const notes = await this.getPublishedNotes(vaultId);
    if (notes.length === 0) {
      return { nodes: [], links: [] };
    }

    // 1. Indeks lookup untuk pencocokan cepat
    const idToNodeMap = new Map<string, Node>();
    const titleToIdMap = new Map<string, string>();
    const slugToIdMap = new Map<string, string>();
    const localIdToDbIdMap = new Map<string, string>();

    const nodes: Node[] = notes.map((note) => {
      const fm = (note.frontmatter as Record<string, any>) || {};
      const isFolder = fm.type === "folder" || fm.is_folder === true;
      const cleanSlug = this.slugify(note.slug || note.title);

      const nodeObj: Node = {
        id: note.id,
        name: note.title,
        content: note.content || "",
        type: isFolder ? ("folder" as const) : ("file" as const),
        parentId: fm.parentId || null,
        depth: typeof fm.depth === "number" ? fm.depth : isFolder ? 0 : 1,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
      };

      idToNodeMap.set(note.id, nodeObj);
      titleToIdMap.set(note.title.trim().toLowerCase(), note.id);
      slugToIdMap.set(cleanSlug, note.id);
      if (fm.local_node_id) {
        localIdToDbIdMap.set(fm.local_node_id, note.id);
      }

      return nodeObj;
    });

    const links: Link[] = [];
    const linkSet = new Set<string>();

    const addLink = (source: string, target: string, type: "hierarchy" | "backlink") => {
      if (!source || !target || source === target) return;
      if (!idToNodeMap.has(source) || !idToNodeMap.has(target)) return;
      
      const key = `${source}->${target}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source, target, type });
      }
    };

    // 2. Buat relasi Hierarki (Folder -> Subfolder / Catatan)
    for (const n of nodes) {
      if (n.parentId) {
        const parentDbId = localIdToDbIdMap.get(n.parentId) || n.parentId;
        if (idToNodeMap.has(parentDbId)) {
          addLink(parentDbId, n.id, "hierarchy");
        }
      }
    }

    // 3. Ekstraksi Wikilinks dari Markdown Content: [[Judul Catatan]] atau [[slug]]
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    for (const note of notes) {
      if (!note.content) continue;

      let match: RegExpExecArray | null;
      while ((match = wikilinkRegex.exec(note.content)) !== null) {
        const rawTarget = match[1]?.trim();
        if (!rawTarget) continue;

        const targetByTitle = titleToIdMap.get(rawTarget.toLowerCase());
        const targetBySlug = slugToIdMap.get(this.slugify(rawTarget));
        const targetId = targetByTitle || targetBySlug;

        if (targetId && targetId !== note.id) {
          addLink(note.id, targetId, "backlink");
        }
      }
    }

    // 4. Jika catatan belum memiliki relasi sama sekali (misal belum ditautkan wikilink),
    // hubungkan secara tematik berdasarkan kesamaan Folder / Tag agar membentuk klaster graf yang indah
    const folderNodes = nodes.filter((n) => n.type === "folder");
    if (folderNodes.length > 0 && links.length === 0) {
      // Hubungkan file ke folder terdekat bila ada
      for (const fileNode of nodes) {
        if (fileNode.type === "file") {
          addLink(folderNodes[0].id, fileNode.id, "hierarchy");
        }
      }
    }

    return { nodes, links };
  }
}
