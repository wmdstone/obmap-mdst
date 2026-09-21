/**
 * Persistence Service - Filesystem-Native Layer
 *
 * Responsibilities:
 * - Preserve vault integrity (folders + Markdown files)
 * - Provide lightweight CRUD operations against a real directory handle
 * - Emit domain events for Graph Service consumption
 * - Remain fully portable, no database required
 */

import { eventBus, EventType } from "@/shared/events/events";

export interface FileSystemNode {
  id: string;
  name: string;
  type: "folder" | "file";
  path: string[];
  parentId: string | null;
}

interface NoteSyncRequestedPayload {
  path: string[];
  content: string;
}

const isHidden = (name: string) => name.startsWith(".");

export class FileSystemService {
  private vaultHandle: FileSystemDirectoryHandle | null = null;
  private nodeIdCounter = 0;

  constructor() {
    eventBus.subscribe<NoteSyncRequestedPayload>(
      EventType.NOTE_SYNC_REQUESTED,
      async (event) => {
        if (this.vaultHandle) {
          try {
            await this.saveFile(event.payload.path, event.payload.content);
          } catch (error) {
            console.error("[FileSystemService] Error syncing file:", error);
          }
        }
      },
    );
  }

  /** Use an already-picked directory handle (no extra folder prompt). */
  attach(handle: FileSystemDirectoryHandle): void {
    this.vaultHandle = handle;
    eventBus.emit(EventType.VAULT_OPENED, {
      vaultName: handle.name,
      rootHandle: handle,
    });
  }

