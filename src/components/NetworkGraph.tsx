import { useRef, useState, useCallback, useEffect } from "react";
// @ts-ignore - react-force-graph-2d types
import ForceGraph2D from "react-force-graph-2d";
import { Button } from "@/components/ui/button";
import { Plus, Search, Link2, FolderPlus, FilePlus, Filter, Download, Upload, Network, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { downloadZip } from "@/lib/graphExport";
import { importGraphFromZip } from "@/lib/graphImport";
import { LinkManager } from "@/components/LinkManager";
import { DynamicLinkManager } from "@/components/DynamicLinkManager";
import { useTheme } from "@/hooks/useTheme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file";
  parentId: string | null;
  depth: number;
  tags: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: "hierarchy" | "tag" | "backlink" | "semantic" | "custom";
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface LinkStyle {
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  width: number;
}

interface LinkStyles {
  hierarchy: LinkStyle;
  backlink: LinkStyle;
  tag: LinkStyle;
  semantic: LinkStyle;
  custom?: LinkStyle;
}

interface NetworkGraphProps {
  onNodeSelect: (node: Node | null) => void;
  selectedNode: Node | null;
  graphData: GraphData;
  setGraphData: (data: GraphData) => void;
  linkStyles?: LinkStyles;
}

export const NetworkGraph = ({ onNodeSelect, selectedNode, graphData, setGraphData, linkStyles }: NetworkGraphProps) => {
  const graphRef = useRef<any>();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState<number>(10);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [contentFilter, setContentFilter] = useState<string>("");
  const [linkManagerOpen, setLinkManagerOpen] = useState(false);
  const [dynamicLinkManagerOpen, setDynamicLinkManagerOpen] = useState(false);
  const [graphKey, setGraphKey] = useState(0);

  // Force graph re-render when theme changes
  useEffect(() => {
    setGraphKey(prev => prev + 1);
  }, [
    theme.colors.canvasBackground,
    theme.colors.folderNodeColor,
    theme.colors.fileNodeColor,
    theme.colors.linkColor,
    theme.colors.nodeGlow,
    theme.colors.accent,
  ]);

  // Apply physics settings to the graph
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;
      
      // Access the d3 simulation and update forces dynamically
      if (fg.d3Force) {
        fg.d3Force('charge')?.strength(theme.physics.chargeStrength);
        fg.d3Force('link')?.distance(theme.physics.linkDistance);
      }
      
      // Reheat the simulation when physics change
      if (fg.d3ReheatSimulation) {
        fg.d3ReheatSimulation();
      }
    }
  }, [theme.physics.chargeStrength, theme.physics.linkDistance, theme.physics.velocityDecay, theme.physics.alphaDecay]);

  const handleNodeClick = useCallback((node: Node) => {
    if (linkMode) {
      if (!linkSource) {
        setLinkSource(node.id);
        toast.info(`Select target node to link with "${node.name}"`);
      } else if (linkSource !== node.id) {
        const newLink: Link = {
          source: linkSource,
          target: node.id,
        };
        setGraphData({
          ...graphData,
          links: [...graphData.links, newLink],
        });
        toast.success("Nodes linked!");
        setLinkMode(false);
        setLinkSource(null);
      }
    } else {
      onNodeSelect(node);
    }
  }, [linkMode, linkSource, graphData, setGraphData, onNodeSelect]);

  const calculateDepth = (nodeId: string, nodes: Node[]): number => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) return 0;
    return 1 + calculateDepth(node.parentId, nodes);
  };

  const addNode = (type: "folder" | "file") => {
    // Only folders can have children - enforce this rule
    const parentNode = selectedNode && selectedNode.type === "folder" ? selectedNode : null;
    
    if (selectedNode && selectedNode.type === "file") {
      toast.error("Files cannot contain children. Please select a folder or create at root level.");
      return;
    }
    
    const depth = parentNode ? parentNode.depth + 1 : 0;
    
    const newNode: Node = {
      id: `node-${Date.now()}`,
      name: type === "folder" ? `New Folder ${graphData.nodes.filter(n => n.type === "folder").length + 1}` : `New File ${graphData.nodes.filter(n => n.type === "file").length + 1}`,
      content: "",
      type,
      parentId: parentNode?.id || null,
      depth,
      tags: [],
    };

    const newLinks = parentNode ? [{ source: parentNode.id, target: newNode.id }] : [];

    setGraphData({
      nodes: [...graphData.nodes, newNode],
      links: [...graphData.links, ...newLinks],
    });
    toast.success(`${type === "folder" ? "Folder" : "File"} created!`);
    onNodeSelect(newNode);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    const toastId = toast.loading("Preparing export...");
    
    try {
      await downloadZip(graphData, 'knowledge-graph');
      toast.success("Vault exported successfully!", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export vault";
      toast.error(message, { id: toastId });
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    const toastId = toast.loading("Importing vault...");

    try {
      // Atomic import - validate first, then apply
      const importedData = await importGraphFromZip(file);
      
      // Validation passed, now apply the data atomically
      setGraphData(importedData);
      onNodeSelect(null);
      
      toast.success(
        `Vault imported! ${importedData.nodes.length} nodes, ${importedData.links.length} connections`,
        { id: toastId }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import vault";
      toast.error(message, { id: toastId });
      console.error(error);
    } finally {
      setIsImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleAutoLink = () => {
    const newLinks: Link[] = [];
    const existingLinksSet = new Set(
      graphData.links.map(link => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        return `${sourceId}-${targetId}`;
      })
    );

    // Create hierarchy links based on parent-child relationships
    graphData.nodes.forEach(node => {
      if (node.parentId) {
        const linkKey = `${node.parentId}-${node.id}`;
        if (!existingLinksSet.has(linkKey)) {
          newLinks.push({
            source: node.parentId,
            target: node.id,
          });
        }
      }
    });

    if (newLinks.length > 0) {
      setGraphData({
        ...graphData,
        links: [...graphData.links, ...newLinks],
      });
      toast.success(`Auto-linked ${newLinks.length} node(s) based on hierarchy`);
    } else {
      toast.info("All nodes are already properly linked");
    }
  };

  const handleUpdateLinks = (updatedLinks: Link[]) => {
    setGraphData({
      ...graphData,
      links: updatedLinks,
    });
  };

  const filteredData = {
    nodes: graphData.nodes.filter(node => {
      // Depth filter
      if (node.depth > maxDepth) return false;
      
      // Search query (name)
      if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Content filter
      if (contentFilter && !node.content.toLowerCase().includes(contentFilter.toLowerCase())) {
        return false;
      }
      
      // Tag filter
      if (tagFilter && !node.tags.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()))) {
        return false;
      }
      
      return true;
    }),
    links: graphData.links.filter(link => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      const sourceInFiltered = graphData.nodes.find(n => n.id === sourceId && n.depth <= maxDepth);
      const targetInFiltered = graphData.nodes.find(n => n.id === targetId && n.depth <= maxDepth);
      return sourceInFiltered && targetInFiltered;
    }),
  };

  const activeFilters = [
    maxDepth < 10 && `Depth ≤ ${maxDepth}`,
    contentFilter && `Content: "${contentFilter}"`,
    tagFilter && `Tag: "${tagFilter}"`,
  ].filter(Boolean);

  return (
    <div className="relative w-full h-screen bg-graph-bg">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => addNode("folder")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Add Folder
          </Button>
          <Button
            onClick={() => addNode("file")}
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg"
          >
            <FilePlus className="w-4 h-4 mr-2" />
            Add File
          </Button>
          <Button
            onClick={() => {
              setLinkMode(!linkMode);
              setLinkSource(null);
            }}
            variant={linkMode ? "default" : "secondary"}
            className={linkMode ? "bg-accent hover:bg-accent/90" : ""}
          >
            <Link2 className="w-4 h-4 mr-2" />
            {linkMode ? "Cancel" : "Link"}
          </Button>
          
          <Button
            onClick={handleExport}
            variant="secondary"
            className="shadow-lg"
            disabled={isExporting || graphData.nodes.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export Vault"}
          </Button>
          
          <Button
            onClick={() => document.getElementById('graph-import')?.click()}
            variant="secondary"
            className="shadow-lg"
            disabled={isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? "Importing..." : "Import Vault"}
          </Button>
          <input
            id="graph-import"
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />
          
          <Sheet open={linkManagerOpen} onOpenChange={setLinkManagerOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" className="shadow-lg relative">
                <Network className="w-4 h-4 mr-2" />
                Links
                <Badge variant="default" className="ml-2 px-1.5 py-0 text-xs">
                  {graphData.links.length}
                </Badge>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
              <div className="h-full flex flex-col">
                <SheetHeader className="p-6 pb-4">
                  <SheetTitle>Link Management</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-hidden px-6 pb-6">
                  <LinkManager
                    nodes={graphData.nodes}
                    links={graphData.links}
                    onUpdateLinks={handleUpdateLinks}
                    onAutoLink={handleAutoLink}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={dynamicLinkManagerOpen} onOpenChange={setDynamicLinkManagerOpen}>
            <SheetTrigger asChild>
              <Button variant="default" className="shadow-lg bg-gradient-to-r from-primary to-accent">
                <Sparkles className="w-4 h-4 mr-2" />
                Dynamic Links
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader className="pb-4">
                <SheetTitle>Dynamic Link Layers</SheetTitle>
              </SheetHeader>
              <DynamicLinkManager
                nodes={graphData.nodes}
                baseLinks={graphData.links}
                onLinksUpdate={handleUpdateLinks}
              />
            </SheetContent>
          </Sheet>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilters.length > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card border-border" align="start">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Max Depth Level</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[maxDepth]}
                      onValueChange={(value) => setMaxDepth(value[0])}
                      max={10}
                      min={0}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-8 text-center">{maxDepth}</span>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Filter by Content</Label>
                  <Input
                    placeholder="Search in content..."
                    value={contentFilter}
                    onChange={(e) => setContentFilter(e.target.value)}
                    className="mt-2 bg-secondary border-border"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Filter by Tags</Label>
                  <Input
                    placeholder="Search tags..."
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="mt-2 bg-secondary border-border"
                  />
                </div>

                {activeFilters.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMaxDepth(10);
                      setContentFilter("");
                      setTagFilter("");
                    }}
                    className="w-full"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeFilters.map((filter, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {filter}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {linkMode && (
        <div className="absolute top-4 right-4 z-10 bg-accent/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-border">
          <p className="text-sm text-accent-foreground">
            {linkSource ? "Click target node" : "Click source node"}
          </p>
        </div>
      )}

      <ForceGraph2D
        key={graphKey}
        ref={graphRef}
        graphData={filteredData}
        nodeLabel={(node: any) => `${node.type === "folder" ? "📁" : "📄"} ${node.name} (depth: ${node.depth})`}
        nodeColor={(node: any) => {
          if (selectedNode?.id === node.id) return `hsl(${theme.colors.accent})`;
          return node.type === "folder" ? `hsl(${theme.colors.folderNodeColor})` : `hsl(${theme.colors.fileNodeColor})`;
        }}
        nodeRelSize={10}
        linkColor={(link: any) => {
          const linkType = link.type as keyof typeof linkStyles | undefined;
          if (linkStyles && linkType && linkStyles[linkType]) {
            const style = linkStyles[linkType];
            // Return color with opacity
            return style.color.replace(')', ` / ${style.opacity})`).replace('hsl(', 'hsla(');
          }
          // Fallback colors
          switch (linkType) {
            case "hierarchy":
              return `hsla(var(--primary) / 0.6)`;
            case "tag":
              return `hsla(var(--accent) / 0.6)`;
            case "backlink":
              return `hsla(var(--secondary) / 0.6)`;
            case "custom":
              return `hsla(var(--destructive) / 0.6)`;
            default:
              return `hsl(${theme.colors.linkColor} / 0.4)`;
          }
        }}
        linkWidth={(link: any) => {
          const linkType = link.type as keyof typeof linkStyles | undefined;
          if (linkStyles && linkType && linkStyles[linkType]) {
            return linkStyles[linkType].width;
          }
          return link.type ? 2.5 : 2;
        }}
        linkLineDash={(link: any) => {
          const linkType = link.type as keyof typeof linkStyles | undefined;
          if (linkStyles && linkType && linkStyles[linkType]) {
            const style = linkStyles[linkType];
            switch (style.lineStyle) {
              case "dashed":
                return [8, 4];
              case "dotted":
                return [2, 3];
              default:
                return [];
            }
          }
          // Default line dashes based on type
          switch (linkType) {
            case "backlink":
              return [8, 4];
            case "tag":
              return [2, 3];
            default:
              return [];
          }
        }}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          const iconSize = 14 / globalScale;
          const isFolder = node.type === "folder";
          ctx.font = `${fontSize}px Inter, sans-serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth + iconSize + 6, fontSize + 2];

          // Draw node circle with glow
          const nodeSize = isFolder ? 10 : 8;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
          
          if (selectedNode?.id === node.id) {
            ctx.fillStyle = `hsl(${theme.colors.accent})`;
          } else {
            ctx.fillStyle = isFolder ? `hsl(${theme.colors.folderNodeColor})` : `hsl(${theme.colors.fileNodeColor})`;
          }
          
          ctx.shadowBlur = 10;
          ctx.shadowColor = isFolder 
            ? `hsl(${theme.colors.folderNodeColor} / 0.8)` 
            : `hsl(${theme.colors.nodeGlow} / 0.8)`;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Draw label background
          ctx.fillStyle = "hsl(var(--card) / 0.95)";
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y + 14,
            bckgDimensions[0],
            bckgDimensions[1]
          );

          // Draw icon and label text
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "hsl(var(--card-foreground))";
          
          const icon = isFolder ? "📁" : "📄";
          ctx.fillText(icon, node.x - bckgDimensions[0] / 2 + 2, node.y + 15 + fontSize / 2);
          ctx.fillText(label, node.x - bckgDimensions[0] / 2 + iconSize + 4, node.y + 15 + fontSize / 2);
        }}
        backgroundColor={`hsl(${theme.colors.canvasBackground})`}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={100}
        d3AlphaDecay={theme.physics.alphaDecay}
        d3VelocityDecay={theme.physics.velocityDecay}
        warmupTicks={100}
      />
    </div>
  );
};