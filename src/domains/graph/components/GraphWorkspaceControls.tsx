import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Globe,
  Link2,
  Network,
  Palette,
  Search,
  Settings2,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import type { CanvasMode, LayoutMode, MindmapOrientation } from "@/domains/graph/shared/utils/graph.types";
import { useGraphStore } from "@/shared/stores";
import { useGraphInteractionStore } from "@/domains/graph/shared/stores/useGraphInteractionStore";
import {
  useLeafGraphConfig,
  useLeafGraphConfigApi,
  type LeafGraphConfigState,
} from "@/domains/graph/shared/stores/useLeafGraphConfigStore";
import type {
  GraphConfigState,
  NodeConfig,
  LinkConfig,
  TopologyConfig,
  LinkStyle,
  HierarchyColorConfig,
} from "@/domains/graph/shared/stores/useGraphStore";

import { FloatingZoomControls } from "@/domains/graph/components/GraphFloatingZoomControls";
import { SearchPanel } from "@/domains/graph/components/GraphSearchPanel";
import { LayoutPanel } from "@/domains/graph/components/GraphLayoutPanel";
import { AppearancePanel } from "@/domains/graph/components/GraphAppearancePanel";
import { GlobalTemplatesPanel } from "@/domains/graph/components/GraphGlobalTemplatesPanel";
import { ColorEngineControls } from "@/domains/graph/components/GraphColorEngineControls";
import { AtmosphereControls } from "@/domains/graph/components/GraphAtmosphereControls";
import { mergeAtmosphereConfig } from "@/domains/graph/shared/utils/atmosphereConfig";
import { useGraphToolbarStore } from "@/domains/graph/shared/stores/useGraphToolbarStore";

// =============================================================================
// 1. TYPES & NAVIGATION DEFINITIONS
// =============================================================================

export type SettingGroup = "search" | "layout" | "colors" | "atmosphere" | "appearance" | "global";
export type SmartZoomAction = "fit" | "selection" | "reset";
type LinkStyleType = keyof TopologyConfig["styles"];

const PANEL_TITLES: Record<SettingGroup, string> = {
  search: "Search & Filters",
  layout: "Layout & Hierarchy",
  colors: "Color Engine",
  atmosphere: "Atmosphere & Living Canvas",
  appearance: "Nodes & Links",
  global: "Graph Global & Templates",
};

interface NavItemConfig {
  id: SettingGroup;
  label: string;
  icon: LucideIcon;
  iconClassName?: string;
  badgeFilter?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: "search", label: "Search & Filters", icon: Search, badgeFilter: true },
  { id: "layout", label: "Layout & Hierarchy", icon: Network },
  { id: "colors", label: "Color Engine", icon: Palette, iconClassName: "text-primary" },
  {
    id: "atmosphere",
    label: "Atmosphere & Living Canvas",
    icon: Sparkles,
    iconClassName: "text-primary",
  },
  { id: "appearance", label: "Nodes & Links", icon: Link2 },
  { id: "global", label: "Graph Global & Templates", icon: Globe },
];

export interface GraphWorkspaceControlsProps {
  layout: LayoutMode;
  canvasMode?: CanvasMode;
  onCanvasModeChange?: (mode: CanvasMode) => void;
  onLayoutChange: (layout: LayoutMode) => void;
  orientation: MindmapOrientation;
  onOrientationChange: (orientation: MindmapOrientation) => void;
  collapsedCount: number;
  onExpandAll: () => void;
  focused: boolean;
  onClearFocus: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  minDepth: number;
  onMinDepthChange: (value: number) => void;
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
  contentFilter: string;
  onContentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  onSmartZoom: (action: SmartZoomAction) => void;
}

// =============================================================================
// 2. SUB-COMPONENT: CONTENT DISPATCHER (SHARED OLEH KEDUA MODE)
// =============================================================================

