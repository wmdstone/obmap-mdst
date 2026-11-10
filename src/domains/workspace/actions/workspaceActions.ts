/**
 * vaultSessionActions - Operasi mutasi catatan, sinkronisasi disk, dan navigasi workspace.
 * Diekstraksi dari VaultSessionContext untuk eliminasi dual-state dan waterfall re-rendering.
 */

import { toast } from "sonner";
import {
  useNodeStore,
  useVaultStore,
  type Backlink,
  type Node,
} from "@/shared/stores";
import { extractMentions } from "@/domains/metadata/markdown-parser";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import {
  deleteNodeFromDisk,
  moveNodeOnDisk,
  scheduleNodeWrite,
  writeAllNodesToDisk,
  writeNodeToDisk,
} from "@/domains/vault/persistence/VaultFileWriter";
import {
  enrichNode,
  metadataCache,
} from "@/domains/metadata/MetadataCache";
import {
  linkMentions,
  renameNode,
} from "@/domains/vault/services/FileManager";
import { isFeatureEnabled } from "@/domains/settings/plugins/feature-toggles";
import { syncEngine } from "@/domains/sync/SyncEngine";
import { useStatusNoticeStore } from "@/shared/stores/useStatusNoticeStore";
import { supabase } from "@/global/api/untypedSupabase";


/** Sinkronisasi status tombol undo/redo ke useVaultStore */
export function refreshUndoRedoState(vaultId: string | null): void {
  if (!vaultId) return;
  const vaultManager = getVaultManager();
  useVaultStore.getState().updateUndoRedoState(
    vaultManager.canUndo(vaultId),
    vaultManager.canRedo(vaultId),
  );
}

/** Simpan seluruh state vault aktif ke IndexedDB / Folder disk dan Cloud */
export async function saveCurrentVaultAction(isAuthenticated: boolean = false): Promise<void> {
  const vaultManager = getVaultManager();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  if (!currentVaultId) return;

  const { setSaveStatus, setLastSaved } = useVaultStore.getState();

  setSaveStatus("saving");
  try {
    await vaultManager.saveCurrentVault();
    await vaultManager.recordVaultChange(currentVaultId);

    if (isAuthenticated && isFeatureEnabled("cloud-sync")) {
      const result = await syncEngine.syncVault(vaultManager, currentVaultId);
      if (result.conflicts?.length) {
        toast.warning(
          `Saved with ${result.conflicts.length} conflict cop${result.conflicts.length === 1 ? "y" : "ies"}`,
          { description: result.conflicts.join(", ") }
        );
      }
    }
    setSaveStatus("saved");
    setLastSaved(new Date());
  } catch (error) {
    setSaveStatus("error");
    console.error("Save failed:", error);
  }
}

/** Commit daftar note ke history, disk, dan graph service */
export async function commitNodesAction(
  nextNodes: Node[],
  isAuthenticated: boolean = false
): Promise<void> {
  const currentVaultId = useVaultStore.getState().currentVaultId;
  useNodeStore.getState().setNodes(nextNodes);
  if (!currentVaultId) return;

  const vaultManager = getVaultManager();
  const vault = vaultManager.getVault(currentVaultId);
  if (!vault) return;

  nextNodes.forEach((n: Node) => vault.graphService.setNode(n));
  vault.history.addState(nextNodes, []);
  await writeAllNodesToDisk(vault, nextNodes);
  await saveCurrentVaultAction(isAuthenticated);
  refreshUndoRedoState(currentVaultId);
}

