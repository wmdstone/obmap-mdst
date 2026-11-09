import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { toast } from "sonner";
import {
  X,
  Check,
  ChevronsUpDown,
  Cloud,
  FolderOpen,
  GripVertical,
  FolderPlus,
  FilePlus,
  SortAsc,
  Settings,
  Upload,
  Image as ImageIcon,
  FileText,
  Mic,
  Search,
} from "lucide-react";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/domains/settings/settingsNavigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { RibbonTool } from "./IconRibbon";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useUIStore } from "@/shared/stores";
import { useFolderNavigation } from "../hooks/useFolderNavigation";
import { FileExplorerTree } from "../sidebar/FileExplorerTree";
import { VcsSidebarPanel } from "@/domains/vcs/components/VcsSidebarPanel";


interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video" | "pdf";
  mimeType?: string;
  dataUrl?: string;
}

interface SidebarPanelProps {
  activeTool: RibbonTool | null;
  onClose: () => void;
  nodes: Node[];
  selectedNode: Node | null;
  onNodeSelect: (node: Node) => void;
  onNodeOpen?: (node: Node) => void;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  onNodeDelete?: (nodeId: string) => Promise<void> | void;
  onNodeUpdate?: (node: Node) => Promise<void> | void;
  onAddNode?: (type: "folder" | "file") => void;
  isVaultMode: boolean;
  vaultName: string | null;
  vaultLocation?: "folder" | "cloud";
  currentVaultId: string | null;
  availableVaults: Array<{
    id: string;
    name: string;
    location: "folder" | "cloud";
    nodeCount: number;
  }>;
  onSwitchVault: (vaultId: string) => void;
  onCloseVault: () => void;
  graphConfigTrigger?: React.ReactNode;
  onImportComplete?: (importedNodes: Node[], updatedNodes?: Node[]) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 450;
const DEFAULT_WIDTH = 260;

export function SidebarPanel({
  activeTool,
  onClose,
  nodes,
  selectedNode,
  onNodeSelect,
  onNodeOpen,
  onNodeMove,
  onNodeDelete,
  onNodeUpdate,
  onAddNode,
  isVaultMode,
  vaultName,
  currentVaultId,
  availableVaults,
  onSwitchVault,
  onImportComplete,
}: SidebarPanelProps) {
  const openView = useWorkspaceStore((state) => state.openView);
  const setExpandedFolderIds = useUIStore((state) => state.setExpandedFolderIds);
  const setActiveTool = useUIStore((state) => state.setActiveTool);

  

  const folderCount = useMemo(
    () => nodes.filter((n) => n.type === "folder").length,
    [nodes]
  );
  const fileCount = useMemo(
    () => nodes.filter((n) => n.type === "file").length,
    [nodes]
  );

  const handleOpenSettings = useCallback(() => {
    setActiveTool("settings");
    openView({ type: "settings", title: "Settings", settingsSection: "account" });
  }, [setActiveTool, openView]);

  const {
    expandedFolders,
  } = useFolderNavigation();

  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("account");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "type">("type");
  const panelRef = useRef<HTMLDivElement>(null);

  const selectSettingsSection = (section: SettingsSectionId, label: string) => {
    setActiveSettingsSection(section);
    openView({ type: "settings", title: label, settingsSection: section });
  };

  // Filter sections when search query is entered
  const filteredSections = useMemo(() => {
    const q = settingsSearch.trim().toLowerCase();
    if (!q) return null;
    return SETTINGS_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q)
    );
  }, [settingsSearch]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      const panelRect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - panelRect.left;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  const expandAll = () => {
    setExpandedFolderIds(
      nodes.filter((node) => node.type === "folder").map((node) => node.id),
    );
  };

  const collapseAll = () => {
    setExpandedFolderIds([]);
  };

   const panelTitles: Record<RibbonTool, string> = {
    files: "File Explorer",
    vcs: "Version Control",
    settings: "Settings",
  };

