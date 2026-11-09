import { Button } from '@/shared/ui/button';
import { ControlSliderRow } from '@/shared/ui/ControlSliderRow';
import { SectionHeaderWithReset } from '@/shared/ui/SectionHeaderWithReset';
import { cn } from '@/shared/lib/cn';
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
import type { CanvasMode, LayoutMode, MindmapOrientation } from '../../model/graphTypes';
import { FreeForceControls } from './FreeForceControls';
import { useLeafGraphConfig, useLeafGraphConfigApi } from '../../model/useLeafGraphConfigStore';
import { useGraphStore, type ForceConfig } from '@/domains/graph/stores/useGraphStore';
import { useGraphInteractionStore } from '../../model/useGraphInteractionStore';
import { useGraphEngineStore } from '@/domains/graph/stores/useGraphEngineStore';

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
  canvasMode: CanvasMode;
  layout: LayoutMode;
  orientation: MindmapOrientation;
  onModeSwitch: (mode: CanvasMode) => void;
  onLayoutChange: (layout: LayoutMode) => void;
  onOrientationChange: (orientation: MindmapOrientation) => void;
}

export function LayoutPanel({
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
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
              'h-7 gap-1.5 text-xs font-medium transition-all rounded-md',
              !isMindmap ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
            )}
            onClick={() => onModeSwitch('graph')}
          >
            <Network className="h-3.5 w-3.5 text-primary" />
            Graph View
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-xs font-medium transition-all rounded-md',
              isMindmap ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
            )}
            onClick={() => onModeSwitch('mindmap')}
          >
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            Mindmap View
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
                  'flex flex-col items-start p-2 rounded-lg border text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/80 line-clamp-1">{item.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Khusus Mindmap: Orientation */}
        {isMindmap && layout === 'mindmap' && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Orientasi Cabang</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['balanced', 'radial'] as MindmapOrientation[]).map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant={orientation === val ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => onOrientationChange(val)}
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= BENTO 2: STRUKTUR & ZOOM ENGINE ================= */}
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
              className="h-7 text-xs font-medium"
              onClick={() => setLayoutArrangement('auto')}
            >
              Anti-Overlap (Auto)
            </Button>
            <Button
              type="button"
              variant={layoutArrangement === 'custom' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => setLayoutArrangement('custom')}
            >
              Custom (Manual)
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
              className="h-7 text-xs font-medium"
              onClick={() => patchEngine({ zoomOutRendering: 'optimized' })}
            >
              Optimized
            </Button>
            <Button
              type="button"
              variant={zoomOutRendering === 'full-detail' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => patchEngine({ zoomOutRendering: 'full-detail' })}
            >
              Full Detail
            </Button>
          </div>
        </div>

        {/* Label Zoom Threshold */}
        <div className="pt-2 border-t border-border/40">
          <ControlSliderRow
            label="Ambang Zoom Label"
            description="Tingkat zoom minimal agar label node terlihat"
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

      {/* ================= BENTO 3: TUNING FISIKA / INFORMASI SOLVER ================= */}
      {layout === 'free-force' && !isMindmap ? (
        <FreeForceControls forces={forces} onUpdate={handleForceUpdate} />
      ) : (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
          <SectionHeaderWithReset
            title="Karakteristik Solver"
            icon={Sparkles}
            description="Informasi kalkulasi posisi graf otomatis"
          />
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <div className="rounded-lg bg-muted/40 p-2.5 border border-border/40">
              <p className="font-semibold text-foreground mb-1">
                Deterministic Solver Aktif
              </p>
              <p className="text-[11px]">
                {layout === 'kamada-kawai' && 'Menyeimbangkan jarak visual antar node berbobot sama tanpa getaran simulasi.'}
                {layout === 'fr-standard' && 'Mendistribusikan node secara proporsional dengan algoritma pegas terkontrol.'}
                {layout === 'fr-radial' && 'Mengelompokkan node dari titik pusat ke tepi secara melingkar konsentris.'}
                {isMindmap && 'Menata struktur pohon informasi secara berurutan dan teratur.'}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 px-1">
              <span>Status Simulasi D3:</span>
              <span className="font-medium text-emerald-500">Pinned & Stabil (0% Jitter)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}