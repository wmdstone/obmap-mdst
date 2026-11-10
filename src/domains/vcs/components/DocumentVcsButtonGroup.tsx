import React, { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { GitCommit, History, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/domains/auth/hooks/useAuth';
import { useVaultStore } from '@/domains/vault/stores/useVaultStore';
import { useVcsStore } from '@/domains/vcs/stores/useVcsStore';
import { VcsCoPresenceAvatars } from '@/domains/vcs/components/VcsCoPresenceAvatars';
import { VcsQuickCommitModal } from '@/domains/vcs/components/VcsQuickCommitModal';
import { VcsDocumentHistoryModal } from '@/domains/vcs/components/VcsDocumentHistoryModal';

interface DocumentVcsButtonGroupProps {
  noteId: string;
  noteTitle: string;
  currentContent: string;
  onContentRestore: (newContent: string) => void;
}

export const DocumentVcsButtonGroup: React.FC<DocumentVcsButtonGroupProps> = ({
  noteId,
  noteTitle,
  currentContent,
  onContentRestore,
}) => {
  const { user } = useAuth();
  const currentVaultId = useVaultStore((state) => state.currentVaultId);
  const { pendingSyncCount, isProcessingSync } = useVcsStore();

  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  if (!currentVaultId || !user) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 bg-background/50 border border-border/40 rounded-md p-0.5">
        {/* Indikator Kolaborator Aktif (Co-Presence) */}
        <VcsCoPresenceAvatars vaultId={currentVaultId} noteId={noteId} />

        {/* Indikator Status Offline / Sync Pending */}
        {pendingSyncCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center px-1.5 py-0.5 text-[10px] font-mono text-amber-500 font-medium bg-amber-500/10 rounded">
                {isProcessingSync ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <CloudOff className="w-3 h-3 mr-1" />
                )}
                {pendingSyncCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {pendingSyncCount} commit menunggu sinkronisasi online
            </TooltipContent>
          </Tooltip>
        )}

        {/* Tombol Cepat: Quick Commit Dokumen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommitModalOpen(true)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
            >
              <GitCommit className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Commit Catatan Ini
          </TooltipContent>
        </Tooltip>

        {/* Tombol Cepat: Riwayat Dokumen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryModalOpen(true)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
            >
              <History className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Riwayat Versi & Diff
          </TooltipContent>
        </Tooltip>

        {/* Modal Commit */}
        <VcsQuickCommitModal
          open={commitModalOpen}
          onOpenChange={setCommitModalOpen}
          vaultId={currentVaultId}
          noteId={noteId}
          noteTitle={noteTitle}
          currentContent={currentContent}
          userId={user.id}
        />

        {/* Modal Riwayat & Diff */}
        <VcsDocumentHistoryModal
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
          vaultId={currentVaultId}
          noteId={noteId}
          noteTitle={noteTitle}
          currentContent={currentContent}
          onRestoreContent={onContentRestore}
        />
      </div>
    </TooltipProvider>
  );
};