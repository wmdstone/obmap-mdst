/**
 * ColorEngineControls - Centralized Color Engine Panel
 * 
 * Unifies node and graph coloring into 3 clear modes:
 * 1. Hierarchy (Depth-based) with live gradient ribbon, quick harmonic generators, and fine tuning
 * 2. Categorical / Tag / Type (Folder, Markdown Tags, Branch inheritance)
 * 3. Custom / Single (Monochrome brand styling, explicit element colors)
 */

import { useState } from 'react';
import { Label } from '@/shared/ui/label';
import { Button } from '@/shared/ui/button';
import { Slider } from '@/shared/ui/slider-number';
import { Switch } from '@/shared/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  Sparkles,
  Palette,
  Layers,
  Tag,
  Paintbrush,
  Plus,
  Trash2,
  Wand2,
  SunMedium,
  Zap,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { ColorPicker } from './ColorPicker';
import {
  HIERARCHY_PRESETS,
  presetById,
  generateHarmonyPalette,
  transformPaletteSpreadAndSaturation,
  type HierarchyColorConfig,
  type HierarchyPresetId,
  type HierarchyOverflow,
} from '../model/hierarchyColors';
import type { NodeConfig } from '@/shared/stores/useGraphStore';

interface ColorEngineControlsProps {
  hierarchy: HierarchyColorConfig;
  nodeConfig: NodeConfig;
  onHierarchyUpdate: (updates: Partial<HierarchyColorConfig>) => void;
  onNodeConfigUpdate: (updates: Partial<NodeConfig>) => void;
  className?: string;
}