interface GraphSettingContentProps {
  activePanel: SettingGroup;
  config: GraphConfigState;
  layout: LayoutMode;
  canvasMode: CanvasMode;
  orientation: MindmapOrientation;
  compact?: boolean; 
  onCanvasModeChange: (mode: CanvasMode) => void;
  onLayoutChange: (layout: LayoutMode) => void;
  onOrientationChange: (orientation: MindmapOrientation) => void;
  search: string;
  onSearchChange: (value: string) => void;
  minDepth: number;
  onMinDepthChange: (value: number) => void;
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
  contentFilter: string;
  onContentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  updateNodeConfig: (upd: Partial<NodeConfig>) => void;
  updateLinkConfig: (upd: Partial<LinkConfig>) => void;
  updateTopologyConfig: (upd: Partial<TopologyConfig>) => void;
  updateTopologyStyle: (type: LinkStyleType, upd: Partial<LinkStyle>) => void;
  updateHierarchyConfig: (upd: Partial<HierarchyColorConfig>) => void;
  updateAtmosphereConfig: (upd: Partial<GraphConfigState["atmosphere"]>) => void;
  setConfig: (cfg: GraphConfigState) => void;
  resetConfig: () => void;
}

function GraphSettingContent(props: GraphSettingContentProps) {
  const {
    activePanel,
    compact = true,
    config,
    layout,
    canvasMode,
    orientation,
    onCanvasModeChange,
    onLayoutChange,
    onOrientationChange,
    search,
    onSearchChange,
    minDepth,
    onMinDepthChange,
    maxDepth,
    onMaxDepthChange,
    contentFilter,
    onContentFilterChange,
    tagFilter,
    onTagFilterChange,
    updateNodeConfig,
    updateLinkConfig,
    updateTopologyConfig,
    updateTopologyStyle,
    updateHierarchyConfig,
    updateAtmosphereConfig,
    setConfig,
    resetConfig,
  } = props;

    return (
    <>
      {activePanel === "search" && (
        <SearchPanel
          search={search}
          onSearchChange={onSearchChange}
          minDepth={minDepth}
          maxDepth={maxDepth}
          onMinDepthChange={onMinDepthChange}
          onMaxDepthChange={onMaxDepthChange}
          contentFilter={contentFilter}
          onContentFilterChange={onContentFilterChange}
          tagFilter={tagFilter}
          onTagFilterChange={onTagFilterChange}
        />
      )}

      {activePanel === "layout" && (
        <LayoutPanel
          compact={compact}
          canvasMode={canvasMode}
          layout={layout}
          orientation={orientation}
          onModeSwitch={onCanvasModeChange}
          onLayoutChange={onLayoutChange}
          onOrientationChange={onOrientationChange}
        />
      )}

      {activePanel === "colors" && (
        <div className="space-y-3.5">
          <ColorEngineControls
            compact={compact}
            hierarchy={config.hierarchy}
            nodeConfig={config.nodes}
            onHierarchyUpdate={updateHierarchyConfig}
            onNodeConfigUpdate={updateNodeConfig}
          />
        </div>
      )}

      {activePanel === "atmosphere" && (
        <AtmosphereControls
          atmosphere={mergeAtmosphereConfig(config.atmosphere)}
          linkConfig={config.links}
          nodeConfig={config.nodes}
          onAtmosphereUpdate={updateAtmosphereConfig}
          onLinkUpdate={updateLinkConfig}
          onNodeUpdate={updateNodeConfig}
        />
      )}

      {activePanel === "appearance" && (
        <AppearancePanel
          config={config}
          updateNodeConfig={updateNodeConfig}
          updateTopologyConfig={updateTopologyConfig}
          updateTopologyStyle={updateTopologyStyle}
          updateHierarchyConfig={updateHierarchyConfig}
          updateLinkConfig={updateLinkConfig}
        />
      )}

      {activePanel === "global" && (
        <GlobalTemplatesPanel
          config={config}
          layout={layout}
          orientation={orientation}
          onLayoutChange={onLayoutChange}
          onOrientationChange={onOrientationChange}
          setConfig={setConfig}
          resetConfig={resetConfig}
        />
      )}
    </>
  );
}


