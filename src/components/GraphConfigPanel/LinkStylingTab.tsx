/**
 * LinkStylingTab - Link/edge visual configuration
 */

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Link2,
  MoveRight,
  Sparkles,
  Palette,
  Waves,
} from 'lucide-react';
import { LinkConfig } from '@/hooks/useGraphConfig';
import { ColorPicker } from './ColorPicker';

interface LinkStylingTabProps {
  config: LinkConfig;
  is3D: boolean;
  onUpdate: (updates: Partial<LinkConfig>) => void;
}

const DASH_PRESETS = [
  { value: '', label: 'Solid' },
  { value: '8,4', label: 'Dashed' },
  { value: '2,3', label: 'Dotted' },
  { value: '12,3,3,3', label: 'Dash-Dot' },
  { value: '20,5', label: 'Long Dash' },
];

export function LinkStylingTab({ config, is3D, onUpdate }: LinkStylingTabProps) {
  return (
    <div className="space-y-6">
      {/* Geometric Properties */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="w-4 h-4 text-primary" />
          Geometric Properties
        </div>

        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Link Width */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Link Width</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {config.width}px
              </Badge>
            </div>
            <Slider
              value={[config.width]}
              onValueChange={([value]) => onUpdate({ width: value })}
              min={0.5}
              max={10}
              step={0.5}
            />
          </div>

          {/* Curvature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Curvature</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {config.curvature.toFixed(2)}
              </Badge>
            </div>
            <Slider
              value={[config.curvature]}
              onValueChange={([value]) => onUpdate({ curvature: value })}
              min={0}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              0 = straight line, 1 = max curve
            </p>
          </div>

          {/* Curve Rotation (when curvature > 0) */}
          {config.curvature > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Curve Rotation</Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {Math.round(config.curveRotation * (180 / Math.PI))}°
                </Badge>
              </div>
              <Slider
                value={[config.curveRotation]}
                onValueChange={([value]) => onUpdate({ curveRotation: value })}
                min={0}
                max={Math.PI * 2}
                step={0.1}
              />
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Visual Differentiation */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette className="w-4 h-4 text-primary" />
          Visual Differentiation
        </div>

        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Link Color */}
          <ColorPicker
            label="Link Color"
            value={config.color}
            onChange={(color) => onUpdate({ color })}
          />

          {/* Opacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Opacity</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {Math.round(config.opacity * 100)}%
              </Badge>
            </div>
            <Slider
              value={[config.opacity]}
              onValueChange={([value]) => onUpdate({ opacity: value })}
              min={0.1}
              max={1}
              step={0.05}
            />
          </div>

          {/* Dash Array */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Line Style</Label>
            <Select
              value={config.dashArray}
              onValueChange={(value) => onUpdate({ dashArray: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DASH_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    <div className="flex items-center gap-3">
                      <svg width="48" height="4" className="flex-shrink-0">
                        <line
                          x1="0"
                          y1="2"
                          x2="48"
                          y2="2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray={preset.value || undefined}
                        />
                      </svg>
                      {preset.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Custom Pattern</Label>
              <Input
                value={config.dashArray}
                onChange={(e) => onUpdate({ dashArray: e.target.value })}
                placeholder="e.g. 5,5,10,5"
                className="h-8 mt-1 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Directionality - Arrows */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MoveRight className="w-4 h-4 text-primary" />
          Directional Arrows
        </div>

        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Enable Arrows */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Arrows</Label>
              <p className="text-xs text-muted-foreground">Display direction indicators</p>
            </div>
            <Switch
              checked={config.showArrows}
              onCheckedChange={(checked) => onUpdate({ showArrows: checked })}
            />
          </div>

          {config.showArrows && (
            <>
              {/* Arrow Length */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Arrow Length</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {config.arrowLength}
                  </Badge>
                </div>
                <Slider
                  value={[config.arrowLength]}
                  onValueChange={([value]) => onUpdate({ arrowLength: value })}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              {/* Arrow Position */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Arrow Position</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {Math.round(config.arrowRelPos * 100)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.arrowRelPos]}
                  onValueChange={([value]) => onUpdate({ arrowRelPos: value })}
                  min={0}
                  max={1}
                  step={0.05}
                />
                <p className="text-xs text-muted-foreground">
                  0 = at source, 1 = at target
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <Separator />

      {/* Directionality - Particles */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          Particle Flow Animation
        </div>

        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Enable Particles */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Particles</Label>
              <p className="text-xs text-muted-foreground">Animate flow along links</p>
            </div>
            <Switch
              checked={config.showParticles}
              onCheckedChange={(checked) => onUpdate({ showParticles: checked })}
            />
          </div>

          {config.showParticles && (
            <>
              {/* Particle Count */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Particle Count</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {config.particles}
                  </Badge>
                </div>
                <Slider
                  value={[config.particles]}
                  onValueChange={([value]) => onUpdate({ particles: value })}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              {/* Particle Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Speed</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {config.particleSpeed.toFixed(3)}
                  </Badge>
                </div>
                <Slider
                  value={[config.particleSpeed]}
                  onValueChange={([value]) => onUpdate({ particleSpeed: value })}
                  min={0.001}
                  max={0.05}
                  step={0.001}
                />
              </div>

              {/* Particle Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Particle Width</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {config.particleWidth}px
                  </Badge>
                </div>
                <Slider
                  value={[config.particleWidth]}
                  onValueChange={([value]) => onUpdate({ particleWidth: value })}
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>

              {/* Particle Color */}
              <ColorPicker
                label="Particle Color"
                value={config.particleColor}
                onChange={(color) => onUpdate({ particleColor: color })}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