  if (!activeTool) return null;

  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadAcceptFilter, setUploadAcceptFilter] = useState<string>("image/*,audio/*,.pdf");

  const triggerUpload = (accept: string) => {
    setUploadAcceptFilter(accept);
    setTimeout(() => {
      fileUploadInputRef.current?.click();
    }, 50);
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let targetParentId: string | null = null;
    let targetDepth = 0;

    if (selectedNode) {
      if (selectedNode.type === "folder") {
        targetParentId = selectedNode.id;
        targetDepth = selectedNode.depth + 1;
      } else if (selectedNode.parentId) {
        targetParentId = selectedNode.parentId;
        const parentFolder = nodes.find((n) => n.id === selectedNode.parentId);
        targetDepth = parentFolder ? parentFolder.depth + 1 : 0;
      }
    }

    const newNodes: Node[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();

      let mediaType: "image" | "audio" | "pdf" = "image";
      if (file.type.startsWith("audio/") || lowerName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
        mediaType = "audio";
      } else if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        mediaType = "pdf";
      } else if (file.type.startsWith("image/") || lowerName.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/)) {
        mediaType = "image";
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const newNode: Node = {
        id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: file.name,
        content: `Uploaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        type: "media",
        parentId: targetParentId,
        depth: targetDepth,
        tags: [mediaType],
        mediaType,
        mimeType: file.type || (mediaType === "pdf" ? "application/pdf" : undefined),
        dataUrl,
      };

      newNodes.push(newNode);
    }

    if (newNodes.length > 0 && onImportComplete) {
      onImportComplete(newNodes);
      toast.success(`Berhasil mengunggah ${newNodes.length} file`);

      const lastNode = newNodes[newNodes.length - 1];
      onNodeSelect(lastNode);
      onNodeOpen?.(lastNode);
    }

    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = "";
    }
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full bg-sidebar border-r border-sidebar-border flex flex-col relative",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl max-md:w-[280px] max-md:max-w-[85vw]",
        "animate-in slide-in-from-left-2 duration-200 ease-out",
      )}
      style={{ width: window.innerWidth < 768 ? undefined : `${width}px` }}
    >
      {/* Panel Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
        <span className="text-sm font-medium text-sidebar-foreground">
          {panelTitles[activeTool]}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTool === "files" && (
          <div className="h-full flex flex-col">
            <div className="px-2 py-0.5 border-b border-sidebar-border flex items-center justify-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddNode?.("folder")}
                title="Add Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddNode?.("file")}
                title="Add File"
              >
                <FilePlus className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Upload Media / PDF"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => triggerUpload("image/*")}>
                    <ImageIcon className="w-4 h-4 mr-2 text-emerald-500" />
                    Upload Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => triggerUpload("audio/*")}>
                    <Mic className="w-4 h-4 mr-2 text-purple-500" />
                    Upload Sound / Voice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => triggerUpload(".pdf,application/pdf")}>
                    <FileText className="w-4 h-4 mr-2 text-rose-500" />
                    Upload PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => triggerUpload("image/*,audio/*,.pdf")}>
                    <Upload className="w-4 h-4 mr-2 text-primary" />
                    Upload All Files...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <input
                ref={fileUploadInputRef}
                type="file"
                multiple
                accept={uploadAcceptFilter}
                className="hidden"
                onChange={handleFileUploadChange}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Sort">
                    <SortAsc className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("name")}>
                    Sort by Name {sortBy === "name" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("type")}>
                    Sort by Type {sortBy === "type" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={expandedFolders.size > 0 ? collapseAll : expandAll}
                title={expandedFolders.size > 0 ? "Collapse All" : "Expand All"}
              >
                <ChevronsUpDown className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <FileExplorerTree
                nodes={nodes}
                selectedNode={selectedNode}
                onNodeSelect={onNodeSelect}
                onNodeOpen={onNodeOpen}
                onNodeMove={onNodeMove}
                onNodeDelete={onNodeDelete}
                onNodeUpdate={onNodeUpdate}
                currentVaultId={currentVaultId}
                sortBy={sortBy}
              />
            </ScrollArea>

            {isVaultMode && (
              <div className="p-2 border-t border-sidebar-border bg-sidebar/50 shrink-0">
                <div className="flex items-center justify-between gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left"
                        aria-label="Switch vault"
                      >
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {vaultName || "Select Vault"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {availableVaults.map((vault) => {
                        const VaultIcon =
                          vault.location === "folder" ? FolderOpen : Cloud;
                        const active = vault.id === currentVaultId;
                        return (
                          <DropdownMenuItem
                            key={vault.id}
                            onSelect={() => onSwitchVault(vault.id)}
                            className="gap-2 py-2 cursor-pointer"
                          >
                            <VaultIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {vault.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {vault.nodeCount}{" "}
                                {vault.nodeCount === 1 ? "item" : "items"}
                              </p>
                            </div>
                            {active && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex items-center shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenSettings}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors"
                      title="Settings"
                      aria-label="Open Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1.5 px-2 text-[11px] text-muted-foreground">
                  <span>
                    {folderCount} {folderCount === 1 ? "folder" : "folders"}
                  </span>
                  <span>•</span>
                  <span>
                    {fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seksi Version Control System */}
        {activeTool === "vcs" && <VcsSidebarPanel />}


        {/* SETTINGS VIEW: Bersih, Rapi, Tanpa Chevron Dropdown */}
        {activeTool === "settings" && (
          <div className="h-full flex flex-col">
            {/* Search Box Pengaturan */}
            <div className="p-2 border-b border-sidebar-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={settingsSearch}
                  onChange={(e) => setSettingsSearch(e.target.value)}
                  placeholder="Cari pengaturan..."
                  className="h-8 pl-8 pr-7 text-xs bg-sidebar-accent/40 border-sidebar-border focus-visible:ring-1"
                />
                {settingsSearch && (
                  <button
                    type="button"
                    onClick={() => setSettingsSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List Menu Pengaturan */}
            <ScrollArea className="flex-1">
              <nav className="p-2 space-y-4" aria-label="Settings navigation">
                {filteredSections ? (
                  // Hasil Pencarian
                  <div className="space-y-1">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Hasil Pencarian ({filteredSections.length})
                    </p>
                    {filteredSections.length === 0 ? (
                      <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                        Tidak ada pengaturan yang cocok.
                      </p>
                    ) : (
                      filteredSections.map((section) => {
                        const isActive = activeSettingsSection === section.id;
                        const Icon = section.icon;
                        return (
                          <Button
                            key={section.id}
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              selectSettingsSection(section.id, section.label)
                            }
                            className={cn(
                              "h-8 w-full justify-start gap-2.5 px-2 text-xs font-normal transition-colors rounded-md",
                              isActive
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                isActive ? "text-primary" : "text-muted-foreground",
                              )}
                            />
                            <div className="min-w-0 flex-1 text-left flex items-center justify-between gap-1">
                              <span className="truncate">{section.label}</span>
                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                {section.group}
                              </span>
                            </div>
                          </Button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  // Pengelompokan Kategori Statis (Modern & Tanpa Dropdown Chevron)
                  SETTINGS_GROUPS.map((group) => {
                    const sections = SETTINGS_SECTIONS.filter(
                      (section) => section.group === group,
                    );
                    if (sections.length === 0) return null;

                    return (
                      <div key={group} className="space-y-1">
                        <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
                          {group}
                        </h3>
                        <div className="space-y-0.5">
                          {sections.map((section) => {
                            const isActive = activeSettingsSection === section.id;
                            const Icon = section.icon;

                            return (
                              <Button
                                key={section.id}
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  selectSettingsSection(section.id, section.label)
                                }
                                className={cn(
                                  "h-8 w-full justify-start gap-2.5 px-2 text-xs font-normal transition-colors rounded-md",
                                  isActive
                                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    isActive
                                      ? "text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                                <span className="truncate">{section.label}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </nav>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-1 h-full cursor-col-resize group",
          "hover:bg-primary/50 transition-colors",
          isResizing && "bg-primary/50",
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs z-[-1] md:hidden"
        onClick={onClose}
      />
    </div>
  );
}