// =============================================================================
// 3. SUB-COMPONENT: HORIZONTAL EXPANDABLE OFFICE TOOLBAR (RESIZABLE & SMOOTH TABS)
// =============================================================================

interface HorizontalOfficeToolbarProps extends Omit<GraphSettingContentProps, "activePanel"> {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  activeTab: SettingGroup;
  onTabChange: (tab: SettingGroup) => void;
  filterCount: number;
}

function HorizontalOfficeToolbar({
  isExpanded,
  onToggleExpanded,
  activeTab,
  onTabChange,
  filterCount,
  ...contentProps
}: HorizontalOfficeToolbarProps) {
  // 1. STATE & REF RESIZE TINGGI TOOLBAR
  const [toolbarHeight, setToolbarHeight] = useState<number>(340);
  const isDraggingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(340);

  // 2. REF & HANDLER HORIZONTAL SCROLL UNTUK TABS
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Periksa apakah tab bar membutuhkan tombol panah scroll kiri/kanan
  const checkTabsScroll = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;
  }, []);

  useEffect(() => {
    checkTabsScroll();
    window.addEventListener("resize", checkTabsScroll);
    return () => window.removeEventListener("resize", checkTabsScroll);
  }, [checkTabsScroll, isExpanded]);

  // Otomatis geser ke tab aktif saat dipilih
  useEffect(() => {
    if (!tabsListRef.current) return;
    const activeEl = tabsListRef.current.querySelector('[data-state="active"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
    setTimeout(checkTabsScroll, 200);
  }, [activeTab, checkTabsScroll]);

  // Konversi mouse wheel vertikal menjadi horizontal scroll di tab bar
  const handleTabsWheel = (e: React.WheelEvent) => {
    if (!tabsListRef.current) return;
    if (e.deltaY !== 0) {
      tabsListRef.current.scrollLeft += e.deltaY;
      checkTabsScroll();
    }
  };

  const scrollTabs = (direction: "left" | "right") => {
    if (!tabsListRef.current) return;
    const offset = direction === "left" ? -180 : 180;
    tabsListRef.current.scrollBy({ left: offset, behavior: "smooth" });
    setTimeout(checkTabsScroll, 250);
  };

  // 3. LOGIKA RESIZE DRAG (MOUSE & TOUCH)
  const handleStartResize = (clientY: number) => {
    isDraggingRef.current = true;
    startYRef.current = clientY;
    startHeightRef.current = toolbarHeight;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    const onMove = (moveY: number) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveY; // drag ke atas = tambah tinggi
      const maxHeight = window.innerHeight * 0.85;
      const minHeight = 160;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY));
      setToolbarHeight(newHeight);
    };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientY);

    const handleEnd = () => {
      isDraggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
  };

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 flex flex-col w-full select-none">
      {/* 1. KETIKA EXPANDED: PANEL RESIZABLE DENGAN HEADER TABS */}
      {isExpanded && (
        <section
          aria-label="Graph Settings Ribbon"
          style={{ height: `${toolbarHeight}px` }}
          className="relative flex flex-col w-full border-t border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl animate-in fade-in-0 duration-150"
        >
          {/* A. DRAG RESIZE HANDLE DI TEPI ATAS PANEL */}
          <div
            role="separator"
            aria-orientation="horizontal"
            onMouseDown={(e) => handleStartResize(e.clientY)}
            onTouchStart={(e) => handleStartResize(e.touches[0].clientY)}
            className="group absolute -top-1.5 left-0 right-0 h-3 cursor-ns-resize z-40 flex items-center justify-center transition-all"
            title="Tarik ke atas atau ke bawah untuk mengatur tinggi toolbar"
          >
            <div className="h-1 w-14 rounded-full bg-border/80 group-hover:bg-primary group-hover:h-1.5 transition-all" />
          </div>

          {/* B. HEADER DENGAN TABS (BISA DIGESER DENGAN MOUSE/ARROW) */}
          <div className="h-10 shrink-0 border-b border-border/60 bg-muted/40 px-3">
            <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2">
              {/* Container Tabs dengan Scroll Controls */}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollTabs("left")}
                  className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Geser tab ke kiri"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <Tabs
                  value={activeTab}
                  onValueChange={(val) => onTabChange(val as SettingGroup)}
                  className="h-full flex-1 min-w-0 flex items-center"
                >
                  <TabsList
                    ref={tabsListRef}
                    onWheel={handleTabsWheel}
                    onScroll={checkTabsScroll}
                    className="h-7 w-full bg-muted/60 p-0.5 gap-0.5 overflow-x-auto flex items-center justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
                  >
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const hasFilterBadge = item.badgeFilter && filterCount > 0;
                      return (
                        <TabsTrigger
                          key={item.id}
                          value={item.id}
                          className="h-6 px-2.5 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-1.5 shrink-0 transition-colors"
                        >
                          <Icon className={cn("h-3 w-3", item.iconClassName)} />
                          <span>{item.label}</span>
                          {hasFilterBadge && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                <button
                  type="button"
                  onClick={() => scrollTabs("right")}
                  className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Geser tab ke kanan"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* C. TOMBOL COLLAPSE ATAS: SIMPLE, ELEGANT, TANPA FILL BOX HOVER */}
              <button
                type="button"
                onClick={onToggleExpanded}
                className="group flex items-center gap-1.5 text-[11px] font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1.5 py-0.5 shrink-0 bg-transparent ml-2"
                aria-label="Tutup Toolbar"
              >
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span>Toolbar</span>
              </button>
            </div>
          </div>

          {/* D. KONTEN PANEL (SCROLLABLE & TERPUSAT) */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.2)_transparent]">
            <div className="mx-auto max-w-6xl w-full">
              <GraphSettingContent activePanel={activeTab} {...contentProps} />
            </div>
          </div>
        </section>
      )}

      {/* 2. TRIGGER BAR DI ATAS FOOTER */}
      <div className="flex h-7 w-full items-center justify-between border-t border-border/60 bg-card/85 px-3 backdrop-blur-md transition-colors hover:bg-card/95">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="group flex items-center gap-1.5 text-[11px] font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1.5 py-0.5 bg-transparent"
          aria-label={isExpanded ? "Tutup toolbar" : "Buka toolbar graph"}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <span>Toolbar</span>
          {filterCount > 0 && (
            <span className="flex items-center justify-center rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-semibold text-primary-foreground">
              {filterCount}
            </span>
          )}
        </button>

        <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
          {isExpanded ? PANEL_TITLES[activeTab] : "Klik toolbar untuk konfigurasi graph"}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// 4. SUB-COMPONENT: GEAR OPTION BUTTON (FLOATING KANAN ATAS)
