/**
 * GraphConfigPanel - Advanced Network Graph Configuration
 * 
 * Centralized tabbed configuration panel for react-force-graph
 * supporting 2D/3D mode switching and real-time visual/physics tuning
 */

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings2,
  Circle,
  Link2,
  Zap,
  RotateCcw,
  Box,
  Square,
} from 'lucide-react';
import { GraphConfigState, NodeConfig, LinkConfig, ForceConfig } from '@/hooks/useGraphConfig';
import { NodeStylingTab } from './NodeStylingTab';
import { LinkStylingTab } from './LinkStylingTab';
import { ForceEngineTab } from './ForceEngineTab';

interface GraphConfigPanelProps {
  config: GraphConfigState;
  onDimensionsChange: (dims: 2 | 3) => void;
  onNodeConfigUpdate: (updates: Partial<NodeConfig>) => void;
  onLinkConfigUpdate: (updates: Partial<LinkConfig>) => void;
  onForceConfigUpdate: (updates: Partial<ForceConfig>) => void;
  onReset: () => void;
  onReheatSimulation: () => void;
  onStopSimulation: () => void;
}

export function GraphConfigPanel({
  config,
  onDimensionsChange,
  onNodeConfigUpdate,
  onLinkConfigUpdate,
  onForceConfigUpdate,
  onReset,
  onReheatSimulation,
  onStopSimulation,
}: GraphConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('nodes');

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="shadow-lg gap-2">
          <Settings2 className="w-4 h-4" />
          Graph Config
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
            {config.dimensions}D
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[520px] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                Graph Configuration
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset All
              </Button>
            </div>
            
            {/* Dimension Toggle */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground">Render Mode:</span>
              <div className="flex bg-secondary rounded-lg p-1">
                <Button
                  variant={config.dimensions === 2 ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 gap-1.5"
                  onClick={() => onDimensionsChange(2)}
                >
                  <Square className="w-3.5 h-3.5" />
                  2D
                </Button>
                <Button
                  variant={config.dimensions === 3 ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 gap-1.5"
                  onClick={() => onDimensionsChange(3)}
                >
                  <Box className="w-3.5 h-3.5" />
                  3D
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 px-6 pt-4">
              <TabsTrigger value="nodes" className="gap-1.5">
                <Circle className="w-3.5 h-3.5" />
                Nodes
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Links
              </TabsTrigger>
              <TabsTrigger value="forces" className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Forces
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="nodes" className="mt-0">
                  <NodeStylingTab
                    config={config.nodes}
                    is3D={config.dimensions === 3}
                    onUpdate={onNodeConfigUpdate}
                  />
                </TabsContent>
                
                <TabsContent value="links" className="mt-0">
                  <LinkStylingTab
                    config={config.links}
                    is3D={config.dimensions === 3}
                    onUpdate={onLinkConfigUpdate}
                  />
                </TabsContent>
                
                <TabsContent value="forces" className="mt-0">
                  <ForceEngineTab
                    config={config.forces}
                    onUpdate={onForceConfigUpdate}
                    onReheat={onReheatSimulation}
                    onStop={onStopSimulation}
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
