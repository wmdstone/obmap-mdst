import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Button } from '@/shared/ui/button';
import { Sparkles, Compass, Wind, Orbit, Sun } from 'lucide-react';
import { ColorPicker } from '@/domains/graph/components/ColorPicker';
import { ControlSliderRow } from '@/shared/ui/ControlSliderRow';
import { SectionHeaderWithReset } from '@/shared/ui/SectionHeaderWithReset';
import type { NodeConfig, LinkConfig } from '@/domains/graph/shared/stores/useGraphStore';
import { COSMIC_PRESETS, type AtmosphereConfig, defaultAtmosphereConfig } from '@/domains/graph/shared/utils/atmosphereConfig';
import { useGraphInteractionStore } from '@/domains/graph/shared/stores/useGraphInteractionStore';
import {
  useExplorerGraphSyncStore,
  type ExplorerGraphSyncMode,
} from '@/domains/graph/shared/stores/useExplorerGraphSyncStore';

export type { AtmosphereConfig } from '@/domains/graph/shared/utils/atmosphereConfig';

interface AtmosphereControlsProps {
  atmosphere: AtmosphereConfig;
  linkConfig: LinkConfig;
  nodeConfig: NodeConfig;
  onAtmosphereUpdate: (updates: Partial<AtmosphereConfig>) => void;
  onLinkUpdate: (updates: Partial<LinkConfig>) => void;
  onNodeUpdate: (updates: Partial<NodeConfig>) => void;
}

const EXPLORER_SYNC_OPTIONS: Array<{
  value: ExplorerGraphSyncMode;
  label: string;
  description: string;
}> = [
  {
    value: 'off',
    label: 'Selection only',
    description: 'Seleksi File Explorer dan Graph tetap sinkron, tanpa pergerakan kamera.',
  },
  {
    value: 'hover-highlight',
    label: 'Hover highlight',
    description: 'Hover item Explorer menyorot node tanpa memindahkan kamera.',
  },
  {
    value: 'select-focus',
    label: 'Select & focus',
    description: 'Klik item Explorer membuka dan memusatkan node di graph.',
  },
  {
    value: 'hover-and-focus',
    label: 'Hover + focus',
    description: 'Highlight saat hover, fokus graph saat item dipilih.',
  },
];