// =============================================================================

function ClassicGearControls({
  filterCount,
  activePanel,
  onToggleGear,
  isGearOpen,
  onSelectPanel,
  onClosePanel,
  ...contentProps
}: {
  filterCount: number;
  activePanel: SettingGroup | null;
  onToggleGear: () => void;
  isGearOpen: boolean;
  onSelectPanel: (panel: SettingGroup) => void;
  onClosePanel: () => void;
} & Omit<GraphSettingContentProps, "activePanel">) {
  return (
    // UBAH: Posisi di kanan atas (top-2 right-2 sm:top-4 sm:right-4)
    // UBAH: Gunakan flex-col items-end (BUKAN flex-col-reverse) agar panel muncul ke bawah
    <div className="pointer-events-none absolute top-3 right-3 z-40 flex flex-col items-end gap-1.5 sm:top-4 sm:right-4">
      {/* Baris Tombol Gear & Opsi Horizontal */}
      <div className="pointer-events-auto flex items-center rounded-lg border border-border/60 bg-card/90 p-1 shadow-md shadow-black/25 backdrop-blur-md transition-all">
        {/* Tombol-tombol Opsi mekar ke arah KIRI dari tombol Gear */}
        {isGearOpen && (
          <div className="mr-1 flex max-w-[calc(100vw-80px)] sm:max-w-[280px] items-center gap-1 overflow-x-auto overscroll-contain pr-1 border-r border-border/50 no-scrollbar animate-in fade-in-0 slide-in-from-right-2 duration-150">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              const hasActiveFilterBadge = item.badgeFilter && filterCount > 0;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isActive ? "secondary" : "ghost"}
                      size="icon"
                      className={cn(
                        "relative h-7 w-7 rounded-md shrink-0 transition-colors",
                        hasActiveFilterBadge && "text-primary",
                      )}
                      onClick={() => onSelectPanel(item.id)}
                      aria-label={item.label}
                    >
                      <Icon className={cn("h-3.5 w-3.5", item.iconClassName)} />
                      {hasActiveFilterBadge && (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Tombol Utama Gear (Ikon Settings2) di Ujung Kanan */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isGearOpen ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "relative h-7 w-7 rounded-md shrink-0 transition-transform duration-200",
                isGearOpen && "rotate-45",
              )}
              aria-label="Toggle Graph Settings Menu"
              onClick={onToggleGear}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {filterCount > 0 && !isGearOpen && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isGearOpen ? "Sembunyikan Pengaturan" : "Buka Pengaturan Graph"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Flyout Panel Pengaturan: Turun Vertikal ke Bawah & Scrollbar Modern */}
      {activePanel && (
        <section className="pointer-events-auto flex h-[min(340px,calc(100vh-140px))] w-[min(324px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-lg shadow-black/30 backdrop-blur-md animate-in fade-in-0 slide-in-from-top-2 duration-150">
          <header className="flex h-7 shrink-0 items-center justify-between border-b border-border/50 px-2.5 bg-muted/20">
            <span className="truncate text-[11px] font-medium text-foreground tracking-tight">
              {PANEL_TITLES[activePanel]}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Tutup panel pengaturan"
              onClick={onClosePanel}
            >
              <X className="h-3 w-3" />
            </Button>
          </header>

          {/* Area Konten: scrollbar-thin, bebas scrollbar horizontal */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
            <GraphSettingContent activePanel={activePanel} compact={true} {...contentProps} />
          </div>
        </section>
      )}
    </div>
  );
}

// =============================================================================
// 5. MAIN COMPONENT: GRAPH WORKSPACE CONTROLS
// =============================================================================

export function GraphWorkspaceControls({
  layout,
  canvasMode = "graph",
  onCanvasModeChange,
  onLayoutChange,
  orientation,
  onOrientationChange,
  collapsedCount,
  onExpandAll,
  focused,
  onClearFocus,
  search,
  onSearchChange,
  minDepth,
  onMinDepthChange,
  maxDepth,
  onMaxDepthChange,
  contentFilter,
  onContentFilterChange,
  tagFilter,
  onTagFilterChange,
  onSmartZoom,
}: GraphWorkspaceControlsProps) {
  // Mode dari Zustand store (Default: 'gear_button')
  const displayMode = useGraphToolbarStore((s) => s.mode);
  const isRibbonExpanded = useGraphToolbarStore((s) => s.isExpanded);
  const toggleRibbonExpanded = useGraphToolbarStore((s) => s.toggleExpanded);
  const ribbonActiveTab = useGraphToolbarStore((s) => s.activeTab);
  const setRibbonActiveTab = useGraphToolbarStore((s) => s.setActiveTab);

  // State lokal untuk mode gear klasik
  const [isGearOpen, setIsGearOpen] = useState(true);
  const [gearActivePanel, setGearActivePanel] = useState<SettingGroup | null>(null);

  const leafApi = useLeafGraphConfigApi();
  const setStoreCanvasMode = useGraphInteractionStore((s) => s.setCanvasMode);

  // Ambil config lokal jika ada di tab leaf, fallback ke global store
  const localConfig = useLeafGraphConfig((s) => s.config);
  const globalConfig = useGraphStore((s) => s.config);
  const config = localConfig ?? globalConfig;

  // Actions terisolasi per-tab (leaf store) dengan fallback ke global store
  const setConfig = leafApi
    ? (cfg: GraphConfigState) => leafApi.getState().setFullConfig(cfg)
    : (cfg: GraphConfigState) => useGraphStore.getState().setConfig(cfg);

  const updateNodeConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState["setNodeConfig"]>[0]) =>
        leafApi.getState().setNodeConfig(upd)
    : (upd: Partial<NodeConfig>) => useGraphStore.getState().updateNodeConfig(upd);

  const updateLinkConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState["setLinkConfig"]>[0]) =>
        leafApi.getState().setLinkConfig(upd)
    : (upd: Partial<LinkConfig>) => useGraphStore.getState().updateLinkConfig(upd);

  const updateTopologyConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState["setTopologyConfig"]>[0]) =>
        leafApi.getState().setTopologyConfig(upd)
    : (upd: Partial<TopologyConfig>) => useGraphStore.getState().updateTopologyConfig(upd);

  const updateTopologyStyle = (type: LinkStyleType, upd: Partial<LinkStyle>) => {
    if (leafApi) {
      leafApi.getState().setTopologyConfig((prev) => ({
        styles: { ...prev.styles, [type]: { ...prev.styles[type], ...upd } },
      }));
      return;
    }
    useGraphStore.getState().updateTopologyStyle(type, upd);
  };

  const updateHierarchyConfig = (upd: Partial<HierarchyColorConfig>) => {
    if (leafApi) {
      const prev = leafApi.getState().config.hierarchy;
      leafApi.getState().setHierarchyConfig({ ...prev, ...upd });
      return;
    }
    useGraphStore.getState().updateHierarchyConfig(upd);
  };

  const updateAtmosphereConfig = (updates: Partial<GraphConfigState["atmosphere"]>) => {
    if (leafApi) leafApi.getState().setAtmosphereConfig(updates);
    else useGraphStore.getState().updateAtmosphereConfig(updates);
  };

  const resetConfig = leafApi
    ? () => leafApi.getState().resetToDefault()
    : () => useGraphStore.getState().resetConfig();

  const handleModeSwitch = (mode: CanvasMode) => {
    if (onCanvasModeChange) {
      onCanvasModeChange(mode);
    } else {
      setStoreCanvasMode(mode);
    }
  };

  const filterCount =
    Number(minDepth > 0) +
    Number(maxDepth < 10) +
    Number(Boolean(search)) +
    Number(Boolean(contentFilter)) +
    Number(Boolean(tagFilter));

  const contentProps = {
    config,
    layout,
    canvasMode,
    orientation,
    onCanvasModeChange: handleModeSwitch,
    onLayoutChange,
    onOrientationChange,
    search,
    onSearchChange,
    minDepth,
    onMinDepthChange,
    maxDepth,
    onMaxDepthChange,
    contentFilter,
    onContentFilterChange,
    tagFilter,
    onTagFilterChange,
    updateNodeConfig,
    updateLinkConfig,
    updateTopologyConfig,
    updateTopologyStyle,
    updateHierarchyConfig,
    updateAtmosphereConfig,
    setConfig,
    resetConfig,
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* 1. KONTROL UTAMA: BERDASARKAN MODE (HORIZONTAL TOOLBAR ATAU GEAR) */}
      {displayMode === "horizontal_toolbar" ? (
        <HorizontalOfficeToolbar
          isExpanded={isRibbonExpanded}
          onToggleExpanded={toggleRibbonExpanded}
          activeTab={ribbonActiveTab}
          onTabChange={setRibbonActiveTab}
          filterCount={filterCount}
          {...contentProps}
        />
      ) : (
        <ClassicGearControls
          filterCount={filterCount}
          activePanel={gearActivePanel}
          onToggleGear={() => {
            setIsGearOpen((p) => !p);
            if (isGearOpen) setGearActivePanel(null);
          }}
          isGearOpen={isGearOpen}
          onSelectPanel={(panel) => setGearActivePanel((c) => (c === panel ? null : panel))}
          onClosePanel={() => setGearActivePanel(null)}
          {...contentProps}
        />
      )}
    </TooltipProvider>
  );
}
