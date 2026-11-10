/**
 * Layout engine settings: default layout mode, mindmap orientation, spacing
 * and label behaviour for the single graph renderer.
 */

import { Label } from "@/global/ui/label";
import { Input } from "@/global/ui/input";
import { Switch } from "@/global/ui/switch";
import { Slider } from "@/global/ui/slider-number";
import { Button } from "@/global/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/global/ui/select";
import { useGraphEngineStore } from "@/domains/graph/shared/stores/useGraphEngineStore";
import { useGraphInteractionStore } from "@/domains/graph/shared/stores/useGraphInteractionStore";
import type {
  LayoutMode,
  MindmapOrientation,
} from "@/domains/graph/shared/utils/graph.types";

const LAYOUTS: { value: LayoutMode; label: string }[] = [
  { value: "mindmap", label: "Mindmap" },
  { value: "timeline", label: "Timeline" },
  { value: "fishbone", label: "Fishbone" },
  { value: "free-force", label: "Free force" },
];

export function LayoutEngineTab() {
  const engine = useGraphEngineStore();
  const interaction = useGraphInteractionStore();

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Default layout</Label>
          <Select
            value={interaction.layoutMode}
            onValueChange={(v) => interaction.setLayoutMode(v as LayoutMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Mindmap orientation</Label>
          <Select
            value={interaction.orientation}
            onValueChange={(v) =>
              interaction.setOrientation(v as MindmapOrientation)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced (left / right)</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Timeline date property</Label>
          <Input
            value={engine.timeField}
            onChange={(e) => engine.patch({ timeField: e.target.value })}
            placeholder="date"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Label zoom threshold ({engine.labelZoomThreshold.toFixed(2)}x)
          </Label>
          <Slider
            min={0.1}
            max={2}
            step={0.05}
            value={[engine.labelZoomThreshold]}
            onValueChange={([v]) => engine.patch({ labelZoomThreshold: v })}
          />
        </div>

        {/* Layout Structure: Auto vs Custom (Tepat di atas Zoom-Out) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Layout Structure</Label>
            <span className="text-[10px] text-muted-foreground">
              {interaction.layoutArrangement === 'auto' ? 'Fixed (Anti-overlap)' : 'Freehand Custom'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={interaction.layoutArrangement === 'auto' ? 'secondary' : 'outline'}
              className="h-8 text-xs font-medium"
              onClick={() => interaction.setLayoutArrangement('auto')}
            >
              Auto
            </Button>
            <Button
              type="button"
              variant={interaction.layoutArrangement === 'custom' ? 'secondary' : 'outline'}
              className="h-8 text-xs font-medium"
              onClick={() => interaction.setLayoutArrangement('custom')}
            >
              Custom
            </Button>
          </div>
        </div>

        {/* Zoom-out rendering: 2 Tombol Minimalist Modern */}
        <div className="space-y-1.5">
          <Label className="text-xs">Zoom-out rendering</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={engine.zoomOutRendering === 'optimized' ? 'secondary' : 'outline'}
              className="h-8 text-xs font-medium"
              onClick={() => engine.patch({ zoomOutRendering: 'optimized' })}
            >
              Optimized
            </Button>
            <Button
              type="button"
              variant={engine.zoomOutRendering === 'full-detail' ? 'secondary' : 'outline'}
              className="h-8 text-xs font-medium"
              onClick={() => engine.patch({ zoomOutRendering: 'full-detail' })}
            >
              Full Detail
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep full detail preserves node cards, labels, and link weight while zooming out.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Sibling / lane gap ({engine.laneHeight})
          </Label>
          <Slider
            min={20}
            max={120}
            step={2}
            value={[engine.laneHeight]}
            onValueChange={([v]) => engine.patch({ laneHeight: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Level distance ({engine.levelDistance})
          </Label>
          <Slider
            min={50}
            max={260}
            step={5}
            value={[engine.levelDistance]}
            onValueChange={([v]) => engine.patch({ levelDistance: v })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm">Node labels</Label>
          <p className="text-xs text-muted-foreground">
            Hide labels to keep very large graphs readable.
          </p>
        </div>
        <Switch
          checked={engine.showLabels}
          onCheckedChange={(v) => engine.patch({ showLabels: v })}
        />
      </div>
    </div>
  );
}