/** Buat file atau folder baru di direktori terpilih atau root */
export async function addNodeAction(
  type: "folder" | "file",
  isAuthenticated: boolean = false
): Promise<Node> {
  const { selectedNode, nodes, addNode, setSelectedNode } = useNodeStore.getState();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  const vaultManager = getVaultManager();

  let parentNode: Node | null = null;
  if (selectedNode) {
    if (selectedNode.type === "folder") {
      parentNode = selectedNode;
    } else if (selectedNode.parentId) {
      parentNode = nodes.find((n: Node) => n.id === selectedNode.parentId) ?? null;
    }
  }

  const newNode: Node = {
    id: `node-${Date.now()}`,
    name:
      type === "folder"
        ? `New Folder ${nodes.filter((n: Node) => n.type === "folder").length + 1}`
        : `New File ${nodes.filter((n: Node) => n.type === "file").length + 1}`,
    content: "",
    type,
    parentId: parentNode?.id || null,
    depth: parentNode ? parentNode.depth + 1 : 0,
    tags: [],
  };

  addNode(newNode);
  setSelectedNode(newNode);
  if (type === "file") {
    useWorkspaceStore.getState().openFile(newNode.id, newNode.name);
  }

  if (currentVaultId) {
    const vault = vaultManager.getVault(currentVaultId);
    if (vault) {
      vault.graphService.setNode(newNode);
      await writeNodeToDisk(vault, [...nodes, newNode], newNode.id);
      vault.history.addState([...nodes, newNode], []);
      await saveCurrentVaultAction(isAuthenticated);
      refreshUndoRedoState(currentVaultId);
    }
  }

  useStatusNoticeStore
    .getState()
    .setNotice(`${type === "folder" ? "Folder" : "File"} "${newNode.name}" created`);
  return newNode;
}

/** Update isi / metadata node, tangani penulisan debounced dan refactor wikilink saat rename */
export async function updateNodeAction(
  incomingNode: Node,
  isAuthenticated: boolean = false
): Promise<void> {
  const { nodes, updateNode } = useNodeStore.getState();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  const vaultManager = getVaultManager();

  const previous = nodes.find((n: Node) => n.id === incomingNode.id);
  const updatedNode = enrichNode(
    incomingNode,
    metadataCache.parse(incomingNode.content ?? "")
  );

  // Jika nama berubah (rename), perbarui seluruh wikilink yang mengarah ke note ini
  if (
    previous &&
    previous.type !== "folder" &&
    previous.name !== updatedNode.name
  ) {
    const base = nodes.map((n: Node) =>
      n.id === updatedNode.id ? updatedNode : n
    );
    const { nodes: renamed, updatedFiles } = renameNode(
      base,
      updatedNode.id,
      updatedNode.name
    );
    const renameVault = currentVaultId
      ? vaultManager.getVault(currentVaultId)
      : null;
    await moveNodeOnDisk(renameVault, nodes, renamed, updatedNode.id);
    await commitNodesAction(renamed, isAuthenticated);
    if (updatedFiles.length > 0) {
      useStatusNoticeStore
        .getState()
        .setNotice(
          `Renamed to "${updatedNode.name}" · updated ${updatedFiles.length} note link${updatedFiles.length > 1 ? "s" : ""}`
        );
    } else {
      useStatusNoticeStore
        .getState()
        .setNotice(`Renamed to "${updatedNode.name}"`);
    }
    return;
  }

  updateNode(updatedNode);

  if (currentVaultId) {
    syncEngine.markDirty(currentVaultId, updatedNode.id);
    const vault = vaultManager.getVault(currentVaultId);
    if (vault) {
      vault.graphService.setNode(updatedNode);
      scheduleNodeWrite(
        vault,
        nodes.map((n: Node) => (n.id === updatedNode.id ? updatedNode : n)),
        updatedNode.id
      );
      vault.history.addState(
        nodes.map((n: Node) => (n.id === updatedNode.id ? updatedNode : n)),
        []
      );
      await saveCurrentVaultAction(isAuthenticated);
      refreshUndoRedoState(currentVaultId);
    }
  }
}

