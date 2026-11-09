/**
 * 3-Way Merge Algorithm (P4).
 * Membandingkan:
 * - base: Titik percabangan bersama (ancestor)
 * - current: Versi target branch (HEAD saat ini)
 * - incoming: Versi cabang yang ingin digabungkan
 */

export interface MergeConflictBlock {
  id: string;
  startLine: number;
  baseText: string;
  currentText: string;
  incomingText: string;
  resolution?: 'current' | 'incoming' | 'both' | 'custom';
  customText?: string;
}

export interface MergeResult {
  hasConflicts: boolean;
  mergedContent: string;
  conflictBlocks: MergeConflictBlock[];
}

export class VcsDiffEngine {
  /**
   * Menjalankan 3-Way Merge baris demi baris.
   */
  static threeWayMerge(baseContent: string, currentContent: string, incomingContent: string): MergeResult {
    // Jika salah satu sisi identik dengan base, gunakan sisi lain secara otomatis
    if (baseContent === currentContent) {
      return { hasConflicts: false, mergedContent: incomingContent, conflictBlocks: [] };
    }
    if (baseContent === incomingContent) {
      return { hasConflicts: false, mergedContent: currentContent, conflictBlocks: [] };
    }
    if (currentContent === incomingContent) {
      return { hasConflicts: false, mergedContent: currentContent, conflictBlocks: [] };
    }

    const baseLines = (baseContent || '').split('\n');
    const currentLines = (currentContent || '').split('\n');
    const incomingLines = (incomingContent || '').split('\n');

    const resultLines: string[] = [];
    const conflictBlocks: MergeConflictBlock[] = [];

    let bIdx = 0;
    let cIdx = 0;
    let iIdx = 0;

    let lineCounter = 1;

    while (cIdx < currentLines.length || iIdx < incomingLines.length) {
      const cLine = currentLines[cIdx];
      const iLine = incomingLines[iIdx];
      const bLine = baseLines[bIdx];

      // Kasus 1: Kedua sisi memiliki baris yang identik
      if (cLine === iLine) {
        if (cLine !== undefined) resultLines.push(cLine);
        cIdx++;
        iIdx++;
        bIdx++;
        lineCounter++;
        continue;
      }

      // Kasus 2: Hanya sisi incoming yang mengubah baris dari base
      if (cLine === bLine && iLine !== bLine) {
        if (iLine !== undefined) resultLines.push(iLine);
        cIdx++;
        iIdx++;
        bIdx++;
        lineCounter++;
        continue;
      }

      // Kasus 3: Hanya sisi current yang mengubah baris dari base
      if (iLine === bLine && cLine !== bLine) {
        if (cLine !== undefined) resultLines.push(cLine);
        cIdx++;
        iIdx++;
        bIdx++;
        lineCounter++;
        continue;
      }

      // Kasus 4: Terjadi Konflik (Keduanya mengubah baris yang sama dengan hasil berbeda)
      const conflictId = `conflict_${lineCounter}_${Math.random().toString(36).substring(2, 6)}`;
      const conflict: MergeConflictBlock = {
        id: conflictId,
        startLine: lineCounter,
        baseText: bLine || '',
        currentText: cLine || '',
        incomingText: iLine || '',
      };

      conflictBlocks.push(conflict);

      // Tandai placeholder format standar git
      resultLines.push(`<<<<<<< CURRENT (Branch Aktif)\n${cLine || ''}\n=======\n${iLine || ''}\n>>>>>>> INCOMING`);
      
      cIdx++;
      iIdx++;
      bIdx++;
      lineCounter++;
    }

    return {
      hasConflicts: conflictBlocks.length > 0,
      mergedContent: resultLines.join('\n'),
      conflictBlocks,
    };
  }

  /**
   * Menyusun konten akhir berdasarkan resolusi pengguna pada blok-blok konflik.
   */
  static applyResolutions(originalMerged: string, resolvedBlocks: MergeConflictBlock[]): string {
    let output = originalMerged;

    for (const block of resolvedBlocks) {
      const placeholderRegex = new RegExp(
        `<<<<<<< CURRENT \\(Branch Aktif\\)\\n${escapeRegExp(block.currentText)}\\n=======\\n${escapeRegExp(block.incomingText)}\\n>>>>>>> INCOMING`,
        'g'
      );

      let replacement = '';
      if (block.resolution === 'current') {
        replacement = block.currentText;
      } else if (block.resolution === 'incoming') {
        replacement = block.incomingText;
      } else if (block.resolution === 'both') {
        replacement = `${block.currentText}\n${block.incomingText}`;
      } else if (block.resolution === 'custom' && block.customText !== undefined) {
        replacement = block.customText;
      } else {
        replacement = block.currentText; // Default fallback aman
      }

      output = output.replace(placeholderRegex, replacement);
    }

    return output;
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}