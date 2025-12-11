import { Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";

const hslToHex = (hsl: string): string => {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v));
  const lightness = l / 100;
  const saturation = s / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) { r = chroma; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = chroma; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = chroma; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = chroma; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = chroma; }
  else if (h >= 300 && h < 360) { r = chroma; g = 0; b = x; }
  
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

const ColorPicker = ({ label, value, onChange, description }: ColorPickerProps) => {
  const hexValue = hslToHex(value);
  
  const handleChange = (hex: string) => {
    const hsl = hexToHsl(hex);
    onChange(hsl);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hexValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-16 h-10 rounded border border-border cursor-pointer bg-transparent"
        />
        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
          {value}
        </code>
      </div>
    </div>
  );
};

const SliderControl = ({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step, 
  description 
}: { 
  label: string; 
  value: number; 
  onChange: (value: number) => void; 
  min: number; 
  max: number; 
  step: number; 
  description?: string; 
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono w-16 text-center">
          {value}
        </code>
      </div>
    </div>
  );
};

export const ThemeCustomizer = () => {
  const { theme, updateColor, updatePhysics, resetTheme } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="fixed bottom-4 left-4 lg:left-auto lg:right-4 z-50 shadow-lg">
          <Palette className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Theme Customization</SheetTitle>
          <SheetDescription>
            Customize the application colors, network nodes, and physics
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Application Colors</h3>
            <ColorPicker
              label="Primary Color"
              value={theme.colors.primary}
              onChange={(v) => updateColor("primary", v)}
              description="Main brand color used throughout the app"
            />
            <ColorPicker
              label="Accent Color"
              value={theme.colors.accent}
              onChange={(v) => updateColor("accent", v)}
              description="Accent color for highlights and selected states"
            />
            <ColorPicker
              label="Background Color"
              value={theme.colors.background}
              onChange={(v) => updateColor("background", v)}
              description="Main background color"
            />
            <ColorPicker
              label="Text Color"
              value={theme.colors.foreground}
              onChange={(v) => updateColor("foreground", v)}
              description="Primary text color"
            />
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Network Canvas & Nodes</h3>
            <ColorPicker
              label="Canvas Background"
              value={theme.colors.canvasBackground}
              onChange={(v) => updateColor("canvasBackground", v)}
              description="Background color of the network canvas"
            />
            <ColorPicker
              label="Folder Node Color"
              value={theme.colors.folderNodeColor}
              onChange={(v) => updateColor("folderNodeColor", v)}
              description="Color for folder nodes in the graph"
            />
            <ColorPicker
              label="File Node Color"
              value={theme.colors.fileNodeColor}
              onChange={(v) => updateColor("fileNodeColor", v)}
              description="Color for file nodes in the graph"
            />
            <ColorPicker
              label="Node Glow Color"
              value={theme.colors.nodeGlow}
              onChange={(v) => updateColor("nodeGlow", v)}
              description="Glow effect color for network nodes"
            />
            <ColorPicker
              label="Link Color"
              value={theme.colors.linkColor}
              onChange={(v) => updateColor("linkColor", v)}
              description="Color for connections between nodes"
            />
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Network Physics</h3>
            <SliderControl
              label="Charge Strength"
              value={theme.physics.chargeStrength}
              onChange={(v) => updatePhysics("chargeStrength", v)}
              min={-1000}
              max={0}
              step={50}
              description="Repulsion force between nodes (more negative = stronger)"
            />
            <SliderControl
              label="Link Distance"
              value={theme.physics.linkDistance}
              onChange={(v) => updatePhysics("linkDistance", v)}
              min={10}
              max={300}
              step={10}
              description="Default distance between connected nodes"
            />
            <SliderControl
              label="Velocity Decay"
              value={theme.physics.velocityDecay}
              onChange={(v) => updatePhysics("velocityDecay", v)}
              min={0.1}
              max={0.9}
              step={0.05}
              description="Speed at which nodes slow down (higher = quicker stop)"
            />
            <SliderControl
              label="Alpha Decay"
              value={theme.physics.alphaDecay}
              onChange={(v) => updatePhysics("alphaDecay", v)}
              min={0.01}
              max={0.1}
              step={0.01}
              description="Simulation cooling rate (higher = faster stabilization)"
            />
          </div>

          <Button
            variant="outline"
            onClick={resetTheme}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default Theme
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
