/** Bottom bar: active file path, dynamic notices, time-lapse evolution, sync and offline state. */

import { Cloud, CloudOff, Loader2, Check, AlertCircle, CheckCircle2 } from "lucide-react";
import { useNodeStore, useVaultStore, useOfflineStore } from "@/shared/stores";
import { useStatusNoticeStore } from "@/shared/stores/useStatusNoticeStore";
import { useGraphInteractionStore } from "@/domains/graph/shared/stores/useGraphInteractionStore";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";

const statusIcon = {
  idle: Cloud,
  saving: Loader2,
  saved: Check,
  error: AlertCircle,
} as const;

export function StatusBar() {
  const nodes = useNodeStore((s) => s.nodes);
  const saveStatus = useVaultStore((s) => s.saveStatus);
  const activeLeaf = useWorkspaceStore((s) => s.getActiveLeaf());
  const isOnline = useOfflineStore((s) => s.isOnline);
  const notice = useStatusNoticeStore((s) => s.notice);

  // Time-Lapse Evolution State
  const isTimeLapseActive = useGraphInteractionStore((s) => s.isTimeLapseActive);
  const timeLapseStep = useGraphInteractionStore((s) => s.timeLapseStep);
  const timeLapseTotal = useGraphInteractionStore((s) => s.timeLapseTotal);

  const node = activeLeaf?.view.nodeId
    ? nodes.find((n) => n.id === activeLeaf.view.nodeId)
    : null;
  const words = node?.content
    ? node.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const StatusIcon = statusIcon[saveStatus] ?? Cloud;

  const progressPercent = timeLapseTotal > 0 ? Math.round((timeLapseStep / timeLapseTotal) * 100) : 0;

  return (
    <div className="relative h-6 shrink-0 flex items-center justify-between px-3 border-b lg:border-b-0 lg:border-t border-border bg-muted/30 text-[11px] text-muted-foreground select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* KIRI: DYNAMIC NOTIFICATION & TIME-LAPSE STATUS DENGAN OVERFLOW SHADOW    */}
      {/* ========================================================================= */}
      <div className="relative flex items-center min-w-0 max-w-[calc(100vw-220px)] sm:max-w-md overflow-hidden">
        {isTimeLapseActive ? (
          /* NOTIFIKASI TIME-LAPSE EVOLUSI CATATAN */
          <div className="relative flex items-center gap-2 text-foreground font-medium truncate pr-6 animate-in fade-in-50 slide-in-from-bottom-1 duration-200">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="truncate">
              Evolusi Catatan: {timeLapseStep} / {timeLapseTotal}
            </span>
            
            {/* Mini Progress Bar */}
            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Overflow Shadow */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/95 to-transparent" />
          </div>
        ) : notice ? (
          /* NOTIFIKASI UMUM APLIKASI (File created, renamed, moved, etc.) */
          <div className="relative flex items-center gap-1.5 text-foreground font-medium truncate pr-6 animate-in fade-in-50 slide-in-from-bottom-1 duration-200">
            <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{notice}</span>

            {/* Overflow Shadow */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/95 to-transparent" />
          </div>
        ) : (
          /* FALLBACK DEFAULT: Word count */
          node && <span className="text-muted-foreground truncate">{words} words</span>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KANAN: INDIKATOR SAVED & ONLINE                                           */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-4 shrink-0 pl-2">
        <span className="flex items-center gap-1">
          <StatusIcon
            className={
              saveStatus === "saving" ? "w-3 h-3 animate-spin" : "w-3 h-3"
            }
          />
          {saveStatus}
        </span>

        <span className="flex items-center gap-1">
          {isOnline ? (
            <Cloud className="w-3 h-3" />
          ) : (
            <CloudOff className="w-3 h-3" />
          )}
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}