/** Hapus node beserta seluruh turunannya dan tutup tab workspace yang bersangkutan */
export async function deleteNodeAction(
  nodeId: string,
  isAuthenticated: boolean = false
): Promise<void> {
  const { nodes, getDescendants, deleteNodes } = useNodeStore.getState();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  const vaultManager = getVaultManager();

  const nodeToDelete = nodes.find((n: Node) => n.id === nodeId);
  const nodesBefore = nodes;
  const nodesToDelete = new Set<string>([nodeId]);
  if (nodeToDelete?.type === "folder") {
    getDescendants(nodeId).forEach((d: Node) => nodesToDelete.add(d.id));
  }
  deleteNodes(nodesToDelete);

  // Tutup seluruh tab yang menampilkan note yang telah dihapus
  const { root, closeLeaf } = useWorkspaceStore.getState();
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.kind === "split") stack.push(...current.children);
    else
      current.leaves
        .filter((l) => l.view.nodeId && nodesToDelete.has(l.view.nodeId))
        .forEach((l) => closeLeaf(l.id));
  }

  if (currentVaultId) {
    const vault = vaultManager.getVault(currentVaultId);
    if (vault) {
      nodesToDelete.forEach((id) => vault.graphService.deleteNode(id));
      await deleteNodeFromDisk(vault, nodesBefore, nodeId);
      vault.history.addState(
        nodes.filter((node: Node) => !nodesToDelete.has(node.id)),
        []
      );
      await saveCurrentVaultAction(isAuthenticated);
      refreshUndoRedoState(currentVaultId);
    }
  }
}

/** Pindahkan node ke folder parent baru di memori dan struktur file disk */
export async function moveNodeAction(
  nodeId: string,
  newParentId: string | null,
  isAuthenticated: boolean = false
): Promise<void> {
  const { nodes, moveNode } = useNodeStore.getState();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  const vaultManager = getVaultManager();

  const node = nodes.find((n: Node) => n.id === nodeId);
  const newParent = newParentId
    ? nodes.find((n: Node) => n.id === newParentId)
    : null;
  if (!node) return;
  if (newParent && newParent.type !== "folder") {
    toast.error("Only folders can contain children");
    return;
  }

  const nodesBeforeMove = nodes;
  moveNode(nodeId, newParentId, newParent ? newParent.depth + 1 : 0);

  if (currentVaultId) {
    const vault = vaultManager.getVault(currentVaultId);
    if (vault) {
      const updatedNodes = useNodeStore.getState().nodes;
      updatedNodes.forEach((n: Node) => vault.graphService.setNode(n));
      await moveNodeOnDisk(vault, nodesBeforeMove, updatedNodes, nodeId);
      vault.history.addState(updatedNodes, []);
      await saveCurrentVaultAction(isAuthenticated);
      refreshUndoRedoState(currentVaultId);
    }
  }

  useStatusNoticeStore
    .getState()
    .setNotice(`Moved "${node.name}" to ${newParent ? newParent.name : "root"}`);
}

/** Ubah plain-text mentions targetName di dalam sourceNodeId menjadi wikilink formal */
export async function linkMentionAction(
  sourceNodeId: string,
  targetName: string,
  isAuthenticated: boolean = false
): Promise<void> {
  const { nodes } = useNodeStore.getState();
  const source = nodes.find((n: Node) => n.id === sourceNodeId);
  if (!source) return;
  const content = linkMentions(source.content ?? "", targetName);
  if (content === source.content) return;
  const updated = enrichNode(
    { ...source, content },
    metadataCache.parse(content)
  );
  await commitNodesAction(
    nodes.map((n: Node) => (n.id === sourceNodeId ? updated : n)),
    isAuthenticated
  );
  toast.success(`Linked "${targetName}" in ${source.name}`);
}

/** Tangani hasil import file / zip */
export async function importCompleteAction(
  importedNodes: Node[],
  updatedNodes?: Node[],
  isAuthenticated: boolean = false
): Promise<void> {
  const { nodes, setNodes } = useNodeStore.getState();
  const currentVaultId = useVaultStore.getState().currentVaultId;
  const vaultManager = getVaultManager();

  let result = [...nodes, ...importedNodes];
  if (updatedNodes && updatedNodes.length > 0) {
    const updateMap = new Map(updatedNodes.map((n: Node) => [n.id, n]));
    result = result.map((node: Node) => updateMap.get(node.id) || node);
  }
  setNodes(result);

  if (currentVaultId) {
    const vault = vaultManager.getVault(currentVaultId);
    if (vault) {
      result.forEach((n: Node) => vault.graphService.setNode(n));
      await writeAllNodesToDisk(vault, result);
      vault.history.addState(result, []);
      await saveCurrentVaultAction(isAuthenticated);
    }
  }
}

