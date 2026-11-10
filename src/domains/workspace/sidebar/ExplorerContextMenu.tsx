import React, { useState } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";
import {
  ExternalLink,
  Columns2,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  UploadCloud,
  FolderGit2,
  History,
  GitCommit,
} from "lucide-react";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import { FolderVcsDialog } from "@/domains/vcs/components/FolderVcsDialog";

export interface ContextMenuNode {
  id: string;
  name: string;
  type: "folder" | "file" | "media" | "pdf";
  parentId?: string | null;
  depth?: number;
  [key: string]: any;
}

export interface ExplorerContextMenuProps {
  node: ContextMenuNode;
  children: React.ReactNode;
  onAddNodeUnder: (targetNode: any, type: "file" | "folder") => void;
  onStartRename: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenFile?: (nodeId: string, nodeName: string, mode: "tab" | "split-horizontal") => void;
  onPublishFolder?: (node: ContextMenuNode) => void;
  vaultId?: string;
  activeBranch?: string;
  childNoteIds?: string[];
}

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  node,
  children,
  onAddNodeUnder,
  onStartRename,
  onDeleteNode,
  onOpenFile,
  onPublishFolder,
  vaultId = "current-vault",
  activeBranch = "main",
  childNoteIds = [],
}) => {
  const storeOpenFile = useWorkspaceStore((state) => state.openFile);
  const handleOpenFile = onOpenFile || storeOpenFile;
  const isFolder = node.type === "folder";

  // State dialog VCS Folder
  const [isFolderVcsOpen, setIsFolderVcsOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

        {/* Floating Context Menu - Obsidian Style */}
        <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-lg p-1 text-xs select-none z-50">
          <ContextMenuItem
            onClick={() => handleOpenFile(node.id, node.name, "tab")}
            className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{isFolder ? "Buka Folder Overview" : "Open in new tab"}</span>
          </ContextMenuItem>

          {!isFolder && (
            <ContextMenuItem
              onClick={() => handleOpenFile(node.id, node.name, "split-horizontal")}
              className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
            >
              <Columns2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Open to the right (split)</span>
            </ContextMenuItem>
          )}
          <ContextMenuSeparator className="my-1 bg-border/40" />

          <ContextMenuItem
            onClick={() => onAddNodeUnder(node, "file")}
            className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
          >
            <FilePlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{isFolder ? "New note in folder" : "New note"}</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => onAddNodeUnder(node, "folder")}
            className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
          >
            <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{isFolder ? "New subfolder" : "New folder"}</span>
          </ContextMenuItem>

          {/* Opsi Version Control Khusus Folder */}
          {isFolder && (
            <>
              <ContextMenuSeparator className="my-1 bg-border/40" />
              <ContextMenuItem
                onClick={() => setIsFolderVcsOpen(true)}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent text-primary font-medium"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-primary" />
                <span>Version Control Folder...</span>
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator className="my-1 bg-border/40" />

          <ContextMenuItem
            onClick={() => onStartRename(node.id)}
            className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm hover:bg-accent focus:bg-accent"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Rename...</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => onDeleteNode?.(node.id)}
            className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
            <span>Delete</span>
          </ContextMenuItem>

          {isFolder && (
            <>
              <ContextMenuSeparator className="my-1 bg-border/40" />
              <ContextMenuItem
                onClick={() => onPublishFolder?.(node)}
                className="gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-sm text-primary hover:bg-primary/10 focus:bg-primary/10 focus:text-primary font-medium"
              >
                <UploadCloud className="w-3.5 h-3.5 text-primary" />
                <span>Publikasikan Subfolder...</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Modal Dialog VCS Folder */}
      {isFolder && (
        <FolderVcsDialog
          open={isFolderVcsOpen}
          onOpenChange={setIsFolderVcsOpen}
          vaultId={vaultId}
          folderId={node.id}
          folderName={node.name}
          activeBranch={activeBranch}
          childNoteIds={childNoteIds}
        />
      )}
    </>
  );
};