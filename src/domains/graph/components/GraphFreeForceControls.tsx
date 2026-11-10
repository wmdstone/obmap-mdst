import { Button } from '@/shared/ui/button';
import { ControlSliderRow } from '@/shared/ui/ControlSliderRow';
import { SectionHeaderWithReset } from '@/shared/ui/SectionHeaderWithReset';
import { Flame, Pause, Magnet } from 'lucide-react';
import { defaultForceConfig, type ForceConfig } from '@/domains/graph/stores/useGraphStore';
import { useGraphInteractionStore } from '../../model/useGraphInteractionStore';

interface FreeForceControlsProps {
  forces: ForceConfig;
  onUpdate: (updates: Partial<ForceConfig>) => void;
}

export function FreeForceControls({ forces, onUpdate }: FreeForceControlsProps) {
  const requestReheat = useGraphInteractionStore((s) => s.requestReheat);
  const requestStop = useGraphInteractionStore((s) => s.requestStop);

  const handleReset = () => {
    onUpdate({
      chargeStrength: defaultForceConfig.chargeStrength,
      linkDistance: defaultForceConfig.linkDistance,
      centerStrength: defaultForceConfig.centerStrength,
      velocityDecay: defaultForceConfig.velocityDecay,
    });
    requestReheat();
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
      <SectionHeaderWithReset
        title="Fisika Gaya Pegas (Free Force)"
        icon={Magnet}
        onReset={handleReset}
        resetTooltip="Reset gaya ke default"
      />

      <div className="space-y-2.5">
        <ControlSliderRow
          label="Kekuatan Tolakan"
          description="Jarak saling tolak antar node"
          value={Math.abs(forces.chargeStrength)}
          min={0}
          max={400}
          step={5}
          defaultValue={Math.abs(defaultForceConfig.chargeStrength)}
          onChange={(val) => onUpdate({ chargeStrength: -val })}
        />

        <ControlSliderRow
          label="Jarak Tautan"
          unit="px"
          value={forces.linkDistance}
          min={0}
          max={350}
          step={10}
          defaultValue={defaultForceConfig.linkDistance}
          onChange={(val) => onUpdate({ linkDistance: val })}
        />

        <ControlSliderRow
          label="Gravitasi Pusat"
          value={forces.centerStrength}
          min={0}
          max={2}
          step={0.05}
          defaultValue={defaultForceConfig.centerStrength}
          formatValue={(val) => val.toFixed(2)}
          onChange={(val) => onUpdate({ centerStrength: val })}
        />

        <ControlSliderRow
          label="Redaman Kecepatan"
          value={forces.velocityDecay}
          min={0}
          max={1}
          step={0.05}
          defaultValue={defaultForceConfig.velocityDecay}
          formatValue={(val) => val.toFixed(2)}
          onChange={(val) => onUpdate({ velocityDecay: val })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-medium hover:border-amber-500/50 hover:bg-amber-500/10"
          onClick={requestReheat}
          title="Beri energi kinetik agar graf menyusun ulang secara alami"
        >
          <Flame className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
          Kocok Ulang
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-medium hover:border-border hover:bg-muted/80"
          onClick={requestStop}
          title="Kunci pergerakan node di koordinat saat ini"
        >
          <Pause className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          Freeze
        </Button>
      </div>
    </div>
  );
}