export function AtmosphereControls({
  atmosphere,
  linkConfig,
  nodeConfig,
  onAtmosphereUpdate,
  onLinkUpdate,
  onNodeUpdate,
}: AtmosphereControlsProps) {
  const flowEnabled = linkConfig.showParticles && linkConfig.particles > 0;
  const highlightMode = useGraphInteractionStore((s) => s.highlightMode);
  const setHighlightMode = useGraphInteractionStore((s) => s.setHighlightMode);
  const explorerGraphSyncMode = useExplorerGraphSyncStore((s) => s.mode);
  const setExplorerGraphSyncMode = useExplorerGraphSyncStore((s) => s.setMode);

  const activeSyncDesc = EXPLORER_SYNC_OPTIONS.find(
    (opt) => opt.value === explorerGraphSyncMode,
  )?.description;

  return (
    <div className="grid grid-cols-1 gap-3.5">
      {/* BENTO CARD 1: SINKRONISASI & INTERAKSI */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Compass}
            title="Sinkronisasi & Interaksi"
            description="Koneksi File Explorer dan fokus jalur graf"
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Explorer ↔ Graph Sync
            </Label>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1"
              role="group"
              aria-label="Mode sinkronisasi"
            >
              {EXPLORER_SYNC_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={explorerGraphSyncMode === opt.value ? 'secondary' : 'ghost'}
                  aria-pressed={explorerGraphSyncMode === opt.value}
                  className="h-auto min-h-8 whitespace-normal px-2 py-1 text-left text-[11px] leading-tight font-normal"
                  onClick={() => setExplorerGraphSyncMode(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {activeSyncDesc && (
              <p className="text-[10px] text-muted-foreground leading-tight px-0.5">
                {activeSyncDesc}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5 pt-2">
            <div>
              <Label htmlFor="highlight-pathway" className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Highlight Connected Path
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Redupkan node lain & sorot cabang aktif saat kursor diarahkan.
              </p>
            </div>
            <Switch
              id="highlight-pathway"
              checked={highlightMode === 'pathway'}
              onCheckedChange={(checked) => setHighlightMode(checked ? 'pathway' : 'off')}
            />
          </div>
        </div>
      </div>

      {/* BENTO CARD 2: DEBU KOSMIK & LIVING ATMOSPHERE */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Wind}
            title="Debu Kosmik & Latar"
            description="Partikel atmosfer living canvas mengambang"
            onReset={() =>
              onAtmosphereUpdate({
                cosmicParticles: defaultAtmosphereConfig.cosmicParticles,
                cosmicSpeed: defaultAtmosphereConfig.cosmicSpeed,
              })
            }
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Preset Atmosfer</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-1">
              {COSMIC_PRESETS.map((preset) => (
                <Button
                  key={preset.intensity}
                  type="button"
                  size="sm"
                  variant={atmosphere.cosmicParticles === preset.intensity ? 'secondary' : 'ghost'}
                  className="h-7 text-[11px] font-normal"
                  onClick={() => onAtmosphereUpdate({ cosmicParticles: preset.intensity })}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <ControlSliderRow
            label="Intensitas Partikel"
            value={atmosphere.cosmicParticles}
            min={0}
            max={100}
            step={5}
            unit="%"
            defaultValue={defaultAtmosphereConfig.cosmicParticles}
            onChange={(v) => onAtmosphereUpdate({ cosmicParticles: v })}
          />

          <ControlSliderRow
            label="Kecepatan Hanyut (Drift)"
            value={atmosphere.cosmicSpeed}
            min={0.2}
            max={3.0}
            step={0.2}
            formatValue={(v) => `${v.toFixed(1)}×`}
            defaultValue={defaultAtmosphereConfig.cosmicSpeed}
            disabled={atmosphere.cosmicParticles === 0}
            onChange={(v) => onAtmosphereUpdate({ cosmicSpeed: v })}
          />
        </div>
      </div>

      {/* BENTO CARD 3: ALIRAN PARTIKEL TAUTAN */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Orbit}
            title="Aliran Partikel Tautan"
            description="Cahaya dinamis yang mengalir di sepanjang garis relasi"
          />

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
            <Label htmlFor="flow-toggle" className="text-xs font-medium cursor-pointer">
              Aktifkan Link Glow
            </Label>
            <Switch
              id="flow-toggle"
              checked={flowEnabled}
              onCheckedChange={(checked) =>
                onLinkUpdate({
                  showParticles: checked,
                  ...(checked
                    ? {
                        particles: Math.max(1, linkConfig.particles || 3),
                        particleSpeed: linkConfig.particleSpeed || 0.01,
                      }
                    : {}),
                })
              }
            />
          </div>

          {flowEnabled ? (
            <div className="space-y-2.5 pt-1">
              <ControlSliderRow
                label="Partikel Per Tautan"
                value={linkConfig.particles}
                min={1}
                max={6}
                step={1}
                defaultValue={3}
                onChange={(v) => onLinkUpdate({ particles: v })}
              />
              <ControlSliderRow
                label="Kecepatan Alir"
                value={linkConfig.particleSpeed}
                min={0.002}
                max={0.04}
                step={0.002}
                formatValue={(v) => `${(v * 100).toFixed(1)}×`}
                defaultValue={0.01}
                onChange={(v) => onLinkUpdate({ particleSpeed: v })}
              />
              <ControlSliderRow
                label="Ukuran Partikel"
                value={linkConfig.particleWidth}
                min={1.5}
                max={8}
                step={0.5}
                unit="px"
                defaultValue={3}
                onChange={(v) => onLinkUpdate({ particleWidth: v })}
              />
              <ColorPicker
                label="Warna Partikel"
                value={linkConfig.particleColor}
                onChange={(v) => onLinkUpdate({ particleColor: v })}
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic py-4 text-center">
              Nyalakan toggle di atas untuk memancarkan partikel energi pada tautan.
            </p>
          )}
        </div>
      </div>

      {/* BENTO CARD 4: ELEVASI & AURA HALO */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Sun}
            title="Elevasi & Aura Node"
            description="Kedalaman visual saat hover dan pendaran halo"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
              <Label htmlFor="elev-toggle" className="text-xs font-medium cursor-pointer">
                Hover Elevation
              </Label>
              <Switch
                id="elev-toggle"
                checked={atmosphere.nodeElevation}
                onCheckedChange={(v) => onAtmosphereUpdate({ nodeElevation: v })}
              />
            </div>
            {atmosphere.nodeElevation && (
              <ControlSliderRow
                label="Intensitas Elevasi"
                value={atmosphere.elevationIntensity}
                min={0}
                max={1}
                step={0.05}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={defaultAtmosphereConfig.elevationIntensity}
                onChange={(v) => onAtmosphereUpdate({ elevationIntensity: v })}
              />
            )}
          </div>

          <div className="space-y-2 border-t border-border/40 pt-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
              <Label htmlFor="halo-toggle" className="text-xs font-medium cursor-pointer">
                Ambient Node Halo
              </Label>
              <Switch
                id="halo-toggle"
                checked={nodeConfig.glow}
                onCheckedChange={(v) => onNodeUpdate({ glow: v })}
              />
            </div>
            {nodeConfig.glow && (
              <div className="space-y-2.5 pt-1">
                <ControlSliderRow
                  label="Intensitas Halo"
                  value={nodeConfig.glowIntensity}
                  min={0}
                  max={1}
                  step={0.05}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  defaultValue={0.5}
                  onChange={(v) => onNodeUpdate({ glowIntensity: v })}
                />
                <ControlSliderRow
                  label="Kecepatan Denyut"
                  value={nodeConfig.glowSpeed}
                  min={0}
                  max={2.5}
                  step={0.1}
                  formatValue={(v) => (v === 0 ? 'Diam' : `${v.toFixed(1)}×`)}
                  defaultValue={1.0}
                  onChange={(v) => onNodeUpdate({ glowSpeed: v })}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}