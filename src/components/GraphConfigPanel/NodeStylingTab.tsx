/**
 * NodeStylingTab - Node visual configuration with collapsible sections
 */

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Circle,
  Eye,
  Palette,
  Type,
  Sparkles,
} from 'lucide-react';
import { NodeConfig } from '@/hooks/useGraphConfig';
import { ColorPicker } from './ColorPicker';
import { CollapsibleSection } from './CollapsibleSection';

interface NodeStylingTabProps {
  config: NodeConfig;
  is3D: boolean;
  onUpdate: (updates: Partial<NodeConfig>) => void;
}

export function NodeStylingTab({ config, is3D, onUpdate }: NodeStylingTabProps) {
  return (
    <div className="space-y-4">
      {/* Dimensions & Fidelity */}
      <CollapsibleSection
        icon={<Circle className="w-4 h-4 text-primary" />}
        title="Dimensions & Fidelity"
        defaultOpen={true}
      >
        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Relative Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Relative Size</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {config.relSize}
              </Badge>
            </div>
            <Slider
              value={[config.relSize]}
              onValueChange={([value]) => onUpdate({ relSize: value })}
              min={1}
              max={20}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Base node size (nodeRelSize)
            </p>
          </div>

          {/* Resolution (3D only) */}
          {is3D && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Geometry Resolution</Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {config.resolution}
                </Badge>
              </div>
              <Slider
                value={[config.resolution]}
                onValueChange={([value]) => onUpdate({ resolution: value })}
                min={4}
                max={32}
                step={2}
              />
              <p className="text-xs text-muted-foreground">
                Sphere segments (higher = smoother, slower)
              </p>
            </div>
          )}

          {/* Label Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Label Size</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {config.labelSize}px
              </Badge>
            </div>
            <Slider
              value={[config.labelSize]}
              onValueChange={([value]) => onUpdate({ labelSize: value })}
              min={8}
              max={24}
              step={1}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Visibility & Transparency */}
      <CollapsibleSection
        icon={<Eye className="w-4 h-4 text-primary" />}
        title="Visibility & Transparency"
        defaultOpen={false}
      >
        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Node Visibility */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Node Visibility</Label>
              <p className="text-xs text-muted-foreground">Show/hide all nodes</p>
            </div>
            <Switch
              checked={config.visible}
              onCheckedChange={(checked) => onUpdate({ visible: checked })}
            />
          </div>

          {/* Show Labels */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Labels</Label>
              <p className="text-xs text-muted-foreground">Display node names</p>
            </div>
            <Switch
              checked={config.showLabels}
              onCheckedChange={(checked) => onUpdate({ showLabels: checked })}
            />
          </div>

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
        </div>
      </CollapsibleSection>

      {/* Color Management */}
      <CollapsibleSection
        icon={<Palette className="w-4 h-4 text-primary" />}
        title="Color Management"
        defaultOpen={false}
      >
        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          {/* Auto-Color Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Auto-Color By</Label>
            <Select
              value={config.autoColorBy}
              onValueChange={(value: NodeConfig['autoColorBy']) =>
                onUpdate({ autoColorBy: value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    Manual Colors
                  </div>
                </SelectItem>
                <SelectItem value="type">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    Node Type (file/folder)
                  </div>
                </SelectItem>
                <SelectItem value="depth">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    Depth Level
                  </div>
                </SelectItem>
                <SelectItem value="tags">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    First Tag
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 gap-3">
            <ColorPicker
              label="Folder Color"
              value={config.folderColor}
              onChange={(color) => onUpdate({ folderColor: color })}
            />
            <ColorPicker
              label="File Color"
              value={config.fileColor}
              onChange={(color) => onUpdate({ fileColor: color })}
            />
            <ColorPicker
              label="Selected Color"
              value={config.selectedColor}
              onChange={(color) => onUpdate({ selectedColor: color })}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Labels Configuration */}
      <CollapsibleSection
        icon={<Type className="w-4 h-4 text-primary" />}
        title="Label Configuration"
        defaultOpen={false}
      >
        <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Label Source Field</Label>
            <Select
              value={config.labelField}
              onValueChange={(value: NodeConfig['labelField']) =>
                onUpdate({ labelField: value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Node Name</SelectItem>
                <SelectItem value="id">Node ID</SelectItem>
                <SelectItem value="custom">Custom Field</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Maps to nodeLabel prop for hover text
            </p>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
