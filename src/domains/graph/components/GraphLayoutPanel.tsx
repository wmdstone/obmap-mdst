import { Button } from '@/global/ui/button';
import { ControlSliderRow } from '@/global/ui/ControlSliderRow';
import { SectionHeaderWithReset } from '@/global/ui/SectionHeaderWithReset';
import { cn } from '@/global/utils/cn';
import {
  GitBranch,
  Network,
  Circle,
  Clock3,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Cpu,
  Layers,
} from 'lucide-react';
import type { CanvasMode, LayoutMode, MindmapOrientation } from '@/domains/graph/shared/utils/graph.types';
import { useLeafGraphConfig, useLeafGraphConfigApi } from '@/domains/graph/shared/stores/useLeafGraphConfigStore';
import { useGraphStore, type ForceConfig } from '@/domains/graph/shared/stores/useGraphStore';
import { useGraphEngineStore } from '@/domains/graph/shared/stores/useGraphEngineStore';
import { useGraphInteractionStore } from '@/domains/graph/shared/stores/useGraphInteractionStore';


export const GRAPH_LAYOUTS: { value: LayoutMode; label: string; icon: typeof Network; desc: string }[] = [
  { value: 'free-force', label: 'Free Force', icon: Network, desc: 'Simulasi fisika D3 alami' },
  { value: 'kamada-kawai', label: 'Kamada-Kawai', icon: Zap, desc: 'Solver jarak geometris seragam' },
  { value: 'fr-standard', label: 'Spring (F-R)', icon: Sparkles, desc: 'Fruchterman-Reingold stabil' },
  { value: 'fr-radial', label: 'Radial Spread', icon: Circle, desc: 'Penyebaran konsentris simetris' },
];

export const MINDMAP_LAYOUTS: { value: LayoutMode; label: string; icon: typeof Network; desc: string }[] = [
  { value: 'mindmap', label: 'Mindmap', icon: GitBranch, desc: 'Pohon cabang hierarkis dinamis' },
  { value: 'timeline', label: 'Timeline', icon: Clock3, desc: 'Aliran kronologis berurutan' },
  { value: 'org-chart', label: 'Org Chart', icon: Network, desc: 'Bagan organisasi top-down' },
  { value: 'brace-map', label: 'Brace Map', icon: SlidersHorizontal, desc: 'Peta dekonstruksi struktural' },
];

interface LayoutPanelProps {
  compact?: boolean;
  canvasMode: CanvasMode;
  layout: LayoutMode;
  orientation: MindmapOrientation;
  onModeSwitch: (mode: CanvasMode) => void;
  onLayoutChange: (layout: LayoutMode) => void;
  onOrientationChange: (orientation: MindmapOrientation) => void;
}

export function LayoutPanel({
  compact = true,
  canvasMode,
  layout,
  orientation,
  onModeSwitch,
  onLayoutChange,
  onOrientationChange,
}: LayoutPanelProps) {
  const layoutArrangement = useGraphInteractionStore((s) => s.layoutArrangement);
  const setLayoutArrangement = useGraphInteractionStore((s) => s.setLayoutArrangement);

  const leafApi = useLeafGraphConfigApi();
  const localForces = useLeafGraphConfig((s) => s.config?.forces);
  const globalForces = useGraphStore((s) => s.config.forces);
  const forces = localForces ?? globalForces;

  const handleForceUpdate = (updates: Partial<ForceConfig>) => {
    if (leafApi) leafApi.getState().setForceConfig(updates);
    else useGraphStore.getState().updateForceConfig(updates);
  };

  const zoomOutRendering = useGraphEngineStore((s) => s.zoomOutRendering);
  const labelZoomThreshold = useGraphEngineStore((s) => s.labelZoomThreshold);
  const patchEngine = useGraphEngineStore((s) => s.patch);

  const isMindmap = canvasMode === 'mindmap';
  const layouts = isMindmap ? MINDMAP_LAYOUTS : GRAPH_LAYOUTS;

  return (
    <div className={cn("grid gap-3 items-start w-full", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
      {/* ================= BENTO 1: MODE & SOLVER ALGORITHM ================= */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
        <SectionHeaderWithReset
          title="Mode & Algoritma"
          icon={Layers}
          description="Pilih perspektif tampilan dan solver visual"
        />

        {/* View Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-xs font-medium transition-all rounded-md min-w-0',
              !isMindmap ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
            )}
            onClick={() => onModeSwitch('graph')}
          >
            <Network className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Graph View</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-xs font-medium transition-all rounded-md min-w-0',
              isMindmap ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
            )}
            onClick={() => onModeSwitch('mindmap')}
          >
            <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Mindmap View</span>
          </Button>
        </div>

        {/* Layout Algorithms Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {layouts.map((item) => {
            const Icon = item.icon;
            const isActive = layout === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onLayoutChange(item.value)}
                className={cn(
                  'flex flex-col items-start p-2 rounded-lg border text-left transition-all min-w-0 overflow-hidden',
                  isActive
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5 w-full min-w-0">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-xs font-semibold truncate">{item.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/80 truncate w-full">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= BENTO 2: STRUKTUR & ENGINE RENDERING ================= */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
        <SectionHeaderWithReset
          title="Struktur & Engine Rendering"
          icon={Cpu}
          description="Perilaku tata letak dan optimasi zoom"
        />

        {/* Layout Structure */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Penataan Posisi Node</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {layoutArrangement === 'auto' ? 'Auto Snap' : 'Free Drag'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={layoutArrangement === 'auto' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium min-w-0"
              onClick={() => setLayoutArrangement('auto')}
            >
              <span className="truncate">Anti-Overlap (Auto)</span>
            </Button>
            <Button
              type="button"
              variant={layoutArrangement === 'custom' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium min-w-0"
              onClick={() => setLayoutArrangement('custom')}
            >
              <span className="truncate">Custom (Manual)</span>
            </Button>
          </div>
        </div>

        {/* Zoom Out Rendering */}
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Detail Saat Zoom Out</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {zoomOutRendering === 'optimized' ? 'Optimized' : 'Full Detail'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={zoomOutRendering === 'optimized' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium min-w-0"
              onClick={() => patchEngine({ zoomOutRendering: 'optimized' })}
            >
              <span className="truncate">Optimized</span>
            </Button>
            <Button
              type="button"
              variant={zoomOutRendering === 'full-detail' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium min-w-0"
              onClick={() => patchEngine({ zoomOutRendering: 'full-detail' })}
            >
              <span className="truncate">Full Detail</span>
            </Button>
          </div>
        </div>

        {/* Label Zoom Threshold */}
        <div className="pt-2 border-t border-border/40">
          <ControlSliderRow
            label="Ambang Zoom Label"
            description="Tingkat zoom minimal agar label terlihat"
            value={labelZoomThreshold}
            min={0.1}
            max={3.0}
            step={0.05}
            defaultValue={1.0}
            unit="x"
            formatValue={(v) => `${v.toFixed(2)}x`}
            onChange={(v) => patchEngine({ labelZoomThreshold: v })}
          />
        </div>
      </div>
    </div>
  );
}