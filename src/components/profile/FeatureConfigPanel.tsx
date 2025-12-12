/**
 * Feature Configuration Panel
 * 
 * UI for managing feature enable/disable state with dependency visualization
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useFeatureConfigStore } from '@/services/ui/stores/useFeatureConfigStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card';
import { Switch } from '@/components/core/ui/switch';
import { Badge } from '@/components/core/ui/badge';
import { Button } from '@/components/core/ui/button';
import { Separator } from '@/components/core/ui/separator';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/core/ui/tooltip';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/core/ui/collapsible';
import { 
  Package, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  Check,
  RefreshCw,
  Network,
  Info,
  Lock
} from 'lucide-react';
import { cn } from '@/services/core/utils/cn';
import { toast } from 'sonner';

interface FeatureCardProps {
  featureId: string;
  name: string;
  version: string;
  enabled: boolean;
  isCore: boolean;
  dependencies: string[];
  dependents: string[];
  onToggle: (enabled: boolean) => void;
}

function FeatureCard({ 
  featureId, 
  name, 
  version, 
  enabled, 
  isCore,
  dependencies, 
  dependents,
  onToggle 
}: FeatureCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { featureConfigs } = useFeatureConfigStore();

  const hasDependencyIssues = useMemo(() => {
    if (!enabled) return false;
    return dependencies.some(depId => {
      const config = featureConfigs[depId];
      return config && !config.enabled;
    });
  }, [enabled, dependencies, featureConfigs]);

  const disabledReason = useMemo(() => {
    if (isCore) return 'Core feature cannot be disabled';
    if (enabled && dependents.length > 0) {
      const enabledDependents = dependents.filter(depId => {
        const config = featureConfigs[depId];
        return config?.enabled !== false;
      });
      if (enabledDependents.length > 0) {
        return `Disabling will also disable: ${enabledDependents.join(', ')}`;
      }
    }
    return null;
  }, [isCore, enabled, dependents, featureConfigs]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "border rounded-lg p-4 transition-colors",
        enabled ? "bg-card" : "bg-muted/30",
        hasDependencyIssues && "border-destructive/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger className="hover:bg-accent rounded p-1 -m-1">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            
            <div className={cn(
              "p-2 rounded-md",
              enabled ? "bg-primary/10" : "bg-muted"
            )}>
              <Package className={cn(
                "h-4 w-4",
                enabled ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium",
                  !enabled && "text-muted-foreground"
                )}>
                  {name}
                </span>
                <Badge variant="outline" className="text-xs">
                  v{version}
                </Badge>
                {isCore && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Core
                  </Badge>
                )}
                {hasDependencyIssues && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Missing dependencies
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {featureId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {disabledReason && !isCore && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {disabledReason}
                </TooltipContent>
              </Tooltip>
            )}
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={isCore}
            />
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t space-y-3">
            {dependencies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Depends on:
                </p>
                <div className="flex flex-wrap gap-1">
                  {dependencies.map(depId => {
                    const depConfig = featureConfigs[depId];
                    const isEnabled = depConfig?.enabled !== false;
                    return (
                      <Badge 
                        key={depId} 
                        variant={isEnabled ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {isEnabled ? (
                          <Check className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        {depId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {dependents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Required by:
                </p>
                <div className="flex flex-wrap gap-1">
                  {dependents.map(depId => {
                    const depConfig = featureConfigs[depId];
                    const isEnabled = depConfig?.enabled !== false;
                    return (
                      <Badge 
                        key={depId} 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          !isEnabled && "opacity-50"
                        )}
                      >
                        {depId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {dependencies.length === 0 && dependents.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No dependencies
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Feature Dependency Graph Visualization
 */