export function ColorEngineControls({
  hierarchy,
  nodeConfig,
  onHierarchyUpdate,
  onNodeConfigUpdate,
  className,
}: ColorEngineControlsProps) {
  // Mode aktif: 'hierarchy' | 'categorical' | 'custom'
  const activeMode: 'hierarchy' | 'categorical' | 'custom' = hierarchy.enabled
    ? 'hierarchy'
    : nodeConfig.autoColorBy === 'tags' || nodeConfig.autoColorBy === 'branch'
    ? 'categorical'
    : 'custom';

  const [colorSpread, setColorSpread] = useState(1.0);
  const [saturationShift, setSaturationShift] = useState(0);

  const handleModeChange = (mode: 'hierarchy' | 'categorical' | 'custom') => {
    if (mode === 'hierarchy') {
      onHierarchyUpdate({ enabled: true });
      onNodeConfigUpdate({ autoColorBy: 'depth' });
    } else if (mode === 'categorical') {
      onHierarchyUpdate({ enabled: false });
      if (nodeConfig.autoColorBy !== 'tags' && nodeConfig.autoColorBy !== 'branch') {
        onNodeConfigUpdate({ autoColorBy: 'tags' });
      }
    } else {
      // Custom / Single
      onHierarchyUpdate({ enabled: false });
      onNodeConfigUpdate({ autoColorBy: 'type' });
    }
  };

  // 1-Click generators
  const handleApplyPreset = (presetId: HierarchyPresetId) => {
    const found = presetById(presetId);
    if (found) {
      onHierarchyUpdate({
        enabled: true,
        preset: presetId,
        levelColors: [...found.colors],
      });
      onNodeConfigUpdate({ autoColorBy: 'depth' });
    }
  };

  const handleGenerateHarmony = () => {
    const base = hierarchy.levelColors[0] || 'hsl(45, 95%, 60%)';
    const newColors = generateHarmonyPalette(base, Math.max(4, hierarchy.levelColors.length));
    onHierarchyUpdate({
      enabled: true,
      preset: 'custom',
      levelColors: newColors,
    });
    onNodeConfigUpdate({ autoColorBy: 'depth' });
  };

  const handleApplySpreadAndSat = (spread: number, sat: number) => {
    setColorSpread(spread);
    setSaturationShift(sat);
    const updated = transformPaletteSpreadAndSaturation(
      hierarchy.levelColors,
      spread,
      sat
    );
    onHierarchyUpdate({ levelColors: updated, preset: 'custom' });
  };

  const setLevelColor = (index: number, color: string) => {
    const nextColors = [...hierarchy.levelColors];
    nextColors[index] = color;
    onHierarchyUpdate({ levelColors: nextColors, preset: 'custom' });
  };

  const addLevel = () => {
    const lastColor = hierarchy.levelColors[hierarchy.levelColors.length - 1] || 'hsl(200, 80%, 55%)';
    onHierarchyUpdate({
      levelColors: [...hierarchy.levelColors, lastColor],
      preset: 'custom',
    });
  };

  const removeLevel = (index: number) => {
    if (hierarchy.levelColors.length <= 2) return;
    onHierarchyUpdate({
      levelColors: hierarchy.levelColors.filter((_, i) => i !== index),
      preset: 'custom',
    });
  };

return (
  <div className={cn('space-y-2.5', className)}>
    {/* Segmented Mode Selector */}
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground truncate">
          <Palette className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">Color Engine Mode</span>
        </Label>
        <span className="text-[9px] text-muted-foreground capitalize font-medium shrink-0">
          {activeMode}
        </span>
      </div>
      <Tabs
        value={activeMode}
        onValueChange={(val) => handleModeChange(val as 'hierarchy' | 'categorical' | 'custom')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 h-7 bg-secondary/40 p-0.5">
          <TabsTrigger
            value="hierarchy"
            className="text-[10px] gap-1 px-0.5 py-0.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Layers className="h-2.5 w-2.5 text-amber-400 shrink-0" />
            <span className="truncate">Hierarchy</span>
          </TabsTrigger>
          <TabsTrigger
            value="categorical"
            className="text-[10px] gap-1 px-0.5 py-0.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Tag className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
            <span className="truncate">Category</span>
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="text-[10px] gap-1 px-0.5 py-0.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Paintbrush className="h-2.5 w-2.5 text-primary shrink-0" />
            <span className="truncate">Custom</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: HIERARCHY */}
        <TabsContent value="hierarchy" className="mt-2 space-y-2 focus-visible:outline-none">
          {/* Interactive Depth Gradient Preview Strip */}
          <div className="rounded-md border border-border/70 bg-secondary/25 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-foreground">Depth Gradient Flow</span>
              <span className="text-[9px] text-muted-foreground">Root ➔ Deepest</span>
            </div>

            {/* Gradient Ribbon */}
            <div className="relative flex h-5 w-full overflow-hidden rounded border border-border shadow-inner">
              {hierarchy.levelColors.map((col, idx) => (
                <div
                  key={idx}
                  className="group relative flex-1 transition-all hover:flex-[1.5]"
                  style={{ backgroundColor: col }}
                  title={`Level ${idx}: ${col}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-black/80 drop-shadow-sm opacity-80 group-hover:opacity-100">
                    {idx === 0 ? 'R' : `L${idx}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[9px] text-muted-foreground px-0.5">
              <span>L0 (Root)</span>
              <span>Sub-levels</span>
              <span>Deepest</span>
            </div>
          </div>

            {/* 1-Click Action Preset Buttons */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">1-Click Harmonic Presets</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                  onClick={handleGenerateHarmony}
                  title="Generate dynamic complementary harmony"
                >
                  <Wand2 className="h-3 w-3 text-amber-400" />
                  Harmony
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                  onClick={() => handleApplyPreset('pastel')}
                  title="Soft, pastel color harmony"
                >
                  <SunMedium className="h-3 w-3 text-pink-400" />
                  Pastel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-1.5 border-border/80 hover:border-primary/50"
                  onClick={() => handleApplyPreset('neon')}
                  title="Vivid dark mode neon"
                >
                  <Zap className="h-3 w-3 text-cyan-400" />
                  Dark Neon
                </Button>
              </div>
            </div>

            {/* Tuning Sliders: Color Spread & Saturation */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Color Spread (Hue Spread)</span>
                  <span>{colorSpread.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[colorSpread]}
                  min={0.4}
                  max={2.0}
                  step={0.1}
                  onValueChange={([v]) => handleApplySpreadAndSat(v, saturationShift)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Saturation Shift</span>
                  <span>{saturationShift > 0 ? `+${saturationShift}` : saturationShift}%</span>
                </div>
                <Slider
                  value={[saturationShift]}
                  min={-40}
                  max={40}
                  step={5}
                  onValueChange={([v]) => handleApplySpreadAndSat(colorSpread, v)}
                />
              </div>
            </div>

            {/* Preset Selector Dropdown */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Palette Library</Label>
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
                              className="h-2.5 w-2 first:rounded-l-sm last:rounded-r-sm"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </span>
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="text-xs">Custom Tuned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Overflow Rule */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Levels Beyond Palette</span>
              </div>
              <Select
                value={hierarchy.overflow}
                onValueChange={(val) => onHierarchyUpdate({ overflow: val as HierarchyOverflow })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loop" className="text-xs">Loop — restart palette</SelectItem>
                  <SelectItem value="gradient" className="text-xs">Gradient — shade deeper</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Per-level Fine Tuning */}
            <div className="space-y-1.5 border-t border-border/60 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Individual Depth Colors
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px] text-primary"
                  onClick={addLevel}
                >
                  <Plus className="h-3 w-3" /> Add Level
                </Button>
              </div>

              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {hierarchy.levelColors.map((color, index) => (
                  <div key={`lvl-${index}`} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <ColorPicker
                        label={index === 0 ? 'Root' : `Level ${index}`}
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
                        title="Remove level"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CATEGORICAL / TAG / TYPE */}
          <TabsContent value="categorical" className="mt-3 space-y-3 focus-visible:outline-none">
            <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/30 p-2.5">
              <Label className="text-[11px] font-medium text-foreground">
                Categorical Source
              </Label>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant={nodeConfig.autoColorBy === 'tags' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-xs h-8',
                    nodeConfig.autoColorBy === 'tags' && 'bg-background shadow-sm border border-border/60'
                  )}
                  onClick={() => {
                    onHierarchyUpdate({ enabled: false });
                    onNodeConfigUpdate({ autoColorBy: 'tags' });
                  }}
                >
                  <Tag className="h-3.5 w-3.5 text-cyan-400" />
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Markdown Tags</span>
                    <span className="text-[9px] text-muted-foreground">Color by #project, #note tags</span>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant={nodeConfig.autoColorBy === 'branch' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-xs h-8',
                    nodeConfig.autoColorBy === 'branch' && 'bg-background shadow-sm border border-border/60'
                  )}
                  onClick={() => {
                    onHierarchyUpdate({ enabled: false });
                    onNodeConfigUpdate({ autoColorBy: 'branch' });
                  }}
                >
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Branch Subtree</span>
                    <span className="text-[9px] text-muted-foreground">Descendants inherit root branch hue</span>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant={nodeConfig.autoColorBy === 'type' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-xs h-8',
                    nodeConfig.autoColorBy === 'type' && 'bg-background shadow-sm border border-border/60'
                  )}
                  onClick={() => {
                    onHierarchyUpdate({ enabled: false });
                    onNodeConfigUpdate({ autoColorBy: 'type' });
                  }}
                >
                  <Palette className="h-3.5 w-3.5 text-amber-400" />
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Entity Type</span>
                    <span className="text-[9px] text-muted-foreground">Distinct Folder vs Note color</span>
                  </div>
                </Button>
              </div>
            </div>

            {nodeConfig.autoColorBy === 'type' && (
              <div className="space-y-2 border-t border-border/60 pt-2">
                <ColorPicker
                  label="Folder Color"
                  value={nodeConfig.folderColor}
                  onChange={(val) => onNodeConfigUpdate({ folderColor: val })}
                />
                <ColorPicker
                  label="File / Note Color"
                  value={nodeConfig.fileColor}
                  onChange={(val) => onNodeConfigUpdate({ fileColor: val })}
                />
              </div>
            )}
          </TabsContent>

          {/* TAB 3: CUSTOM / SINGLE */}
          <TabsContent value="custom" className="mt-3 space-y-3 focus-visible:outline-none">
            <div className="space-y-2.5">
              <div className="text-[11px] text-muted-foreground">
                Set clean monochrome or brand-specific palette:
              </div>

              <ColorPicker
                label="Primary File Color"
                value={nodeConfig.fileColor}
                onChange={(val) => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ fileColor: val, autoColorBy: 'none' });
                }}
              />

              <ColorPicker
                label="Folder Accent Color"
                value={nodeConfig.folderColor}
                onChange={(val) => {
                  onHierarchyUpdate({ enabled: false });
                  onNodeConfigUpdate({ folderColor: val });
                }}
              />

              <ColorPicker
                label="Selected Node Glow"
                value={nodeConfig.selectedColor}
                onChange={(val) => onNodeConfigUpdate({ selectedColor: val })}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}