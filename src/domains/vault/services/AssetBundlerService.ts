/**
 * AssetBundlerService
 *
 * Scans markdown content for embedded local media/images (data URLs, local files),
 * uploads them into the `vault-media` Supabase Storage bucket, and swaps local
 * paths with public CDN URLs before publication. Also provides ghost-link auditing.
 */

import { supabase } from "@/shared/lib/untypedSupabase";
import { NoteService } from "@/domains/vault/services/NoteService";
import type { NoteRecord } from "@/types/collaboration";

export interface MediaAssetAudit {
  originalSrc: string;
  isLocal: boolean;
  assetType: "data-uri" | "relative-path" | "remote-url";
  fileName?: string;
}

export interface GhostLinkAudit {
  targetSlug: string;
  status: "published" | "draft" | "in_review" | "missing";
  isGhost: boolean;
}

export interface PrePublishAuditResult {
  canPublish: boolean;
  mediaAssets: MediaAssetAudit[];
  ghostLinks: GhostLinkAudit[];
  localAssetsCount: number;
  ghostLinksCount: number;
}

export class AssetBundlerService {
  private static readonly BUCKET_NAME = "vault-media";
  /** Masa berlaku tautan aset: 10 tahun */
  private static readonly SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

  /**
   * Mengaudit seluruh gambar dan tautan internal sebelum catatan diterbitkan.
   */
  static async auditNoteForPublishing(
    vaultId: string,
    content: string
  ): Promise<PrePublishAuditResult> {
    const mediaAssets = this.findMediaAssets(content);
    const localAssetsCount = mediaAssets.filter((a) => a.isLocal).length;

    // Audit ghost links (tautan ke catatan yang belum terbit atau belum ada)
    const wikilinkSlugs = NoteService.extractWikilinks(content);
    const ghostLinks: GhostLinkAudit[] = [];

    if (wikilinkSlugs.length > 0) {
      const { data: existingNotes } = await supabase
        .from("notes")
        .select("slug, status")
        .eq("vault_id", vaultId)
        .in("slug", wikilinkSlugs);

      const noteStatusMap = new Map<string, string>();
      (existingNotes as Array<{ slug: string; status: string }> || []).forEach(
        (n) => noteStatusMap.set(n.slug, n.status)
      );

      for (const slug of wikilinkSlugs) {
        const status = (noteStatusMap.get(slug) as any) || "missing";
        const isGhost = status !== "published";
        ghostLinks.push({ targetSlug: slug, status, isGhost });
      }
    }

    const ghostLinksCount = ghostLinks.filter((g) => g.isGhost).length;

    return {
      canPublish: true, // Soft-warning: ghost links diizinkan dengan degradasi anggun
      mediaAssets,
      ghostLinks,
      localAssetsCount,
      ghostLinksCount,
    };
  }

  /**
   * Mengunggah seluruh media lokal ke storage Supabase dan menghasilkan markdown yang sudah dibundel.
   */
  static async bundleAndUploadAssets(
    vaultId: string,
    noteId: string,
    content: string
  ): Promise<{ bundledContent: string; uploadedCount: number }> {
    const mediaAssets = this.findMediaAssets(content);
    const localAssets = mediaAssets.filter((a) => a.isLocal);

    if (localAssets.length === 0) {
      return { bundledContent: content, uploadedCount: 0 };
    }

    let bundledContent = content;
    let uploadedCount = 0;

    for (let i = 0; i < localAssets.length; i++) {
      const asset = localAssets[i];
      try {
        let fileBlob: Blob;
        let fileExt = "png";

        if (asset.originalSrc.startsWith("data:")) {
          const match = asset.originalSrc.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (!match) continue;
          fileExt = match[1] === "jpeg" ? "jpg" : match[1];
          const byteCharacters = atob(match[2]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: `image/${match[1]}` });
        } else {
          // Tangani URL blob: atau fetchable asset lokal
          const response = await fetch(asset.originalSrc);
          fileBlob = await response.blob();
        }

        // Folder pertama wajib ID pengguna agar lolos aturan akses penyimpanan
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          console.error(`[AssetBundler] Harus login untuk mengunggah aset.`);
          continue;
        }
        const fileName = `${userId}/${vaultId}/${noteId}/${Date.now()}-${i}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(this.BUCKET_NAME)
          .upload(fileName, fileBlob, {
            contentType: fileBlob.type,
            upsert: true,
          });

        if (uploadError || !uploadData) {
          console.error(`[AssetBundler] Gagal mengunggah aset ke Cloud:`, uploadError);
          continue;
        }

        // Bucket bersifat privat, jadi gunakan tautan bertanda tangan berumur panjang
        const { data: signedData, error: signedError } = await supabase.storage
          .from(this.BUCKET_NAME)
          .createSignedUrl(uploadData.path, this.SIGNED_URL_TTL_SECONDS);

        if (signedError || !signedData) {
          console.error(`[AssetBundler] Gagal membuat tautan aset:`, signedError);
          continue;
        }

        // Gantikan src lokal di markdown dengan URL aset di cloud
        bundledContent = bundledContent.replace(
          asset.originalSrc,
          signedData.signedUrl
        );
        uploadedCount++;
      } catch (err) {
        console.error(`[AssetBundler] Kesalahan saat memproses aset:`, err);
      }
    }

    return { bundledContent, uploadedCount };
  }

  /**
   * Menemukan seluruh tag gambar markdown ![alt](src) dan tag HTML <img src="...">
   */
  private static findMediaAssets(content: string): MediaAssetAudit[] {
    const assets: MediaAssetAudit[] = [];
    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = mdImageRegex.exec(content)) !== null) {
      const src = match[2].trim();
      const isDataUri = src.startsWith("data:");
      const isRemote = src.startsWith("http://") || src.startsWith("https://");

      assets.push({
        originalSrc: src,
        isLocal: isDataUri || !isRemote,
        assetType: isDataUri
          ? "data-uri"
          : isRemote
          ? "remote-url"
          : "relative-path",
      });
    }

    return assets;
  }
}