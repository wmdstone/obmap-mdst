/**
 * Writes note and folder changes to the vault folder on disk.
 *
 * Any vault attached to a folder gets real `.md` files and directories, so the
 * vault stays readable by other editors. Vaults without a folder are no-ops.
 */

import type { Vault } from "../vault/VaultManager";

export interface WritableNode {
  id: string;
  name: string;
  content?: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
}

const safeSegment = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "-").trim() || "untitled";

/** Folder names from the root down to this node, plus its own file name. */
export function nodePathSegments(
  nodes: WritableNode[],
  nodeId: string,
): string[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return null;

  const segments: string[] = [];
  let current: WritableNode | undefined = node;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    segments.unshift(
      current.type === "folder"
        ? safeSegment(current.name)
        : `${safeSegment(current.name)}.md`,
    );
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return segments;
}

const hasFolder = (vault: Vault | null | undefined): vault is Vault =>
  !!vault?.persistenceService?.isOpen();

const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Create the file or directory for a node. */
export async function writeNodeToDisk(
  vault: Vault | null | undefined,
  nodes: WritableNode[],
  nodeId: string,
): Promise<void> {
  if (!hasFolder(vault)) return;
  const path = nodePathSegments(nodes, nodeId);
  const node = nodes.find((n) => n.id === nodeId);
  if (!path || !node) return;

  if (node.type === "folder") {
    await vault.persistenceService!.ensureDirectory(path);
  } else {
    await vault.persistenceService!.saveFile(path, node.content ?? "");
  }
}

/** Debounced content write, used while the user is typing. */
export function scheduleNodeWrite(
  vault: Vault | null | undefined,
  nodes: WritableNode[],
  nodeId: string,
  delayMs = 600,
): void {
  if (!hasFolder(vault)) return;
  const key = `${vault.id}:${nodeId}`;
  clearTimeout(writeTimers.get(key));
  writeTimers.set(
    key,
    setTimeout(() => {
      writeTimers.delete(key);
      writeNodeToDisk(vault, nodes, nodeId).catch((error) =>
        console.error("[VaultFileWriter] write failed:", error),
      );
    }, delayMs),
  );
}

export async function deleteNodeFromDisk(
  vault: Vault | null | undefined,
  nodesBefore: WritableNode[],
  nodeId: string,
): Promise<void> {
  if (!hasFolder(vault)) return;
  const node = nodesBefore.find((n) => n.id === nodeId);
  const path = nodePathSegments(nodesBefore, nodeId);
  if (!node || !path) return;
  await vault.persistenceService!.deleteEntry(
    path,
    node.type === "folder" ? "folder" : "file",
  );
}

export async function moveNodeOnDisk(
  vault: Vault | null | undefined,
  nodesBefore: WritableNode[],
  nodesAfter: WritableNode[],
  nodeId: string,
): Promise<void> {
  if (!hasFolder(vault)) return;
  const from = nodePathSegments(nodesBefore, nodeId);
  const to = nodePathSegments(nodesAfter, nodeId);
  const node = nodesAfter.find((n) => n.id === nodeId);
  if (!from || !to || !node || from.join("/") === to.join("/")) return;
  await vault.persistenceService!.moveEntry(
    from,
    to,
    node.type === "folder" ? "folder" : "file",
  );
}

/** Write a whole node list out (used when attaching a folder or importing). */
export async function writeAllNodesToDisk(
  vault: Vault | null | undefined,
  nodes: WritableNode[],
): Promise<void> {
  if (!hasFolder(vault)) return;
  for (const node of nodes.filter((n) => n.type === "folder")) {
    await writeNodeToDisk(vault, nodes, node.id);
  }
  for (const node of nodes.filter((n) => n.type !== "folder")) {
    await writeNodeToDisk(vault, nodes, node.id);
  }
}
