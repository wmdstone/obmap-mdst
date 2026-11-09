import React, { useState, useMemo, useEffect } from "react";
import { Node } from "@/shared/stores/types";
import { useNodeStore } from "@/shared/stores";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { useVaultPermission } from "@/domains/auth/hooks/useVaultPermission";
import { NoteService } from "@/domains/vault/services/NoteService";
import { updateNodeAction, deleteNodeAction } from "@/domains/workspace/actions/workspaceActions";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { BulkPublishModal } from "@/domains/collaboration/components/BulkPublishModal";
import { BulkPublishService } from "@/domains/collaboration/services/BulkPublishService";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Folder,
  FileText,
  Image,
  Globe,
  MoreHorizontal,
  Search,
  CheckCircle,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  FolderTree,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib";
import { openGraphCanvas } from "@/domains/workspace/commands/graphCanvasCommands";

interface FolderOverviewEditorProps {
  folderNode: Node;
  onUpdateFolder: (updated: Node) => void;
  onDeleteFolder: (folderId: string) => void;
}

export const FolderOverviewEditor: React.FC<FolderOverviewEditorProps> = ({
  folderNode,
  onUpdateFolder,
  onDeleteFolder: _onDeleteFolder,
}) => {
  const nodes = useNodeStore((s) => s.nodes);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const permissions = useVaultPermission();
  const { user, session } = useAuth();
  const isAuthenticated = Boolean(user && session);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [publishedMap, setPublishedMap] = useState<Record<string, { status: string; slug: string }>>({});

  // Modal State untuk Publikasi Rekursif
  const [bulkModalFolder, setBulkModalFolder] = useState<Node | null>(null);

  // Temukan semua node anak langsung dari folder ini
  const childNodes = useMemo(() => {
    return nodes.filter((n) => n.parentId === folderNode.id);
  }, [nodes, folderNode.id]);

  // Hitung total keturunan (subfolder + sub-notes) secara rekursif
  const totalDescendants = useMemo(() => {
    return BulkPublishService.collectDescendantsRecursive(folderNode.id, nodes, false);
  }, [folderNode.id, nodes]);

  // Statistik ringkasan folder
  const stats = useMemo(() => {
    const total = childNodes.length;
    const notesCount = childNodes.filter((n) => n.type === "file").length;
    const subfolders = childNodes.filter((n) => n.type === "folder").length;
    const media = childNodes.filter((n) => n.type === "media" || n.type === "pdf").length;
    return { total, notes: notesCount, subfolders, media };
  }, [childNodes]);

  // Query status publikasi catatan & folder anak dari backend
  useEffect(() => {
    if (!currentVaultId || childNodes.length === 0) return;

    let isMounted = true;

    const fetchStatuses = async () => {
      const results: Record<string, { status: string; slug: string }> = {};
      for (const item of childNodes) {
        try {
          const rec = await NoteService.findNoteInVault(currentVaultId, item.id, item.name);
          if (rec) {
            results[item.id] = { status: rec.status, slug: rec.slug };
          }
        } catch {
          // Lewati item offline / draf lokal
        }
      }
      if (isMounted) {
        setPublishedMap(results);
      }
    };

    fetchStatuses();
    return () => {
      isMounted = false;
    };
  }, [currentVaultId, childNodes]);

  // Filter anak berdasarkan teks pencarian
  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) return childNodes;
    const q = searchQuery.toLowerCase();
    return childNodes.filter((n) => n.name.toLowerCase().includes(q));
  }, [childNodes, searchQuery]);

  // Checkbox seleksi bulk
  const isAllSelected =
    filteredChildren.length > 0 &&
    filteredChildren.every((n) => selectedIds.has(n.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      filteredChildren.forEach((n) => next.add(n.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Inline rename child node
  const startRename = (node: Node) => {
    setEditingId(node.id);
    setEditingName(node.name);
  };

  const commitRename = (node: Node) => {
    if (!editingName.trim() || editingName === node.name) {
      setEditingId(null);
      return;
    }
    updateNodeAction({ ...node, name: editingName.trim() }, isAuthenticated);
    setEditingId(null);
    toast.success("Nama berhasil diperbarui");
  };

  // Buka modal publikasi rekursif untuk node terpilih
  const handlePublishFolderRecursive = (targetFolder: Node) => {
    setBulkModalFolder(targetFolder);
  };

  // Render Dropdown Aksi (Shared antara Tampilan Desktop & Mobile)
  const renderItemActions = (item: Node) => {
    const isFile = item.type === "file";
    const isFolder = item.type === "folder";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 sm:h-7 sm:w-7 opacity-100 sm:opacity-80 hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground active:bg-muted/40 shrink-0"
            aria-label={`Aksi untuk ${item.name}`}
          >
            <MoreHorizontal className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 text-xs">
          <DropdownMenuItem
            onClick={() => openFile(item.id, item.name, "tab")}
            className="text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Buka di Editor
          </DropdownMenuItem>

          {/* Opsi Baru: Buka Item Langsung di Tab Graph */}
          <DropdownMenuItem
            onClick={() => {
              useNodeStore.getState().setSelectedNode(item as any);
              openGraphCanvas("graph");
            }}
            className="text-xs cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 mr-2 text-primary" />
            Buka di Tab Graph
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => startRename(item)}
            className="text-xs"
          >
            <Edit2 className="w-3.5 h-3.5 mr-2" />
            Ubah Nama
          </DropdownMenuItem>

          {/* Opsi Publikasi Rekursif untuk Folder */}
          {isFolder && permissions.canPublish && (
            <DropdownMenuItem
              onClick={() => handlePublishFolderRecursive(item)}
              className="text-xs text-primary focus:text-primary font-medium"
            >
              <FolderTree className="w-3.5 h-3.5 mr-2" />
              Publikasikan Subfolder (Rekursif)
            </DropdownMenuItem>
          )}

          {/* Opsi Publikasi Tunggal untuk Catatan */}
          {isFile && permissions.canPublish && (
            <DropdownMenuItem
              onClick={() => {
                NoteService.publishOrUpdateNote({
                  vaultId: currentVaultId!,
                  nodeId: item.id,
                  title: item.name,
                  content: item.content || "",
                  status: "published",
                  frontmatter: {
                    type: "file",
                    parentId: item.parentId,
                    depth: item.depth,
                    local_node_id: item.id,
                  },
                }).then(() => {
                  toast.success(`"${item.name}" berhasil dipublikasikan!`);
                  setPublishedMap((prev) => ({
                    ...prev,
                    [item.id]: { status: "published", slug: item.name },
                  }));
                });
              }}
              className="text-xs text-primary focus:text-primary"
            >
              <Globe className="w-3.5 h-3.5 mr-2" />
              Publikasikan Catatan Ini
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              deleteNodeAction(item.id, isAuthenticated);
              toast.success("Item dihapus");
            }}
            className="text-xs text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col gap-4 sm:gap-5 py-1 overflow-hidden">
      {/* Header Statistik & Deskripsi Folder */}
      <div className="w-full max-w-full min-w-0 rounded-lg border border-border/40 bg-muted/15 p-3 sm:p-3.5 space-y-2 sm:space-y-2.5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <Badge variant="outline" className="gap-1 sm:gap-1.5 font-medium bg-background/50 px-2 py-0.5 sm:px-2.5 sm:py-1">
            <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
            Total: {stats.total} item
          </Badge>
          <Badge variant="outline" className="gap-1 sm:gap-1.5 font-medium bg-background/50 px-2 py-0.5 sm:px-2.5 sm:py-1">
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
            {stats.notes} Catatan
          </Badge>
          <Badge variant="outline" className="gap-1 sm:gap-1.5 font-medium bg-background/50 px-2 py-0.5 sm:px-2.5 sm:py-1">
            <Folder className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
            {stats.subfolders} Subfolder
          </Badge>
          {stats.media > 0 && (
            <Badge variant="outline" className="gap-1 sm:gap-1.5 font-medium bg-background/50 px-2 py-0.5 sm:px-2.5 sm:py-1">
              <Image className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
              {stats.media} Media
            </Badge>
          )}
        </div>

        {/* Input Deskripsi Folder */}
        <Textarea
          value={folderNode.content}
          onChange={(e) => onUpdateFolder({ ...folderNode, content: e.target.value })}
          placeholder="Tambahkan catatan atau deskripsi ringkas tentang folder ini..."
          className="w-full min-h-[50px] sm:min-h-[56px] max-h-[140px] bg-background/40 border-border/30 text-xs leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none resize-y rounded-md"
        />
      </div>

      {/* Toolbar Responsif: Filter Pencarian & Tombol Rekursif Publish */}
      <div className="w-full max-w-full min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex-1 w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari file atau catatan dalam folder..."
            className="h-8 pl-8 text-xs bg-muted/20 border-border/40 focus-visible:ring-1 focus-visible:ring-offset-0 w-full"
          />
        </div>

        {permissions.canPublish && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePublishFolderRecursive(folderNode)}
            className="h-8 text-xs gap-1.5 shrink-0 border-primary/40 text-primary hover:bg-primary/10 w-full md:w-auto justify-center px-3"
          >
            <FolderTree className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              Publikasikan Semua ({totalDescendants.length + 1})
            </span>
          </Button>
        )}
      </div>

      {/* Floating Action Bar Responsif saat ada item yang dipilih */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 w-full max-w-full min-w-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 sm:px-3.5 sm:py-2 rounded-lg bg-primary text-primary-foreground shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-xs font-medium">
            {selectedIds.size} item dipilih
          </span>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            {permissions.canPublish && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePublishFolderRecursive(folderNode)}
                className="h-7 text-xs font-medium gap-1.5 flex-1 sm:flex-initial"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Publikasikan Terpilih</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-7 text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/80 shrink-0"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAMPILAN MOBILE: Touch-Friendly Card List (Layar < 768px / Mobile)      */}
      {/* ========================================================================= */}
      <div className="block md:hidden w-full max-w-full min-w-0 rounded-lg border border-border/60 overflow-hidden bg-background">
        {/* Header Bar Mobile dengan Checkbox Pilih Semua */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40 text-muted-foreground text-xs font-medium">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Pilih semua item"
            />
            <span>Pilih Semua ({filteredChildren.length})</span>
          </label>
        </div>

        <div className="divide-y divide-border/20 w-full max-w-full">
          {filteredChildren.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {searchQuery ? "Tidak ada file yang cocok dengan pencarian." : "Folder ini masih kosong."}
            </div>
          ) : (
            filteredChildren.map((item) => {
              const isFolder = item.type === "folder";
              const isMedia = item.type === "media" || item.type === "pdf";
              const isEditing = editingId === item.id;
              const pubInfo = publishedMap[item.id];
              const isPublished = pubInfo?.status === "published";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 transition-colors w-full max-w-full min-w-0",
                    selectedIds.has(item.id) ? "bg-muted/30" : "hover:bg-muted/15"
                  )}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 flex items-center">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelectOne(item.id)}
                      aria-label={`Pilih ${item.name}`}
                    />
                  </div>

                  {/* Informasi Dokumen & Inline Rename */}
                  <div className="flex-1 min-w-0 max-w-full flex flex-col gap-1 overflow-hidden">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full min-w-0">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(item);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="h-7 text-xs bg-background border-primary/50 focus-visible:ring-1 flex-1 min-w-0"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => commitRename(item)}
                          className="h-6 w-6 text-emerald-500 hover:text-emerald-600 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFile(item.id, item.name, "tab")}
                        className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors text-left font-medium text-xs leading-snug group w-full min-w-0 overflow-hidden"
                      >
                        {isFolder ? (
                          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : isMedia ? (
                          <Image className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                        <span className="truncate block min-w-0 flex-1 group-hover:underline">
                          {item.name}
                        </span>
                      </button>
                    )}

                    {/* Baris Badge Tipe & Status Web */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-normal uppercase tracking-wider py-0 px-1 leading-none h-4 shrink-0"
                      >
                        {item.type}
                      </Badge>

                      {isPublished ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[9px] px-1 py-0 font-medium gap-0.5 leading-none h-4 shrink-0">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Terbit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground leading-none h-4 shrink-0">
                          Draf
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Tombol Aksi Kanan (Selalu Tetap Tampak di Layar Mobile) */}
                  <div className="shrink-0 flex items-center ml-auto pl-1">
                    {renderItemActions(item)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAMPILAN TABLET/DESKTOP: Notion Table (Layar >= 768px, Table-Fixed)    */}
      {/* ========================================================================= */}
      <div className="hidden md:block w-full max-w-full min-w-0 rounded-lg border border-border/60 overflow-hidden bg-background">
        <div className="w-full max-w-full min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-muted-foreground font-medium">
                <th className="w-10 px-3 py-2 text-center shrink-0">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua item"
                  />
                </th>
                <th className="px-3 py-2 w-auto min-w-0 font-medium">Nama Dokumen</th>
                <th className="w-20 px-3 py-2 shrink-0">Tipe</th>
                <th className="w-28 px-3 py-2 shrink-0">Status Web</th>
                <th className="w-14 px-3 py-2 text-right shrink-0">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredChildren.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {searchQuery ? "Tidak ada file yang cocok dengan pencarian." : "Folder ini masih kosong."}
                  </td>
                </tr>
              ) : (
                filteredChildren.map((item) => {
                  const isFolder = item.type === "folder";
                  const isMedia = item.type === "media" || item.type === "pdf";
                  const isEditing = editingId === item.id;
                  const pubInfo = publishedMap[item.id];
                  const isPublished = pubInfo?.status === "published";

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "group transition-colors hover:bg-muted/20",
                        selectedIds.has(item.id) && "bg-muted/30",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-2 text-center shrink-0">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelectOne(item.id)}
                          aria-label={`Pilih ${item.name}`}
                        />
                      </td>

                      {/* Judul & Inline Rename (max-w-0 mengunci table-fixed agar tidak meluap) */}
                      <td className="px-3 py-2 font-medium max-w-0 overflow-hidden">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 w-full min-w-0">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(item);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              className="h-7 text-xs bg-background border-primary/50 focus-visible:ring-1 flex-1 min-w-0"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => commitRename(item)}
                              className="h-6 w-6 text-emerald-500 hover:text-emerald-600 shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openFile(item.id, item.name, "tab")}
                            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors text-left group-hover:underline w-full min-w-0 overflow-hidden"
                          >
                            {isFolder ? (
                              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : isMedia ? (
                              <Image className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate block min-w-0 flex-1">{item.name}</span>
                          </button>
                        )}
                      </td>

                      {/* Tipe Badge */}
                      <td className="w-20 px-3 py-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-normal uppercase tracking-wider py-0 px-1.5 leading-none h-4"
                        >
                          {item.type}
                        </Badge>
                      </td>

                      {/* Status Publikasi */}
                      <td className="w-28 px-3 py-2 shrink-0">
                        {isPublished ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[9px] px-1.5 py-0 font-medium gap-1 leading-none h-4">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Terbit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground leading-none h-4">
                            Draf
                          </Badge>
                        )}
                      </td>

                      {/* Tombol Aksi Dropdown */}
                      <td className="w-14 px-3 py-2 text-right shrink-0">
                        {renderItemActions(item)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Eksekusi Publikasi Rekursif */}
      <BulkPublishModal
        open={Boolean(bulkModalFolder)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setBulkModalFolder(null);
        }}
        folderNode={bulkModalFolder as any}
        allNodes={nodes as any}
        currentVaultId={currentVaultId}
      />
    </div>
  );
};