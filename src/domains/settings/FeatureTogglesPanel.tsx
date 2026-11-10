/** User-facing on/off switches for optional features. */

import { useEffect, useState } from "react";
import { Switch } from "@/global/ui/switch";
import { Label } from "@/global/ui/label";
import { RadioGroup, RadioGroupItem } from "@/global/ui/radio-group";
import { PanelBottom, Settings2 } from "lucide-react";
import {
  TOGGLEABLE_FEATURES,
  getFeatureToggles,
  onFeatureTogglesChange,
  setFeatureEnabled,
} from "@/domains/settings/plugins/feature-toggles";
import {
  useGraphToolbarStore,
  type GraphControlsDisplayMode,
} from "@/domains/graph/shared/stores/useGraphToolbarStore";

export function FeatureTogglesPanel() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => getFeatureToggles());

  const toolbarMode = useGraphToolbarStore((s) => s.mode);
  const setToolbarMode = useGraphToolbarStore((s) => s.setMode);

  useEffect(() => onFeatureTogglesChange(setToggles), []);

  return (
    <section aria-labelledby="feature-toggles-heading" className="space-y-6">
      <div>
        <h2 id="feature-toggles-heading" className="text-sm font-semibold">
          Features
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Turn parts of the app on or off and customize layout behaviors.
        </p>
      </div>

      {/* --- OPSI BARU: GRAPH CONTROLS DISPLAY MODE --- */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-3">
        <div>
          <Label className="text-sm font-medium">Graph Controls Display Mode</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pilih bagaimana panel kontrol dan pengaturan graph ditampilkan pada workspace tab graph.
          </p>
        </div>

        <RadioGroup
          value={toolbarMode}
          onValueChange={(val) => setToolbarMode(val as GraphControlsDisplayMode)}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {/* OPSI 1: HORIZONTAL TOOLBAR */}
          <label
            htmlFor="mode-horizontal-toolbar"
            className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
              toolbarMode === "horizontal_toolbar"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border/60 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <RadioGroupItem
              value="horizontal_toolbar"
              id="mode-horizontal-toolbar"
              className="mt-0.5 shrink-0"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <PanelBottom className="w-3.5 h-3.5 text-primary" />
                <span>Horizontal Expandable Toolbar</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Pita kontrol tepat di atas footer dengan tab navigasi ala Microsoft Office.
              </p>
            </div>
          </label>

          {/* OPSI 2: GEAR OPTION BUTTON (DEFAULT) */}
          <label
            htmlFor="mode-gear-button"
            className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
              toolbarMode === "gear_button"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border/60 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <RadioGroupItem value="gear_button" id="mode-gear-button" className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span>Gear Option Button (Default)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Tombol melayang klasik di sudut kiri bawah dengan popup menu.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* --- DAFTAR SWITCH FITUR DEFAULT --- */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Core Feature Toggles
        </h3>
        <ul className="space-y-3">
          {TOGGLEABLE_FEATURES.map((feature) => (
            <li
              key={feature.id}
              className="flex items-start justify-between gap-4 border-b border-border/30 pb-3 last:border-b-0"
            >
              <div className="min-w-0">
                <Label htmlFor={`toggle-${feature.id}`} className="text-sm font-medium">
                  {feature.name}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
              </div>
              <Switch
                id={`toggle-${feature.id}`}
                checked={toggles[feature.id] ?? true}
                onCheckedChange={(checked) => void setFeatureEnabled(feature.id, checked)}
                aria-label={`Turn ${feature.name} ${toggles[feature.id] ? "off" : "on"}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