function FeatureDependencyGraph() {
  const { getAllFeatures, featureConfigs } = useFeatureConfigStore();
  const features = getAllFeatures();

  const nodes = useMemo(() => {
    return features.map((f, index) => {
      const angle = (index / features.length) * 2 * Math.PI;
      const radius = 120;
      const config = featureConfigs[f.id];
      return {
        id: f.id,
        name: f.name,
        x: 150 + radius * Math.cos(angle - Math.PI / 2),
        y: 150 + radius * Math.sin(angle - Math.PI / 2),
        enabled: config?.enabled !== false,
        isCore: f.id === 'core',
      };
    });
  }, [features, featureConfigs]);

  const edges = useMemo(() => {
    const result: { from: string; to: string; fromNode: typeof nodes[0]; toNode: typeof nodes[0] }[] = [];
    
    for (const feature of features) {
      if (feature.dependencies) {
        for (const depId of feature.dependencies) {
          const fromNode = nodes.find(n => n.id === feature.id);
          const toNode = nodes.find(n => n.id === depId);
          if (fromNode && toNode) {
            result.push({ from: feature.id, to: depId, fromNode, toNode });
          }
        }
      }
    }
    
    return result;
  }, [features, nodes]);

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Dependency Graph</h4>
      </div>
      
      <div className="relative w-full aspect-square max-w-[300px] mx-auto">
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {/* Edges (arrows) */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                className="fill-muted-foreground"
              />
            </marker>
          </defs>
          
          {edges.map((edge, i) => {
            const dx = edge.toNode.x - edge.fromNode.x;
            const dy = edge.toNode.y - edge.fromNode.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nodeRadius = 24;
            
            // Shorten line to not overlap with nodes
            const startX = edge.fromNode.x + (dx / len) * nodeRadius;
            const startY = edge.fromNode.y + (dy / len) * nodeRadius;
            const endX = edge.toNode.x - (dx / len) * (nodeRadius + 8);
            const endY = edge.toNode.y - (dy / len) * (nodeRadius + 8);
            
            return (
              <line
                key={i}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                className="stroke-muted-foreground"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
                opacity={edge.fromNode.enabled && edge.toNode.enabled ? 1 : 0.3}
              />
            );
          })}
          
          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="24"
                className={cn(
                  "stroke-2",
                  node.enabled 
                    ? node.isCore 
                      ? "fill-primary/20 stroke-primary" 
                      : "fill-accent stroke-accent-foreground/30"
                    : "fill-muted stroke-muted-foreground/30"
                )}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  "text-[10px] font-medium pointer-events-none",
                  node.enabled ? "fill-foreground" : "fill-muted-foreground"
                )}
              >
                {node.id.slice(0, 5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />
          <span>Core</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent border-2 border-accent-foreground/30" />
          <span>Enabled</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-muted border-2 border-muted-foreground/30" />
          <span>Disabled</span>
        </div>
      </div>
    </div>
  );
}

export function FeatureConfigPanel() {
  const { 
    getAllFeatures, 
    featureConfigs,
    setFeatureEnabled, 
    getFeatureDependencies,
    getFeatureDependents,
    resetToDefaults,
    syncWithRegistry,
    isLoaded
  } = useFeatureConfigStore();

  useEffect(() => {
    syncWithRegistry();
  }, [syncWithRegistry]);

  const features = getAllFeatures();

  const handleToggle = useCallback(async (featureId: string, enabled: boolean) => {
    try {
      await setFeatureEnabled(featureId, enabled);
      toast.success(`Feature ${featureId} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} feature`);
    }
  }, [setFeatureEnabled]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    toast.success('All features reset to defaults');
  }, [resetToDefaults]);

  const enabledCount = useMemo(() => {
    return Object.values(featureConfigs).filter(c => c.enabled).length;
  }, [featureConfigs]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Feature Configuration
            </CardTitle>
            <CardDescription>
              Enable or disable application features. {enabledCount} of {features.length} features enabled.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dependency Graph */}
        <FeatureDependencyGraph />
        
        <Separator />
        
        {/* Feature List */}
        <div className="space-y-3">
          {features.map(feature => {
            const config = featureConfigs[feature.id];
            const isEnabled = config?.enabled !== false;
            
            return (
              <FeatureCard
                key={feature.id}
                featureId={feature.id}
                name={feature.name}
                version={feature.version}
                enabled={isEnabled}
                isCore={feature.id === 'core'}
                dependencies={getFeatureDependencies(feature.id)}
                dependents={getFeatureDependents(feature.id)}
                onToggle={(enabled) => handleToggle(feature.id, enabled)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
