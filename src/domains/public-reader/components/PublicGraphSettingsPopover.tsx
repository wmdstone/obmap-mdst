/**
 * PublicGraphSettingsPopover
 *
 * Panel kontrol visual melayang (floating gear widget) di pojok kiri bawah graf publik.
 * Memungkinkan pembaca publik menyesuaikan tema, label, visibilitas node, pilihan layout,
 * serta jarak relasi tanpa memengaruhi workspace internal penulis.
 */

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import type { GraphConfigState } from "@/domains/graph/stores/useGraphStore";
import type { LayoutMode } from "@/domains/graph/model/graphTypes";
import {
  Settings2,
  RotateCcw,
  Maximize2,
  Type,
  Palette,
  Network,
  Filter,
  Sliders,
  Sparkles,
} from "lucide-react";

export interface ColorThemePreset {
  id: string;
  name: string;
  fileColor: string;
  folderColor: string;
  linkColor: string;
  accentColor: string;
}

export const GRAPH_THEME_PRESETS: ColorThemePreset[] = [
  {
    id: "default",
    name: "Classic ObMap",
    fileColor: "#3b82f6",
    folderColor: "#eab308",
    linkColor: "#60a5fa",
    accentColor: "#2563eb",
  },
  {
    id: "obsidian",
    name: "Obsidian Violet",
    fileColor: "#a855f7",
    folderColor: "#ec4899",
    linkColor: "#c084fc",
    accentColor: "#9333ea",
  },
  {
    id: "emerald",
    name: "Cyber Emerald",
    fileColor: "#10b981",
    folderColor: "#06b6d4",
    linkColor: "#34d399",
    accentColor: "#059669",
  },
  {
    id: "sunset",
    name: "Warm Sunset",
    fileColor: "#f97316",
    folderColor: "#ef4444",
    linkColor: "#fb923c",
    accentColor: "#ea580c",
  },
  {
    id: "slate",
    name: "Monochrome Slate",
    fileColor: "#94a3b8",
    folderColor: "#cbd5e1",
    linkColor: "#64748b",
    accentColor: "#475569",
  },
];

export const AVAILABLE_LAYOUTS: Array<{ id: LayoutMode; label: string; desc: string }> = [
  { id: "free-force", label: "Free Force", desc: "Simulasi pegas dinamis" },
  { id: "fr-radial", label: "Radial Spread", desc: "Penyebaran konsentris teratur" },
  { id: "kamada-kawai", label: "Kamada-Kawai", desc: "Keseimbangan topologis global" },
  { id: "mindmap", label: "Mindmap Tree", desc: "Pohon hierarki seimbang" },
  { id: "timeline", label: "Timeline", desc: "Urutan kronologis waktu" },
];

export interface PublicGraphSettingsPopoverProps {
  config: GraphConfigState;
  onConfigChange: (updater: (prev: GraphConfigState) => GraphConfigState) => void;
  currentLayout: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onResetDefaults: () => void;
  onFitCamera: () => void;
}