/** Navigasi / buka file saat wikilink [[Target Note]] diklik */
export function handleWikilinkClick(target: string): void {
  const nodes = useNodeStore.getState().nodes;
  const targetNode = nodes.find(
    (node: Node) =>
      node.name.toLowerCase() === target.toLowerCase() &&
      node.type === "file"
  );
  if (targetNode) {
    useNodeStore.getState().setSelectedNode(targetNode);
    useWorkspaceStore.getState().openFile(targetNode.id, targetNode.name);
  } else {
    toast.error(`Note "${target}" not found`);
  }
}

/** Tampilkan notifikasi pencarian saat tag #tag diklik */
export function handleTagClick(tag: string): void {
  const nodes = useNodeStore.getState().nodes;
  const nodesWithTag = nodes.filter((node: Node) => node.tags.includes(tag));
  if (nodesWithTag.length > 0) {
    toast.info(`Found ${nodesWithTag.length} note(s) with tag #${tag}`);
  } else {
    toast.error(`No notes found with tag #${tag}`);
  }
}

/** Hitung daftar backlinks murni (wikilinks + unlinked mentions) untuk suatu note */
export function getBacklinksForNode(
  targetNode: Node,
  nodes: Node[],
  getNodePath: (nodeId: string) => string
): Backlink[] {
  if (!targetNode || targetNode.type === "folder") return [];
  const links: Backlink[] = [];
  const linked = new Set(
    metadataCache.getBacklinks(targetNode.id).map((ref) => ref.nodeId)
  );

  nodes.forEach((node: Node) => {
    if (node.id === targetNode.id || node.type === "folder") return;
    if (linked.has(node.id)) {
      links.push({
        nodeId: node.id,
        nodeName: node.name,
        nodePath: getNodePath(node.id),
        isWikilink: true,
      });
    } else if (extractMentions(node.content ?? "", targetNode.name)) {
      links.push({
        nodeId: node.id,
        nodeName: node.name,
        nodePath: getNodePath(node.id),
        isWikilink: false,
      });
    }
  });

  return links;
}

export async function closeVaultAction(): Promise<void> {
  const currentVaultId = useVaultStore.getState().currentVaultId;
  if (!currentVaultId) return;
  const vaultManager = getVaultManager();
  await vaultManager.deleteVault(currentVaultId);
  useVaultStore.getState().reset();
  useNodeStore.getState().reset();
  toast.info("Vault closed");
}

export async function switchVaultAction(vaultId: string): Promise<void> {
  const currentVaultId = useVaultStore.getState().currentVaultId;
  if (vaultId === currentVaultId) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error("Silakan masuk terlebih dahulu untuk mengakses vault");
    return;
  }

  // Verifikasi izin akses vault
  const { data: isSuperadmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "superadmin")
    .maybeSingle();

  if (!isSuperadmin) {
    const [vaultCheck, memberCheck] = await Promise.all([
      supabase.from("user_vaults").select("user_id").eq("id", vaultId).maybeSingle(),
      supabase.from("vault_members").select("role").eq("vault_id", vaultId).eq("user_id", user.id).maybeSingle(),
    ]);

    const isOwner = vaultCheck.data?.user_id === user.id;
    const isMember = !!memberCheck.data?.role;

    if (!isOwner && !isMember) {
      toast.error("Akses ditolak: Anda tidak memiliki izin untuk mengakses vault ini");
      return;
    }
  }

  const vaultManager = getVaultManager();
  const nextVault = vaultManager.getVault(vaultId);
  if (!nextVault) {
    toast.error("Vault tidak tersedia");
    return;
  }

  const switched = await vaultManager.switchVault(vaultId);
  if (!switched) {
    toast.error("Gagal beralih ke vault");
    return;
  }

  useVaultStore.getState().setCurrentVaultId(vaultId);
  useNodeStore.getState().setNodes(nextVault.graphService.getGraphData().nodes);
  toast.success(`Beralih ke vault "${nextVault.name}"`);
}