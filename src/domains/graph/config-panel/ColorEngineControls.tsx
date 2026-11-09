import { useState } from "react";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  Palette,
  Layers,
  Tag,
  Paintbrush,
  Plus,
  Trash2,
  Wand2,
  SunMedium,
  Zap,
  Sliders,
  PaintBucket,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ColorPicker } from "./ColorPicker";
import { ControlSliderRow } from "@/shared/ui/ControlSliderRow";
import { SectionHeaderWithReset } from "@/shared/ui/SectionHeaderWithReset";
import {
  HIERARCHY_PRESETS,
  presetById,
  generateHarmonyPalette,
  transformPaletteSpreadAndSaturation,
  type HierarchyColorConfig,
  type HierarchyPresetId,
  type HierarchyOverflow,
} from "../model/hierarchyColors";
import type { NodeConfig } from "@/domains/graph/stores/useGraphStore";

interface ColorEngineControlsProps {
  hierarchy: HierarchyColorConfig;
  nodeConfig: NodeConfig;
  onHierarchyUpdate: (updates: Partial<HierarchyColorConfig>) => void;
  onNodeConfigUpdate: (updates: Partial<NodeConfig>) => void;
  className?: string;
  compact?: boolean;
}

export function ColorEngineControls({
  hierarchy,
  nodeConfig,
  onHierarchyUpdate,
  onNodeConfigUpdate,
  className,
  compact = false,
}: ColorEngineControlsProps) {
  const activeMode: "hierarchy" | "categorical" | "custom" = hierarchy.enabled
    ? "hierarchy"
    : nodeConfig.autoColorBy === "tags" || nodeConfig.autoColorBy === "branch"
      ? "categorical"
      : "custom";

  const [colorSpread, setColorSpread] = useState(1.0);
  const [saturationShift, setSaturationShift] = useState(0);

  const handleModeChange = (mode: "hierarchy" | "categorical" | "custom") => {
    if (mode === "hierarchy") {
      onHierarchyUpdate({ enabled: true });
      onNodeConfigUpdate({ autoColorBy: "depth" });
    } else if (mode === "categorical") {
      onHierarchyUpdate({ enabled: false });
      if (nodeConfig.autoColorBy !== "tags" && nodeConfig.autoColorBy !== "branch") {
        onNodeConfigUpdate({ autoColorBy: "tags" });
      }
    } else {
      onHierarchyUpdate({ enabled: false });
      onNodeConfigUpdate({ autoColorBy: "type" });
    }
  };

  const handleApplyPreset = (presetId: HierarchyPresetId) => {
    const found = presetById(presetId);
    if (found) {
      onHierarchyUpdate({
        enabled: true,
        preset: presetId,
        levelColors: [...found.colors],
      });
      onNodeConfigUpdate({ autoColorBy: "depth" });
    }
  };

  const handleGenerateHarmony = () => {
    const base = hierarchy.levelColors[0] || "hsl(45, 95%, 60%)";
    const newColors = generateHarmonyPalette(base, Math.max(4, hierarchy.levelColors.length));
    onHierarchyUpdate({
      enabled: true,
      preset: "custom",
      levelColors: newColors,
    });
    onNodeConfigUpdate({ autoColorBy: "depth" });
  };

  const handleApplySpreadAndSat = (spread: number, sat: number) => {
    setColorSpread(spread);
    setSaturationShift(sat);
    const updated = transformPaletteSpreadAndSaturation(hierarchy.levelColors, spread, sat);
    onHierarchyUpdate({ levelColors: updated, preset: "custom" });
  };

  const setLevelColor = (index: number, color: string) => {
    const nextColors = [...hierarchy.levelColors];
    nextColors[index] = color;
    onHierarchyUpdate({ levelColors: nextColors, preset: "custom" });
  };

  const addLevel = () => {
    const lastColor =
      hierarchy.levelColors[hierarchy.levelColors.length - 1] || "hsl(200, 80%, 55%)";
    onHierarchyUpdate({
      levelColors: [...hierarchy.levelColors, lastColor],
      preset: "custom",
    });
  };

  const removeLevel = (index: number) => {
    if (hierarchy.levelColors.length <= 2) return;
    onHierarchyUpdate({
      levelColors: hierarchy.levelColors.filter((_, i) => i !== index),
      preset: "custom",
    });
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* Top Bar: Mode Selector Bersih & Bebas Overflow */}
      <div className="space-y-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">Color Engine Mode</span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize tracking-wider">
            {activeMode}
          </span>
        </div>

        {/* 3-Pill Segmented Switcher Responsif (Full-width grid, anti-overflow) */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1 border border-border/40">
          <button
            type="button"
            onClick={() => handleModeChange("hierarchy")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs transition-all select-none min-w-0",
              activeMode === "hierarchy"
                ? "bg-card text-foreground font-medium shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40",
            )}
          >
            <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Hierarchy</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("categorical")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs transition-all select-none min-w-0",
              activeMode === "categorical"
                ? "bg-card text-foreground font-medium shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40",
            )}
          >
            <Tag className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Category</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("custom")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs transition-all select-none min-w-0",
              activeMode === "custom"
                ? "bg-card text-foreground font-medium shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40",
            )}
          >
            <Paintbrush className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Custom</span>
          </button>
        </div>
      </div>

      {/* MODE 1: HIERARCHY BENTO GRID */}
      {activeMode === "hierarchy" && (
        <div
          className={cn(
            "grid gap-3.5",
            compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {/* Card 1: Spektrum Kedalaman & Preset */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <div className="space-y-3">
              <SectionHeaderWithReset
                icon={Layers}
                title="Spektrum Kedalaman"
                description="Gradien warna dari node akar hingga cabang terdalam"
              />

              {/* Gradient Ribbon */}
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2">
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>Akar (L0)</span>
                  <span>Cabang Terdalam</span>
                </div>
                <div className="relative flex h-6 w-full overflow-hidden rounded border border-border shadow-inner">
                  {hierarchy.levelColors.map((col, idx) => (
                    <div
                      key={idx}
                      className="group relative flex-1 transition-all hover:flex-[1.4]"
                      style={{ backgroundColor: col }}
                      title={`Level ${idx}: ${col}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-black/80 drop-shadow-xs opacity-80 group-hover:opacity-100">
                        {idx === 0 ? "R" : `L${idx}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">1-Click Presets</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                    onClick={handleGenerateHarmony}
                  >
                    <Wand2 className="h-3 w-3 text-amber-400" />
                    Harmony
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                    onClick={() => handleApplyPreset("pastel")}
                  >
                    <SunMedium className="h-3 w-3 text-pink-400" />
                    Pastel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                    onClick={() => handleApplyPreset("neon")}
                  >
                    <Zap className="h-3 w-3 text-cyan-400" />
                    Neon
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Pustaka Palet</Label>
                <Select
                  value={hierarchy.preset}
                  onValueChange={(val) => handleApplyPreset(val as HierarchyPresetId)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HIERARCHY_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex">
                            {p.colors.slice(0, 4).map((c) => (
                              <span
                                key={c}
                                className="h-2.5 w-2 first:rounded-l-xs last:rounded-r-xs"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </span>
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-xs">
                      Custom Tuned
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Card 2: Modulasi Spektral & Aturan Overflow */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <div className="space-y-3">
              <SectionHeaderWithReset
                icon={Sliders}
                title="Modulasi Spektral"
                description="Rentang spektrum warna dan penanganan kedalaman ekstra"
              />

              <ControlSliderRow
                label="Color Spread (Hue Spread)"
                value={colorSpread}
                min={0.4}
                max={2.0}
                step={0.1}
                unit="x"
                defaultValue={1.0}
                onChange={(v) => handleApplySpreadAndSat(v, saturationShift)}
              />

              <ControlSliderRow
                label="Pergeseran Saturasi"
                value={saturationShift}
                min={-40}
                max={40}
                step={5}
                formatValue={(v) => (v > 0 ? `+${v}%` : `${v}%`)}
                defaultValue={0}
                onChange={(v) => handleApplySpreadAndSat(colorSpread, v)}
              />

              <div className="space-y-1 pt-1">
                <Label className="text-xs font-medium text-foreground">
                  Aturan Level Di Luar Palet
                </Label>
                <Select
                  value={hierarchy.overflow}
                  onValueChange={(val) => onHierarchyUpdate({ overflow: val as HierarchyOverflow })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loop" className="text-xs">
                      Loop — Ulangi urutan palet
                    </SelectItem>
                    <SelectItem value="gradient" className="text-xs">
                      Gradient — Gelapkan warna secara bertahap
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Card 3: Warna Per Level Kedalaman */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <div className="space-y-3">
              <SectionHeaderWithReset
                icon={PaintBucket}
                title="Warna Per Kedalaman"
                badge={hierarchy.levelColors.length}
                description="Fine-tune warna untuk setiap tingkatan kedalaman"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px] text-primary"
                  onClick={addLevel}
                >
                  <Plus className="h-3 w-3" /> Tambah Level
                </Button>
              </SectionHeaderWithReset>

              <div className="max-h-[190px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                {hierarchy.levelColors.map((color, index) => (
                  <div key={`lvl-${index}`} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <ColorPicker
                        label={index === 0 ? "Root (L0)" : `Level ${index}`}
                        value={color}
                        onChange={(c) => setLevelColor(index, c)}
                        className="py-0.5"
                      />
                    </div>
                    {hierarchy.levelColors.length > 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeLevel(index)}
                        title="Hapus level ini"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CATEGORICAL BENTO GRID */}
      {activeMode === "categorical" && (
        <div className={cn("grid gap-3.5", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <SectionHeaderWithReset
              icon={Tag}
              title="Sumber Kategori"
              description="Pilih bagaimana graf menentukan variasi warna node"
            />

            <div className="space-y-1.5">
              <Button
                type="button"
                variant={nodeConfig.autoColorBy === "tags" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-2.5 text-xs h-9",
                  nodeConfig.autoColorBy === "tags" &&
                    "bg-background shadow-xs border border-border/60",
                )}
                onClick={() => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ autoColorBy: "tags" });
                }}
              >
                <Tag className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-medium">Markdown Tags</span>
                  <span className="text-[10px] text-muted-foreground">
                    Warna berdasarkan tag (#proyek, #catatan)
                  </span>
                </div>
              </Button>

              <Button
                type="button"
                variant={nodeConfig.autoColorBy === "branch" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-2.5 text-xs h-9",
                  nodeConfig.autoColorBy === "branch" &&
                    "bg-background shadow-xs border border-border/60",
                )}
                onClick={() => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ autoColorBy: "branch" });
                }}
              >
                <Layers className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-medium">Subtree Cabang</span>
                  <span className="text-[10px] text-muted-foreground">
                    Keturunan mewarisi corak cabang akar
                  </span>
                </div>
              </Button>

              <Button
                type="button"
                variant={nodeConfig.autoColorBy === "type" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-2.5 text-xs h-9",
                  nodeConfig.autoColorBy === "type" &&
                    "bg-background shadow-xs border border-border/60",
                )}
                onClick={() => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ autoColorBy: "type" });
                }}
              >
                <Palette className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-medium">Tipe Entitas</span>
                  <span className="text-[10px] text-muted-foreground">
                    Pemisahan warna Folder vs Catatan
                  </span>
                </div>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <SectionHeaderWithReset
              icon={Paintbrush}
              title="Warna Spesifik Entitas"
              description="Konfigurasi warna untuk tipe berkas dan folder"
            />

            <div className="space-y-2 pt-1">
              <ColorPicker
                label="Warna Folder"
                value={nodeConfig.folderColor}
                onChange={(val) => onNodeConfigUpdate({ folderColor: val })}
              />
              <ColorPicker
                label="Warna File / Catatan"
                value={nodeConfig.fileColor}
                onChange={(val) => onNodeConfigUpdate({ fileColor: val })}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: CUSTOM BENTO GRID */}
      {activeMode === "custom" && (
        <div className={cn("grid gap-3.5", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
            <SectionHeaderWithReset
              icon={Paintbrush}
              title="Warna Tunggal / Khusus"
              description="Terapkan warna monokrom atau identitas visual khusus"
            />

            <div className="space-y-2 pt-1">
              <ColorPicker
                label="Warna Utama Catatan"
                value={nodeConfig.fileColor}
                onChange={(val) => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ fileColor: val, autoColorBy: "none" });
                }}
              />
              <ColorPicker
                label="Warna Utama Folder"
                value={nodeConfig.folderColor}
                onChange={(val) => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ folderColor: val });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