export const PublicGraphSettingsPopover: React.FC<PublicGraphSettingsPopoverProps> = ({
  config,
  onConfigChange,
  currentLayout,
  onLayoutChange,
  onResetDefaults,
  onFitCamera,
}) => {
  const [activeThemeId, setActiveThemeId] = React.useState<string>("default");

  // Terapkan Palet Preset
  const handleApplyTheme = (preset: ColorThemePreset) => {
    setActiveThemeId(preset.id);
    onConfigChange((prev) => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        fileColor: preset.fileColor,
        folderColor: preset.folderColor,
      },
      links: {
        ...prev.links,
        color: preset.linkColor,
      },
    }));
  };

  return (
    <TooltipProvider delayDuration={250}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full border border-border/80 bg-background/90 backdrop-blur-md shadow-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <Settings2 className="w-4 h-4 text-primary" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Pengaturan Graf Publik
          </TooltipContent>
        </Tooltip>

        {/* Floating Settings Cockpit Panel */}
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-80 sm:w-96 p-3 rounded-2xl border border-border/80 bg-card/98 backdrop-blur-xl shadow-2xl text-xs select-none z-50 max-h-[440px] overflow-x-hidden overflow-y-auto [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Pengaturan Graf Publik</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onFitCamera}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Fokus Seluruh Graf</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setActiveThemeId("default");
                      onResetDefaults();
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Reset ke Default</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            {/* 1. Pilihan Layout */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                <Network className="w-3 h-3 text-primary" />
                <span>Pilihan Layout</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {AVAILABLE_LAYOUTS.map((layout) => {
                  const isActive = currentLayout === layout.id;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => onLayoutChange(layout.id)}
                      className={`flex flex-col text-left px-2 py-1.5 rounded-lg border transition-all ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-background/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="text-[11px] font-semibold">{layout.label}</span>
                      <span className="text-[9px] opacity-75 leading-tight truncate">
                        {layout.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* 2. Tema Warna */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-medium text-foreground text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-primary" />
                  <span>Tema Warna</span>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 font-normal px-1.5">
                  {GRAPH_THEME_PRESETS.find((p) => p.id === activeThemeId)?.name || "Kustom"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                {GRAPH_THEME_PRESETS.map((preset) => {
                  const isSelected = activeThemeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyTheme(preset)}
                      title={preset.name}
                      className={`relative w-6 h-6 rounded-full border-2 transition-transform flex items-center justify-center p-0.5 ${
                        isSelected
                          ? "border-primary scale-110 shadow-sm"
                          : "border-border hover:scale-105"
                      }`}
                    >
                      <div
                        className="w-full h-full rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${preset.fileColor} 50%, ${preset.folderColor} 50%)`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* 3. Label Catatan */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                <Type className="w-3 h-3 text-primary" />
                <span>Label Catatan</span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <Label className="text-xs text-muted-foreground cursor-pointer">
                  Tampilkan Nama Catatan
                </Label>
                <Switch
                  checked={config.nodes.showLabels}
                  onCheckedChange={(checked) =>
                    onConfigChange((prev) => ({
                      ...prev,
                      nodes: { ...prev.nodes, showLabels: checked },
                    }))
                  }
                />
              </div>

              {config.nodes.showLabels && (
                <>
                  <div className="flex items-center justify-between py-0.5">
                    <Label className="text-xs text-muted-foreground cursor-pointer">
                      Kotak Latar Label (Card Pill)
                    </Label>
                    <Switch
                      checked={config.nodes.labelBox}
                      onCheckedChange={(checked) =>
                        onConfigChange((prev) => ({
                          ...prev,
                          nodes: { ...prev.nodes, labelBox: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Ukuran Teks Label</span>
                      <span className="font-mono">{config.nodes.labelSize}px</span>
                    </div>
                    <Slider
                      min={8}
                      max={18}
                      step={1}
                      value={[config.nodes.labelSize]}
                      onValueChange={([val]) =>
                        onConfigChange((prev) => ({
                          ...prev,
                          nodes: { ...prev.nodes, labelSize: val },
                        }))
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* 4. Filter Jenis Node */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                <Filter className="w-3 h-3 text-primary" />
                <span>Filter Jenis Node</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <Label className="text-xs text-muted-foreground cursor-pointer">
                  Catatan Teks (Files)
                </Label>
                <Switch
                  checked={config.nodes.showFileNodes}
                  onCheckedChange={(checked) =>
                    onConfigChange((prev) => ({
                      ...prev,
                      nodes: { ...prev.nodes, showFileNodes: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <Label className="text-xs text-muted-foreground cursor-pointer">
                  Folder / Kategori Hub
                </Label>
                <Switch
                  checked={config.nodes.showFolderNodes}
                  onCheckedChange={(checked) =>
                    onConfigChange((prev) => ({
                      ...prev,
                      nodes: { ...prev.nodes, showFolderNodes: checked },
                    }))
                  }
                />
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* 5. Jarak & Peregangan Fisika */}
            <div className="space-y-2.5 pb-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                <Sliders className="w-3 h-3 text-primary" />
                <span>Jarak Node & Keregangan</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Panjang Relasi</span>
                  <span className="font-mono">{config.forces.linkDistance}px</span>
                </div>
                <Slider
                  min={30}
                  max={250}
                  step={5}
                  value={[config.forces.linkDistance]}
                  onValueChange={([val]) =>
                    onConfigChange((prev) => ({
                      ...prev,
                      forces: { ...prev.forces, linkDistance: val },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Gaya Tolak Antar Node</span>
                  <span className="font-mono">{Math.abs(config.forces.chargeStrength)}</span>
                </div>
                <Slider
                  min={50}
                  max={500}
                  step={10}
                  value={[Math.abs(config.forces.chargeStrength)]}
                  onValueChange={([val]) =>
                    onConfigChange((prev) => ({
                      ...prev,
                      forces: { ...prev.forces, chargeStrength: -val },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};
