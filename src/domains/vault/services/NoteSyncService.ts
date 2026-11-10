/**
 * NoteSyncService
 *
 * Orchestrates real-time synchronization of notes, debounced auto-saving,
 * optimistic concurrency conflict checks, and Supabase Realtime channel subscriptions.
 */

import { supabase } from "@/global/api/supabaseClient";
import { NoteService, UpdateNoteInput } from "@/domains/vault/services/NoteService";
import type { NoteRecord } from "@/types/collaboration";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NoteSyncListener = (payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  newNote?: NoteRecord;
  oldNoteId?: string;
}) => void;

export class NoteSyncService {
  private activeVaultId: string | null = null;
  private channel: RealtimeChannel | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Set<NoteSyncListener> = new Set();

  /**
   * Mulai mendengarkan perubahan realtime untuk satu vault aktif.
   */
  subscribeToVault(vaultId: string): void {
    if (this.activeVaultId === vaultId && this.channel) {
      return;
    }

    this.unsubscribe();
    this.activeVaultId = vaultId;

    this.channel = supabase
      .channel(`vault-notes-${vaultId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `vault_id=eq.${vaultId}`,
        },
        (payload) => {
          this.handleRealtimeEvent(payload);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info(`[NoteSyncService] Terhubung ke channel realtime vault: ${vaultId}`);
        }
      });
  }

  /**
   * Berhenti berlangganan channel realtime.
   */
  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.activeVaultId = null;

    // Bersihkan timer autosave yang belum dieksekusi
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Mendaftarkan listener callback untuk pembaruan realtime dari pengguna lain.
   */
  addListener(listener: NoteSyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Menyimpan perubahan catatan dengan teknik debounce (default 1000ms).
   * Mencegah pemanggilan API berlebih saat mengetik.
   */
  queueDebouncedSave(
    noteId: string,
    updates: UpdateNoteInput,
    delayMs = 1000
  ): Promise<NoteRecord> {
    return new Promise((resolve, reject) => {
      if (this.debounceTimers.has(noteId)) {
        clearTimeout(this.debounceTimers.get(noteId)!);
      }

      const timer = setTimeout(async () => {
        this.debounceTimers.delete(noteId);
        try {
          const result = await NoteService.updateNote(noteId, updates);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delayMs);

      this.debounceTimers.set(noteId, timer);
    });
  }

  /**
   * Menangani event realtime yang diterima dari Supabase.
   */
  private handleRealtimeEvent(payload: any): void {
    const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";

    if (eventType === "DELETE") {
      const oldNoteId = payload.old?.id;
      this.listeners.forEach((listener) =>
        listener({ eventType, oldNoteId })
      );
    } else {
      const newNote = payload.new as NoteRecord;
      this.listeners.forEach((listener) =>
        listener({ eventType, newNote })
      );
    }
  }
}

// Singleton instance siap pakai
export const noteSyncService = new NoteSyncService();