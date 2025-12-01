import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings2,
  GitBranch,
  Link2,
  Tags,
  BarChart3,
  Palette,
  ChevronDown,
  RotateCcw,
  Network,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { LinkConfigState, LinkStats, LinkStyle } from "@/hooks/useLinkConfig";

interface LinkConfigPanelProps {
  config: LinkConfigState;
  stats: LinkStats;
  onConfigUpdate: (updates: Partial<LinkConfigState>) => void;
  onStyleUpdate: (linkType: keyof LinkConfigState["styles"], updates: Partial<LinkStyle>) => void;
  onReset: () => void;
  onNodeSelect?: (nodeId: string) => void;
}

const LINK_TYPE_INFO = {
  hierarchy: {
    label: "Hierarchy",
    description: "Parent-child folder structure",
    icon: GitBranch,
  },
  backlink: {
    label: "Backlinks",
    description: "Wikilink connections between notes",
    icon: Link2,
  },
  tag: {
    label: "Tags",
    description: "Shared tag connections",
    icon: Tags,
  },
  semantic: {
    label: "Semantic",
    description: "AI-detected relationships",
    icon: Network,
  },
};

const LINE_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

const COLOR_PRESETS = [
  { value: "hsl(var(--primary))", label: "Primary", className: "bg-primary" },
  { value: "hsl(var(--accent))", label: "Accent", className: "bg-accent" },
  { value: "hsl(var(--secondary))", label: "Secondary", className: "bg-secondary" },
  { value: "hsl(var(--muted-foreground))", label: "Muted", className: "bg-muted-foreground" },
  { value: "hsl(var(--destructive))", label: "Red", className: "bg-destructive" },
  { value: "hsl(142 76% 36%)", label: "Green", className: "bg-green-600" },
  { value: "hsl(200 98% 39%)", label: "Blue", className: "bg-blue-600" },
  { value: "hsl(38 92% 50%)", label: "Orange", className: "bg-orange-500" },
];

export function LinkConfigPanel({
  config,
  stats,
  onConfigUpdate,
  onStyleUpdate,
  onReset,
  onNodeSelect,
}: LinkConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(true);
  const [stylingOpen, setStylingOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="shadow-lg gap-2">
          <Settings2 className="w-4 h-4" />
          Link Config
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
            {stats.totalCount}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[480px] p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                Links Configuration
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Topology Control Section */}
              <Collapsible open={topologyOpen} onOpenChange={setTopologyOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Topology Control</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${topologyOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Hierarchy Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="font-medium">Hierarchical Links</Label>
                        <p className="text-xs text-muted-foreground">Parent-child folder structure</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.showHierarchy}
                      onCheckedChange={(checked) => onConfigUpdate({ showHierarchy: checked })}
                    />
                  </div>

                  {/* Backlinks Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="font-medium">Backlink Connections</Label>
                        <p className="text-xs text-muted-foreground">Wikilinks between notes</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.showBacklinks}
                      onCheckedChange={(checked) => onConfigUpdate({ showBacklinks: checked })}
                    />
                  </div>

                  {/* Tags Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <Tags className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="font-medium">Tag-Based Edges</Label>
                        <p className="text-xs text-muted-foreground">Connect notes sharing tags</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.showTags}
                      onCheckedChange={(checked) => onConfigUpdate({ showTags: checked })}
                    />
                  </div>

                  {/* Tag Threshold Slider */}
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-medium">Tag Threshold</Label>
                      <Badge variant="outline" className="font-mono">
                        {config.tagThreshold} {config.tagThreshold === 1 ? "tag" : "tags"}
                      </Badge>
                    </div>
                    <Slider
                      value={[config.tagThreshold]}
                      onValueChange={([value]) => onConfigUpdate({ tagThreshold: value })}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Minimum shared tags required to create a connection
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Visual Styling Section */}
              <Collapsible open={stylingOpen} onOpenChange={setStylingOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Visual Styling</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${stylingOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {(["hierarchy", "backlink", "tag"] as const).map((linkType) => {
                    const info = LINK_TYPE_INFO[linkType];
                    const style = config.styles[linkType];
                    const Icon = info.icon;

                    return (
                      <div key={linkType} className="p-3 rounded-lg bg-card border border-border space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <Label className="font-medium">{info.label}</Label>
                        </div>

                        {/* Color Selection */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Color</Label>
                          <div className="flex gap-2 flex-wrap">
                            {COLOR_PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                onClick={() => onStyleUpdate(linkType, { color: preset.value })}
                                className={`w-6 h-6 rounded-full ${preset.className} border-2 transition-all ${
                                  style.color === preset.value
                                    ? "border-foreground scale-110"
                                    : "border-transparent hover:scale-105"
                                }`}
                                title={preset.label}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Line Style */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Line Style</Label>
                          <Select
                            value={style.lineStyle}
                            onValueChange={(value: "solid" | "dashed" | "dotted") =>
                              onStyleUpdate(linkType, { lineStyle: value })
                            }
                          >
                            <SelectTrigger className="w-full h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LINE_STYLES.map((ls) => (
                                <SelectItem key={ls.value} value={ls.value}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-8 h-0.5 bg-foreground"
                                      style={{
                                        borderBottom: `2px ${ls.value} currentColor`,
                                        background: "none",
                                      }}
                                    />
                                    {ls.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Opacity & Width */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Opacity ({Math.round(style.opacity * 100)}%)
                            </Label>
                            <Slider
                              value={[style.opacity]}
                              onValueChange={([value]) => onStyleUpdate(linkType, { opacity: value })}
                              min={0.1}
                              max={1}
                              step={0.1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Width ({style.width}px)
                            </Label>
                            <Slider
                              value={[style.width]}
                              onValueChange={([value]) => onStyleUpdate(linkType, { width: value })}
                              min={0.5}
                              max={5}
                              step={0.5}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Network Analytics Section */}
              <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Graph Metrics</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${analyticsOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Link Type Tally */}
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <Label className="font-medium mb-3 block">Link Type Summary</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-3 h-3 text-primary" />
                          <span className="text-sm">Hierarchy</span>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {stats.hierarchyCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3 h-3 text-accent" />
                          <span className="text-sm">Backlinks</span>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {stats.backlinkCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <Tags className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">Tags</span>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {stats.tagCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                        <div className="flex items-center gap-2">
                          <Network className="w-3 h-3 text-primary" />
                          <span className="text-sm font-medium">Total</span>
                        </div>
                        <Badge variant="default" className="font-mono">
                          {stats.totalCount}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Top Hubs */}
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <Label className="font-medium mb-3 block">Top Hubs Analysis</Label>
                    {stats.topHubs.length > 0 ? (
                      <div className="space-y-2">
                        {stats.topHubs.map((hub, index) => (
                          <button
                            key={hub.nodeId}
                            onClick={() => onNodeSelect?.(hub.nodeId)}
                            className="w-full flex items-center justify-between p-2 rounded bg-secondary/50 hover:bg-secondary/80 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-muted-foreground w-4">
                                #{index + 1}
                              </span>
                              <span className="text-sm truncate">{hub.nodeName}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowDownToLine className="w-3 h-3" />
                                <span>{hub.inDegree}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowUpFromLine className="w-3 h-3" />
                                <span>{hub.outDegree}</span>
                              </div>
                              <Badge variant="outline" className="font-mono text-xs">
                                {hub.connectionCount}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No connections yet
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