  /** Ask the user for a folder and use it as the vault root. */
  async openVault(): Promise<{
    vaultName: string;
    handle: FileSystemDirectoryHandle;
  } | null> {
    // Feature detection first: browsers without the File System Access API
    // must get a clear message instead of a TypeError.
    if (typeof (window as any).showDirectoryPicker !== "function") {
      throw new Error(
        "This browser cannot open folders on your computer — use Chrome or Edge on desktop.",
      );
    }
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      this.attach(dirHandle);
      return { vaultName: dirHandle.name, handle: dirHandle };
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        throw error;
      }
      return null;
    }
  }

  /** Re-request write permission for a handle restored from storage. */
  async verifyPermission(handle?: FileSystemDirectoryHandle): Promise<boolean> {
    const target = handle ?? this.vaultHandle;
    if (!target) return false;
    const anyHandle = target as any;
    try {
      if (
        (await anyHandle.queryPermission?.({ mode: "readwrite" })) === "granted"
      )
        return true;
      return (
        (await anyHandle.requestPermission?.({ mode: "readwrite" })) ===
        "granted"
      );
    } catch {
      return false;
    }
  }

  /**
   * Read vault structure and emit events for each discovered node.
   * Hidden entries (dot-files, e.g. `.vault-config.json`) are ignored.
   */
  async readVaultStructure(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<FileSystemNode[]> {
    const nodes: FileSystemNode[] = [];
    this.nodeIdCounter = 0;

    const walk = async (
      handle: FileSystemDirectoryHandle,
      parentId: string | null,
      path: string[],
    ): Promise<void> => {
      // @ts-ignore
      for await (const entry of handle.values()) {
        if (isHidden(entry.name)) continue;

        if (entry.kind === "directory") {
          const folderId = `node-${this.nodeIdCounter++}`;
          nodes.push({
            id: folderId,
            name: entry.name,
            type: "folder",
            path: [...path, entry.name],
            parentId,
          });
          eventBus.emit(EventType.FOLDER_CREATED, {
            id: folderId,
            name: entry.name,
            path: [...path, entry.name],
            parentId,
          });
          await walk(entry, folderId, [...path, entry.name]);
        } else if (entry.kind === "file" && entry.name.endsWith(".md")) {
          const fileId = `node-${this.nodeIdCounter++}`;
          const file = await entry.getFile();
          const content = await file.text();
          nodes.push({
            id: fileId,
            name: entry.name.replace(/\.md$/, ""),
            type: "file",
            path: [...path, entry.name],
            parentId,
          });
          eventBus.emit(EventType.NOTE_CREATED, {
            id: fileId,
            name: entry.name.replace(/\.md$/, ""),
            content,
            path: [...path, entry.name],
            parentId,
          });
        }
      }
    };

    await walk(dirHandle, null, []);
    return nodes;
  }

  /** Reads every Markdown file in the vault as `{ path, name, content }`. */
  async readAllNotes(
    dirHandle?: FileSystemDirectoryHandle,
  ): Promise<
    { path: string[]; name: string; type: "file" | "folder"; content: string }[]
  > {
    const root = dirHandle ?? this.vaultHandle;
    if (!root) return [];
    const out: {
      path: string[];
      name: string;
      type: "file" | "folder";
      content: string;
    }[] = [];

    const walk = async (handle: FileSystemDirectoryHandle, path: string[]) => {
      // @ts-ignore
      for await (const entry of handle.values()) {
        if (isHidden(entry.name)) continue;
        if (entry.kind === "directory") {
          out.push({
            path: [...path, entry.name],
            name: entry.name,
            type: "folder",
            content: "",
          });
          await walk(entry, [...path, entry.name]);
        } else if (entry.name.endsWith(".md")) {
          const file = await entry.getFile();
          out.push({
            path: [...path, entry.name],
            name: entry.name.replace(/\.md$/, ""),
            type: "file",
            content: await file.text(),
          });
        }
      }
    };

    await walk(root, []);
    return out;
  }

  /** Ensure a nested folder exists; returns the deepest handle. */
  async ensureDirectory(
    path: string[],
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.vaultHandle) return null;
    let current = this.vaultHandle;
    for (const segment of path) {
      try {
        current = await current.getDirectoryHandle(segment, { create: true });
      } catch (error) {
        console.error(
          "[FileSystemService] Cannot create folder",
          segment,
          error,
        );
        return null;
      }
    }
    return current;
  }

  /** Write a note. `path` is relative to the vault root, file name included. */
  async writeNote(path: string[], content: string): Promise<void> {
    await this.saveFile(path, content);
  }

  async saveFile(path: string[], content: string): Promise<void> {
    if (!this.vaultHandle) {
      throw new Error("No vault is currently open");
    }

    // Disk writes work offline; only cloud pushes are queued (SyncEngine).
    const fileHandle = await this.getFileHandle(this.vaultHandle, path);
    if (!fileHandle) throw new Error("Could not access file");

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    eventBus.emit(EventType.NOTE_UPDATED, { id: path.join("/"), content });
  }

  async deleteEntry(path: string[], type: "file" | "folder"): Promise<boolean> {
    if (!this.vaultHandle || path.length === 0) return false;
    try {
      const parent = await this.getDirectoryHandle(path.slice(0, -1), false);
      if (!parent) return false;
      await parent.removeEntry(path[path.length - 1], {
        recursive: type === "folder",
      });
      return true;
    } catch (error) {
      console.error("[FileSystemService] Delete failed:", error);
      return false;
    }
  }

  /** Move / rename by copying to the new path then removing the old one. */
  async moveEntry(
    from: string[],
    to: string[],
    type: "file" | "folder",
  ): Promise<boolean> {
    if (!this.vaultHandle || from.length === 0 || to.length === 0) return false;
    if (from.join("/") === to.join("/")) return true;

    try {
      if (type === "file") {
        const source = await this.getFileHandle(this.vaultHandle, from);
        if (!source) return false;
        const content = await (await source.getFile()).text();
        await this.saveFile(to, content);
      } else {
        const sourceDir = await this.getDirectoryHandle(from, false);
        if (!sourceDir) return false;
        await this.copyDirectory(sourceDir, to);
      }
      await this.deleteEntry(from, type);
      return true;
    } catch (error) {
      console.error("[FileSystemService] Move failed:", error);
      return false;
    }
  }

  private async copyDirectory(
    source: FileSystemDirectoryHandle,
    to: string[],
  ): Promise<void> {
    await this.ensureDirectory(to);
    // @ts-ignore
    for await (const entry of source.values()) {
      if (entry.kind === "directory") {
        await this.copyDirectory(entry, [...to, entry.name]);
      } else {
        const content = await (await entry.getFile()).text();
        await this.saveFile([...to, entry.name], content);
      }
    }
  }

  private async getDirectoryHandle(
    path: string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.vaultHandle) return null;
    let current = this.vaultHandle;
    for (const segment of path) {
      try {
        current = await current.getDirectoryHandle(segment, { create });
      } catch {
        return null;
      }
    }
    return current;
  }

  private async getFileHandle(
    dirHandle: FileSystemDirectoryHandle,
    path: string[],
  ): Promise<FileSystemFileHandle | null> {
    let currentHandle: FileSystemDirectoryHandle = dirHandle;

    for (let i = 0; i < path.length - 1; i++) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(path[i], {
          create: true,
        });
      } catch {
        return null;
      }
    }

    try {
      return await currentHandle.getFileHandle(path[path.length - 1], {
        create: true,
      });
    } catch {
      return null;
    }
  }

  closeVault(): void {
    this.vaultHandle = null;
  }

  isOpen(): boolean {
    return this.vaultHandle !== null;
  }

  getHandle(): FileSystemDirectoryHandle | null {
    return this.vaultHandle;
  }
}
