/**
 * Graph-Awareness Validator (Penyempurnaan 1).
 * Memindai dokumen pasca-merge untuk mendeteksi broken links [[target-slug]]
 * yang mungkin timbul karena dokumen target dihapus atau diubah di branch lain.
 */

import { GraphMergeValidationResult } from '../types/vcs';

export class VcsGraphAwareness {
  private static WIKILINK_REGEX = /\[\[([a-zA-Z0-9_\-\s]+)(?:\|[^\]]+)?\]\]/g;

  /**
   * Memvalidasi seluruh konten markdown terhadap daftar slug catatan aktif di vault.
   */
  static validateContent(
    sourcePath: string,
    content: string,
    existingSlugs: Set<string>
  ): GraphMergeValidationResult {
    const lines = content.split('\n');
    const brokenLinks: GraphMergeValidationResult['brokenLinks'] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      let match: RegExpExecArray | null;
      
      const regex = new RegExp(this.WIKILINK_REGEX);
      while ((match = regex.exec(lineText)) !== null) {
        const rawTarget = match[1].trim();
        const normalizedTarget = rawTarget.toLowerCase().replace(/\s+/g, '-');

        // Jika slug tidak ditemukan di dalam vault aktif
        if (!existingSlugs.has(normalizedTarget) && !existingSlugs.has(rawTarget.toLowerCase())) {
          brokenLinks.push({
            sourcePath,
            targetSlug: rawTarget,
            line: i + 1,
          });
        }
      }
    }

    return {
      hasBrokenLinks: brokenLinks.length > 0,
      brokenLinks,
    };
  }
}