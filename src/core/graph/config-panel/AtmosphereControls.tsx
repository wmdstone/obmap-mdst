import { Label } from '@/shared/ui/label';
import { Slider } from '@/shared/ui/slider-noinput';
import { Switch } from '@/shared/ui/switch';
import { Button } from '@/shared/ui/button';
import { ColorPicker } from './ColorPicker';
import type { NodeConfig, LinkConfig } from '@/shared/stores/useGraphStore';
import { COSMIC_PRESETS, type AtmosphereConfig } from '../model/atmosphereConfig';
import { useGraphInteractionStore } from '../model/useGraphInteractionStore';
import { Sparkles } from 'lucide-react';
export type { AtmosphereConfig } from '../model/atmosphereConfig';

interface AtmosphereControlsProps {
  atmosphere: AtmosphereConfig;
  linkConfig: LinkConfig;
  nodeConfig: NodeConfig;
  onAtmosphereUpdate: (updates: Partial<AtmosphereConfig>) => void;
  onLinkUpdate: (updates: Partial<LinkConfig>) => void;
  onNodeUpdate: (updates: Partial<NodeConfig>) => void;
}

function EffectSlider({ label, value, display, min, max, step, disabled, onChange }: {
  label: string; value: number; display: string; min: number; max: number;
  step: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <output className="shrink-0 font-mono text-foreground">{display}</output>
    </div>
    <Slider aria-label={label} value={[value]} min={min} max={max} step={step}
      disabled={disabled} onValueChange={([next]) => { if (next !== undefined) onChange(next); }} />
  </div>;
}

export function AtmosphereControls({ atmosphere, linkConfig, nodeConfig,
  onAtmosphereUpdate, onLinkUpdate, onNodeUpdate }: AtmosphereControlsProps) {
  const flowEnabled = linkConfig.showParticles && linkConfig.particles > 0;
  const highlightMode = useGraphInteractionStore((s) => s.highlightMode);
  const setHighlightMode = useGraphInteractionStore((s) => s.setHighlightMode);

  return <div className="space-y-5">

    {/* 1. HIGHLIGHT CONNECTED PATHWAY */}
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="highlight-pathway-toggle" className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Highlight connected path
          </Label>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Dim unrelated nodes & focus active branch on hover.
          </p>
        </div>
        <Switch
          id="highlight-pathway-toggle"
          checked={highlightMode === 'pathway'}
          onCheckedChange={(checked) => setHighlightMode(checked ? 'pathway' : 'off')}
        />
      </div>
    </section>

    {/* 2. COSMIC PARTICLES */}
    <section className="space-y-4 border-t border-border pt-4" aria-labelledby="cosmic-title">
      <div className="flex items-center justify-between gap-3">
        <Label id="cosmic-title" className="text-sm font-medium">Cosmic particles & dust</Label>
        <span className="shrink-0 text-xs font-mono text-primary">{atmosphere.cosmicParticles}%</span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/40 p-1" role="group" aria-label="Cosmic presets">
        {COSMIC_PRESETS.map(preset => <Button key={preset.intensity} type="button" size="sm"
          variant={atmosphere.cosmicParticles === preset.intensity ? 'secondary' : 'ghost'}
          aria-pressed={atmosphere.cosmicParticles === preset.intensity}
          className="h-auto min-h-8 min-w-0 whitespace-normal px-1 py-1.5 text-[11px] leading-tight"
          onClick={() => onAtmosphereUpdate({ cosmicParticles: preset.intensity })}>{preset.label}</Button>)}
      </div>
      <EffectSlider label="Particle intensity" value={atmosphere.cosmicParticles} display={`${atmosphere.cosmicParticles}%`}
        min={0} max={100} step={5} onChange={v => onAtmosphereUpdate({ cosmicParticles: v })} />
      <EffectSlider label="Drift speed" value={atmosphere.cosmicSpeed} display={`${atmosphere.cosmicSpeed.toFixed(1)}×`}
        min={0.2} max={3} step={0.2} disabled={atmosphere.cosmicParticles === 0}
        onChange={v => onAtmosphereUpdate({ cosmicSpeed: v })} />
    </section>
    <section className="space-y-4 border-t border-border pt-4" aria-labelledby="flow-title">
      <div className="flex items-center justify-between gap-3">
        <Label id="flow-title" htmlFor="flow-toggle" className="text-sm font-medium">Link dynamic glow</Label>
        <Switch id="flow-toggle" checked={flowEnabled} onCheckedChange={checked => onLinkUpdate({
          showParticles: checked,
          ...(checked ? { particles: Math.max(1, linkConfig.particles || 3), particleSpeed: linkConfig.particleSpeed || 0.01 } : {}),
        })} />
      </div>
      {flowEnabled && <div className="space-y-4">
        <EffectSlider label="Particles per link" value={linkConfig.particles} display={`${linkConfig.particles}`}
          min={1} max={6} step={1} onChange={v => onLinkUpdate({ particles: v })} />
        <EffectSlider label="Flow speed" value={linkConfig.particleSpeed} display={`${(linkConfig.particleSpeed * 100).toFixed(1)}×`}
          min={0.002} max={0.04} step={0.002} onChange={v => onLinkUpdate({ particleSpeed: v })} />
        <EffectSlider label="Particle size" value={linkConfig.particleWidth} display={`${linkConfig.particleWidth}px`}
          min={1.5} max={8} step={0.5} onChange={v => onLinkUpdate({ particleWidth: v })} />
        <ColorPicker label="Flow color" value={linkConfig.particleColor} onChange={v => onLinkUpdate({ particleColor: v })} />
      </div>}
    </section>
    <section className="space-y-4 border-t border-border pt-4" aria-labelledby="elevation-title">
      <div className="flex items-center justify-between gap-3">
        <Label id="elevation-title" htmlFor="elevation-toggle" className="text-sm font-medium">Hover & focus elevation</Label>
        <Switch id="elevation-toggle" checked={atmosphere.nodeElevation}
          onCheckedChange={v => onAtmosphereUpdate({ nodeElevation: v })} />
      </div>
      {atmosphere.nodeElevation && <EffectSlider label="Elevation intensity" value={atmosphere.elevationIntensity}
        display={`${Math.round(atmosphere.elevationIntensity * 100)}%`} min={0} max={1} step={0.05}
        onChange={v => onAtmosphereUpdate({ elevationIntensity: v })} />}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="halo-toggle" className="text-xs text-muted-foreground">Ambient node halo</Label>
        <Switch id="halo-toggle" checked={nodeConfig.glow} onCheckedChange={v => onNodeUpdate({ glow: v })} />
      </div>
      {nodeConfig.glow && <div className="space-y-4">
        <EffectSlider label="Halo intensity" value={nodeConfig.glowIntensity} display={`${Math.round(nodeConfig.glowIntensity * 100)}%`}
          min={0} max={1} step={0.05} onChange={v => onNodeUpdate({ glowIntensity: v })} />
        <EffectSlider label="Pulse speed" value={nodeConfig.glowSpeed} display={nodeConfig.glowSpeed === 0 ? 'Still' : `${nodeConfig.glowSpeed.toFixed(1)}×`}
          min={0} max={2.5} step={0.1} onChange={v => onNodeUpdate({ glowSpeed: v })} />
      </div>}
    </section>
  </div>;
}
