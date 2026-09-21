/**
 * Hierarchy level colour controls (Nodes → Color Management) and the link
 * colour mode controls (Links → Visual Appearance). Both read and write the
 * graph store directly so every change is live, with no separate save step.
 */

import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Slider } from "@/shared/ui/slider-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useGraphStore } from '@/shared/stores/useGraphStore';
import {
  HIERARCHY_PRESETS,
  presetById,
  resolveLevelColor,
  resolveLevelOpacity,
  type HierarchyLinkColorMode,
  type HierarchyOverflow,
  type HierarchyPresetId,
} from '../model/hierarchyColors';
import { ColorPicker } from './ColorPicker';

const MIN_LEVELS = 3;

export function HierarchyColorControls() {
  const hierarchy = useGraphStore((s) => s.config.hierarchy);
  const updateHierarchyConfig = useGraphStore((s) => s.updateHierarchyConfig);

  const setPreset = (preset: HierarchyPresetId) => {
    const found = presetById(preset);
    updateHierarchyConfig({
      preset,
      ...(found ? { levelColors: [...found.colors] } : {}),
    });
  };

  const setLevelColor = (index: number, color: string) => {
    const levelColors = [...hierarchy.levelColors];
    levelColors[index] = color;
    updateHierarchyConfig({ levelColors, preset: 'custom' });
  };

  const addLevel = () => {
    const next = resolveLevelColor(hierarchy.levelColors.length, hierarchy);
    updateHierarchyConfig({
      levelColors: [...hierarchy.levelColors, next],
      preset: 'custom',
    });
  };

  const removeLevel = (index: number) => {
    if (hierarchy.levelColors.length <= MIN_LEVELS) return;
    updateHierarchyConfig({
      levelColors: hierarchy.levelColors.filter((_, i) => i !== index),
      preset: 'custom',
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Color by hierarchy level</Label>
          <p className="text-xs text-muted-foreground">
            One colour per folder depth, applied to nodes and hierarchy links
          </p>
        </div>
        <Switch
          checked={hierarchy.enabled}
          onCheckedChange={(checked) => updateHierarchyConfig({ enabled: checked })}
        />
      </div>

      {hierarchy.enabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Palette preset</Label>
            <Select value={hierarchy.preset} onValueChange={(value) => setPreset(value as HierarchyPresetId)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIERARCHY_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2">
                      <span className="flex">
                        {preset.colors.slice(0, 4).map((color) => (
                          <span
                            key={color}
                            className="h-3 w-2 first:rounded-l-sm last:rounded-r-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      {preset.label}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom palette</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Levels beyond the palette</Label>
            <Select
              value={hierarchy.overflow}
              onValueChange={(value) => updateHierarchyConfig({ overflow: value as HierarchyOverflow })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loop">Loop — restart from the first colour</SelectItem>
                <SelectItem value="gradient">Gradient — keep shading deeper</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {hierarchy.levelColors.map((color, index) => (
              <div key={`level-${index}`} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <ColorPicker
                    label={index === 0 ? 'Level 0 · Root' : `Level ${index}`}
                    value={color}
                    onChange={(next) => setLevelColor(index, next)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={hierarchy.levelColors.length <= MIN_LEVELS}
                  onClick={() => removeLevel(index)}
                  aria-label={`Remove level ${index}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addLevel}>
              <Plus className="h-3.5 w-3.5" />
              Add level {hierarchy.levelColors.length}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function HierarchyLinkColorControls() {
  const hierarchy = useGraphStore((s) => s.config.hierarchy);
  const updateHierarchyConfig = useGraphStore((s) => s.updateHierarchyConfig);
  if (!hierarchy.enabled) return null;

  const levelCount = hierarchy.levelColors.length;

  const setOpacity = (index: number, value: number) => {
    const levelOpacity = Array.from({ length: levelCount }, (_, i) =>
      i === index ? value : resolveLevelOpacity(i, hierarchy)
    );
    updateHierarchyConfig({ levelOpacity });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Hierarchy link color</Label>
        <Select
          value={hierarchy.linkColorMode}
          onValueChange={(value) =>
            updateHierarchyConfig({ linkColorMode: value as HierarchyLinkColorMode })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="parent">Parent Match — colour of the parent level</SelectItem>
            <SelectItem value="child">Child Match — colour of the child level</SelectItem>
            <SelectItem value="level">Level Specific — child colour with level opacity</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Backlinks, tags and semantic links keep their own styles.
        </p>
      </div>

      {hierarchy.linkColorMode === 'level' && (
        <div className="space-y-3">
          {Array.from({ length: levelCount }, (_, index) => (
            <div key={`opacity-${index}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-xs">
                  <span
                    className="h-3 w-3 rounded-sm border border-border/60"
                    style={{ backgroundColor: resolveLevelColor(index, hierarchy) }}
                  />
                  Level {index}
                </Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {Math.round(resolveLevelOpacity(index, hierarchy) * 100)}%
                </Badge>
              </div>
              <Slider
                value={[resolveLevelOpacity(index, hierarchy)]}
                onValueChange={([value]) => setOpacity(index, value)}
                min={0.1}
                max={1}
                step={0.05}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
