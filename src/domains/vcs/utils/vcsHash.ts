/**
 * Utilitas hashing kriptografis SHA-256 untuk VCS (Content-Addressable Deduplication - P9).
 * Menghitung hash unik untuk teks markdown/JSON maupun data biner.
 */

export class VcsHashUtil {
  /**
   * Menghasilkan hash SHA-256 hex string dari teks string (UTF-8).
   */
  static async hashText(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    return this.hashBuffer(data);
  }

  /**
   * Menghasilkan hash SHA-256 hex string dari ArrayBuffer / Uint8Array (misal gambar / file media).
   */
  static async hashBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const data: BufferSource =
      buffer instanceof Uint8Array
        ? (buffer.buffer as ArrayBuffer)
        : buffer;

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Menghasilkan hash commit pendek (7 karakter pertama), mirip format Git.
   */
  static shortHash(fullHash: string): string {
    return fullHash.substring(0, 7);
  }

  /**
   * Menghitung ukuran byte string dalam format UTF-8.
   */
  static getByteSize(content: string): number {
    return new TextEncoder().encode(content).length;
  }
}