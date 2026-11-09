import React, { useEffect, useState } from "react";
import { useVaultStore } from "@/domains/vault/stores/useVaultStore";
import { NoteService } from "@/domains/vault/services/NoteService";
import { NoteRecord } from "@/types/collaboration";
import { EditorWorkflowToolbar } from "./EditorWorkflowToolbar";

interface NoteWorkflowBarProps {
  nodeId: string;
  nodeTitle: string;
  currentContent: string;
}

export const NoteWorkflowBar: React.FC<NoteWorkflowBarProps> = ({
  nodeId,
  nodeTitle,
  currentContent,
}) => {
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const [noteRecord, setNoteRecord] = useState<NoteRecord | null>(null);
  const [publishedContent, setPublishedContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!currentVaultId || !nodeId) return;

    let isMounted = true;
    setLoading(true);

    const loadNoteData = async () => {
      try {
        // Cari catatan di cloud (baik via ID, slug, atau identifier lokal)
        const existingNote = await NoteService.findNoteInVault(
          currentVaultId,
          nodeId,
          nodeTitle
        );

        if (!isMounted) return;

        if (existingNote) {
          setNoteRecord(existingNote);

          if (existingNote.published_at) {
            const revisions = await NoteService.getRevisions(existingNote.id);
            const publishedAt = new Date(existingNote.published_at).getTime();
            const lastPublished =
              revisions.find((r) => new Date(r.created_at).getTime() <= publishedAt) ??
              revisions[0];
            if (lastPublished && isMounted) {
              setPublishedContent(lastPublished.content);
            }
          }
        } else {
          // Buat representasi draf lokal awal
          setNoteRecord({
            id: nodeId,
            vault_id: currentVaultId,
            author_id: "",
            title: nodeTitle || "Untitled",
            slug: NoteService.slugify(nodeTitle || nodeId) || "untitled",
            content: currentContent,
            frontmatter: { local_node_id: nodeId },
            status: "draft",
            version: 1,
            published_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setPublishedContent("");
        }
      } catch (err) {
        if (isMounted) {
          setNoteRecord({
            id: nodeId,
            vault_id: currentVaultId,
            author_id: "",
            title: nodeTitle,
            slug: NoteService.slugify(nodeTitle) || nodeId,
            content: currentContent,
            frontmatter: { local_node_id: nodeId },
            status: "draft",
            version: 1,
            published_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNoteData();

    return () => {
      isMounted = false;
    };
  }, [nodeId, currentVaultId, nodeTitle]);

  if (!currentVaultId || !noteRecord || loading) {
    return null;
  }

  return (
    <div className="border-b border-border/40">
      <EditorWorkflowToolbar
        note={noteRecord}
        vaultId={currentVaultId}
        currentContent={currentContent}
        publishedRevisionContent={publishedContent}
        onNoteUpdated={(updated) => {
          setNoteRecord(updated);
          if (updated.status === "published") {
            setPublishedContent(updated.content);
          }
        }}
      />
    </div>
  );
};