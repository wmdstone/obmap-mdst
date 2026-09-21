/**
 * Layout engine settings: default layout mode, mindmap orientation, spacing
 * and label behaviour for the single graph renderer.
 */

import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Slider } from "@/shared/ui/slider-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useGraphEngineStore } from "@/shared/stores/useGraphEngineStore";
import { useGraphInteractionStore } from "@/core/graph/model/useGraphInteractionStore";
import type {
  LayoutMode,
  MindmapOrientation,
} from "@/core/graph/model/graphTypes";

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
      <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-1.5">
          <Label className="text-xs">Zoom-out rendering</Label>
          <Select
            value={engine.zoomOutRendering}
            onValueChange={(value) =>
              engine.patch({
                zoomOutRendering: value as "optimized" | "full-detail",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="optimized">Optimized</SelectItem>
              <SelectItem value="full-detail">Keep full detail</SelectItem>
            </SelectContent>
          </Select>
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm">Highlight connected path</Label>
          <p className="text-xs text-muted-foreground">
            Dim unrelated nodes while hovering.
          </p>
        </div>
        <Switch
          checked={interaction.highlightMode === "pathway"}
          onCheckedChange={(v) =>
            interaction.setHighlightMode(v ? "pathway" : "off")
          }
        />
      </div>
    </div>
  );
}
