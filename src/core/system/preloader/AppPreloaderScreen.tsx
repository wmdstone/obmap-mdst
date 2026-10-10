import React, { useEffect, useState } from 'react';
import { 
  runModulePreloader, 
  preloadRegistry, 
  PreloadProgressState, 
  ModuleCategory 
} from './modulePreloader';
import { Badge } from '@/shared/ui/badge';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { CheckCircle2, Clock, HardDrive, Cpu, Layers } from 'lucide-react';

const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  system: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  shell: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  workspace: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  editor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  graph: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  settings: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  plugin: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

interface AppPreloaderScreenProps {
  onLoaded: () => void;
}

export const AppPreloaderScreen: React.FC<AppPreloaderScreenProps> = ({ onLoaded }) => {
  const [state, setState] = useState<PreloadProgressState>(() => ({
    currentIndex: 0,
    totalModules: preloadRegistry.getTotal(), // <-- Dinamis mengikuti registry aktual
    currentModuleName: 'Menginisialisasi Registry Modul...',
    currentCategory: 'system',
    currentStage: 'resolving',
    overallPercent: 0,
    currentModulePercent: 0,
    completed: [],
    slowestModule: null,
    heaviestModule: null,
    isComplete: false,
  }));

  useEffect(() => {
    let mounted = true;
    runModulePreloader((nextState) => {
      if (mounted) {
        setState(nextState);
        if (nextState.isComplete) {
          // Beri jeda 300ms agar user melihat status 100% sebelum masuk workspace
          setTimeout(() => {
            if (mounted) onLoaded();
          }, 350);
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [onLoaded]);

  // Pada render detail modul yang sedang aktif:
  // Tampilkan tahap presisi (Stage) alih-alih angka acak
  const stageLabels = {
    resolving: 'Resolving Chunk & Dependency',
    evaluating: 'Evaluating & Initializing Scope',
    verifying: 'Verifying Module Export Tree',
    ready: 'Module Ready',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-6 select-none font-sans text-foreground">
      <div className="w-full max-w-xl flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Memuat Modul Aplikasi</h1>
              <p className="text-xs text-muted-foreground">Pre-warming universal modules untuk performa maksimal</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-primary">
              {state.overallPercent}%
            </span>
            <p className="text-[11px] text-muted-foreground">
              {state.currentIndex}/{state.totalModules} Modul
            </p>
          </div>
        </div>

            {/* Total Progress Bar dengan 1 desimal presisi */}
    <span className="tabular-nums font-mono text-primary font-bold">
      {state.overallPercent.toFixed(1)}%
    </span>
    {/* Current Module Stage & Persentase */}
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground font-mono text-[11px]">
        {stageLabels[state.currentStage]}
      </span>
      <span className="font-mono tabular-nums text-foreground">
        {state.currentModulePercent}%
      </span>
    </div>

        {/* 1. Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Total Progress
            </span>
            <span className="tabular-nums">{state.overallPercent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/80 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-150 ease-out"
              style={{ width: `${state.overallPercent}%` }}
            />
          </div>
        </div>

        {/* 2. Current Module Progress Bar */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${CATEGORY_COLORS[state.currentCategory]}`}>
                {state.currentCategory}
              </Badge>
              <span className="truncate text-xs font-medium text-foreground">
                {state.currentModuleName}
              </span>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground font-mono">
              {state.currentModulePercent}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-100 ease-linear"
              style={{ width: `${state.currentModulePercent}%` }}
            />
          </div>
        </div>

        {/* 3. Performance Metrics (Slowest & Heaviest) */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium text-[11px]">Modul Terlama (Latency)</span>
            </div>
            <p className="font-semibold text-foreground truncate">
              {state.slowestModule ? state.slowestModule.name : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {state.slowestModule ? `${state.slowestModule.durationMs} ms` : 'Menghitung...'}
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5 text-purple-500" />
              <span className="font-medium text-[11px]">Modul Terberat (Size)</span>
            </div>
            <p className="font-semibold text-foreground truncate">
              {state.heaviestModule ? state.heaviestModule.name : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {state.heaviestModule?.sizeKb ? `${state.heaviestModule.sizeKb} KB` : 'Menghitung...'}
            </p>
          </div>
        </div>

        {/* 4. Live Loaded Modules Log */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Riwayat Modul Dimuat ({state.completed.length})
          </span>
          <ScrollArea className="h-32 w-full rounded-lg border border-border/60 bg-background/40 p-2">
            <div className="space-y-1">
              {state.completed.slice().reverse().map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-muted-foreground text-[10px]">
                    {item.sizeKb ? <span>{item.sizeKb} KB</span> : null}
                    <span className="text-foreground">{item.durationMs} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
