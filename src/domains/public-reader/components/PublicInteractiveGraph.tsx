// src/domains/public-reader/components/PublicInteractiveGraph.tsx
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { GraphCanvas, type GraphCanvasHandle } from "@/domains/graph/components/GraphCanvas";
import { defaultGraphConfig, type GraphConfigState } from "@/domains/graph/shared/stores/useGraphStore";
import { useGraphInteractionStore } from "@/domains/graph/shared/stores/useGraphInteractionStore";
import type { LayoutMode } from "@/domains/graph/shared/utils/graph.types";
import type { GraphData, Node, Link as GraphLink } from "@/shared/stores/types";
import type { NoteRecord } from "@/types/collaboration";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { PublicGraphSettingsPopover } from "@/domains/public-reader/components/PublicGraphSettingsPopover";
import { PublicNodePreviewDrawer } from "@/domains/public-reader/components/PublicNodePreviewDrawer";
import {
  Search,
  Compass,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  Scan,
  Download,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface PublicInteractiveGraphProps {
  graphData: GraphData;
  publishedNotes: NoteRecord[];
  onOpenArticle: (note: NoteRecord) => void;
  vaultName: string;
}

export const PublicInteractiveGraph: React.FC<PublicInteractiveGraphProps> = ({
  graphData,
  publishedNotes,
  onOpenArticle,
  vaultName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

  // State Konfigurasi Graf Publik
  const [localGraphConfig, setLocalGraphConfig] = useState<GraphConfigState>(() => ({
    ...defaultGraphConfig,
    nodes: {
      ...defaultGraphConfig.nodes,
      showLabels: true,
      labelSize: 12,
      labelBox: true,
      showFileNodes: true,
      showFolderNodes: true,
      fileColor: "#3b82f6",
      folderColor: "#eab308",
    },
    forces: {
      ...defaultGraphConfig.forces,
      linkDistance: 85,
      chargeStrength: -180,
    },
  }));

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNeighborhoodFocusActive, setIsNeighborhoodFocusActive] = useState(true);

  // Layout mode
  const currentLayout = useGraphInteractionStore((s) => s.layoutMode);
  const setLayoutMode = useGraphInteractionStore((s) => s.setLayoutMode);

  // Map slug & id
  const slugToNoteMap = useMemo(() => {
    const map = new Map<string, NoteRecord>();
    for (const note of publishedNotes) {
      map.set(note.slug, note);
      map.set(note.id, note);
    }
    return map;
  }, [publishedNotes]);

  // Dynamic Degree Centrality: Hitung bobot koneksi untuk setiap node
  const degreeMap = useMemo(() => {
    const degrees = new Map<string, number>();
    for (const link of graphData.links) {
      const sId = typeof link.source === "object" ? (link.source as any).id : link.source;
      const tId = typeof link.target === "object" ? (link.target as any).id : link.target;
      degrees.set(sId, (degrees.get(sId) || 0) + 1);
      degrees.set(tId, (degrees.get(tId) || 0) + 1);
    }
    return degrees;
  }, [graphData.links]);

  // Himpunan tetangga (1-Hop Neighbors) untuk efek Focus Dimming
  const neighborNodeIds = useMemo(() => {
    if (!selectedNode || !isNeighborhoodFocusActive) return null;
    const neighbors = new Set<string>();
    neighbors.add(selectedNode.id);

    for (const link of graphData.links) {
      const sId = typeof link.source === "object" ? (link.source as any).id : link.source;
      const tId = typeof link.target === "object" ? (link.target as any).id : link.target;
      if (sId === selectedNode.id) neighbors.add(tId);
      if (tId === selectedNode.id) neighbors.add(sId);
    }
    return neighbors;
  }, [selectedNode, isNeighborhoodFocusActive, graphData.links]);

  // Graf dengan penyesuaian bobot & filter tetangga
  const enhancedGraphData = useMemo<GraphData>(() => {
    return {
      nodes: graphData.nodes.map((node) => {
        const degree = degreeMap.get(node.id) || 0;
        const isDimmed = neighborNodeIds ? !neighborNodeIds.has(node.id) : false;

        return {
          ...node,
          // Proporsi ukuran node dinamis berdasarkan derajat relasi
          val: Math.max(3, Math.min(16, 4 + degree * 1.5)),
          dimmed: isDimmed,
        } as Node;
      }),
      links: graphData.links.map((link) => {
        const sId = typeof link.source === "object" ? (link.source as any).id : link.source;
        const tId = typeof link.target === "object" ? (link.target as any).id : link.target;
        const isConnected =
          !neighborNodeIds || (neighborNodeIds.has(sId) && neighborNodeIds.has(tId));

        return {
          ...link,
          dimmed: !isConnected,
        } as GraphLink;
      }),
    };
  }, [graphData, degreeMap, neighborNodeIds]);

  // Handler Pemilihan Node (Membuka Side Peek Drawer)
  const handleNodeSelect = (node: Node | null) => {
    setSelectedNode(node);
  };

  // Navigasi Traversal dari dalam Drawer ke node relasi
  const handleTraverseToSlug = (targetSlug: string) => {
    const targetNote = slugToNoteMap.get(targetSlug);
    if (targetNote) {
      const targetNode = graphData.nodes.find((n) => n.id === targetNote.id);
      if (targetNode) {
        setSelectedNode(targetNode);
        graphCanvasRef.current?.smartZoom("selection");
      }
    }
  };

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }));
    }
  };

  const handleZoomOut = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true }));
    }
  };

  // Toggle Layar Penuh (Fullscreen)
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // 1-Click Snapshot Export (Unduh Gambar PNG Kanvas)
  const handleExportSnapshot = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("Kanvas graf tidak ditemukan.");
      return;
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      const safeVaultName = vaultName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      downloadLink.download = `${safeVaultName}-graph-snapshot.png`;
      downloadLink.href = dataUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      toast.success("Snapshot graf berhasil diunduh!");
    } catch (err) {
      toast.error("Gagal mengekspor snapshot graf.");
    }
  }, [vaultName]);

  const activeNoteRecord = selectedNode ? slugToNoteMap.get(selectedNode.id) || null : null;

  return (
    <TooltipProvider delayDuration={250}>
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-0 overflow-hidden bg-background select-none flex flex-col"
      >
        {/* 1. TOP BAR: Search & Status Pill */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
          {/* Live Search Input */}
          <div className="pointer-events-auto relative w-64 sm:w-72 shadow-md rounded-xl">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari ide & catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-background/90 backdrop-blur-md border-border/80 rounded-xl"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Info Pill */}
          <div className="pointer-events-auto hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border/80 text-xs text-muted-foreground shadow-sm">
            <Compass className="w-3.5 h-3.5 text-primary" />
            <span>{graphData.nodes.length} Catatan</span>
            <span className="opacity-40">•</span>
            <span>{graphData.links.length} Relasi</span>
          </div>
        </div>

        {/* 2. FLOATING ACTION DOCK (Kanan Bawah) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="flex flex-col items-center p-1 rounded-xl border border-border/80 bg-background/90 backdrop-blur-md shadow-lg space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Perbesar (+)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Perkecil (-)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => graphCanvasRef.current?.smartZoom("fit")}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Scan className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Pusatkan Seluruh Graf</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFullscreen}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportSnapshot}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Unduh Gambar Snapshot (PNG)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* 3. SETTINGS GEAR WIDGET (Kiri Bawah) */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
          <PublicGraphSettingsPopover
            config={localGraphConfig}
            onConfigChange={setLocalGraphConfig}
            currentLayout={currentLayout}
            onLayoutChange={setLayoutMode}
            onResetDefaults={() => {
              setLocalGraphConfig(defaultGraphConfig);
              setLayoutMode("free-force");
              graphCanvasRef.current?.smartZoom("fit");
            }}
            onFitCamera={() => graphCanvasRef.current?.smartZoom("fit")}
          />
        </div>

        {/* 4. SIDE PEEK / BOTTOM SHEET DRAWER */}
        <PublicNodePreviewDrawer
          selectedNode={selectedNode}
          activeNoteRecord={activeNoteRecord}
          allNotes={publishedNotes}
          graphLinks={graphData.links}
          onClose={() => setSelectedNode(null)}
          onNavigateToNode={handleTraverseToSlug}
          onReadFullArticle={onOpenArticle}
        />

        {/* 5. CANVAS CORE (Full Bleed) */}
        <div className="flex-1 w-full h-full min-h-0">
          <GraphCanvas
            ref={graphCanvasRef}
            graphData={enhancedGraphData}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeSelect}
            onNodeOpen={handleNodeSelect}
            graphConfig={localGraphConfig}
            search={searchTerm}
            minDepth={0}
            maxDepth={10}
            contentFilter=""
            tagFilter=""
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PublicInteractiveGraph;