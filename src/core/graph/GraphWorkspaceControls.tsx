import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Slider } from '@/shared/ui/slider-noinput';
import { Switch } from '@/shared/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/lib/cn';
import {
  BarChart3,
  Bookmark,
  Check,
  Circle,
  Clock3,
  Focus,
  Frame,
  GitBranch,
  Globe,
  Link2,
  Network,
  Move,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UnfoldVertical,
  X,
  Zap,
  Palette,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { CanvasMode, LayoutMode, MindmapOrientation } from './model/graphTypes';
import { useGraphStore } from '@/shared/stores';
import { useGraphInteractionStore } from './model/useGraphInteractionStore';
// Tambahkan import store, UI, dan toast berikut:
import { toast } from 'sonner';
import { Badge } from '@/shared/ui/badge';
import { useGraphTemplatesStore, type GraphTemplate } from '@/shared/stores/useGraphTemplatesStore';
import {
  useLeafGraphConfig,
  useLeafGraphConfigApi,
  type LeafGraphConfigState,
} from './model/useLeafGraphConfigStore';
import type {
  GraphConfigState,
  NodeConfig,
  LinkConfig,
  ForceConfig,
  TopologyConfig,
  LinkStyle,
  HierarchyColorConfig,
} from '@/shared/stores/useGraphStore';
import { useGraphEngineStore } from '@/shared/stores/useGraphEngineStore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { ColorPicker } from './config-panel/ColorPicker';
import {
  HierarchyColorControls,
  HierarchyLinkColorControls,
} from './config-panel/HierarchyColorControls';
import { ChevronRight } from 'lucide-react';
import { ColorEngineControls } from './config-panel/ColorEngineControls';
import { AtmosphereControls } from './config-panel/AtmosphereControls';
import { mergeAtmosphereConfig } from './model/atmosphereConfig';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

type SettingGroup = 'search' | 'layout' | 'colors' | 'atmosphere' | 'appearance' | 'global';

type LabelMode = 'nodes' | 'labels' | 'boxes';
type LinkStyleType = keyof TopologyConfig['styles'];

const LINK_STYLE_TYPES: { value: LinkStyleType; label: string }[] = [
  { value: 'hierarchy', label: 'Hierarchy' },
  { value: 'backlink', label: 'Backlinks' },
  { value: 'tag', label: 'Tags' },
  { value: 'semantic', label: 'Semantic' },
];

const LINE_STYLES: { value: LinkStyle['lineStyle']; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const LABEL_FIELDS: { value: NodeConfig['labelField']; label: string }[] = [
  { value: 'name', label: 'Node Name' },
  { value: 'id', label: 'Node ID' },
  { value: 'custom', label: 'Custom' },
];

const FONT_STYLES: { value: NodeConfig['labelFontStyle']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'bold-italic', label: 'Bold Italic' },
];

/** Collapsible sub-group inside a flyout panel. */
function PanelSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border border-border/60 bg-secondary/20"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
        <span>{title}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2.5 border-t border-border/50 px-2 py-2.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

const LABEL_MODES: { value: LabelMode; label: string }[] = [
  { value: 'nodes', label: 'Nodes' },
  { value: 'labels', label: '+ Labels' },
  { value: 'boxes', label: '+ Boxes' },
];

const GRAPH_LAYOUTS: { value: LayoutMode; label: string; icon: typeof Network }[] = [
  { value: 'free-force', label: 'Free force', icon: Network },
  { value: 'fr-standard', label: 'Spring (F-R)', icon: Sparkles },
  { value: 'fr-radial', label: 'Radial spread', icon: Circle },
  { value: 'kamada-kawai', label: 'Kamada-Kawai', icon: Zap },
  { value: 'grid', label: 'Grid', icon: SlidersHorizontal },
];

const MINDMAP_LAYOUTS: { value: LayoutMode; label: string; icon: typeof Network }[] = [
  { value: 'mindmap', label: 'Mindmap', icon: GitBranch },
  { value: 'org-chart', label: 'Org chart', icon: Network },
  { value: 'brace-map', label: 'Brace map', icon: SlidersHorizontal },
  { value: 'timeline', label: 'Timeline', icon: Clock3 },
  { value: 'fishbone', label: 'Fishbone', icon: GitBranch },
];

const NODE_SHAPES = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'hexagon', label: 'Hexagon' },
];

export type SmartZoomAction = 'fit' | 'selection' | 'reset';

interface GraphWorkspaceControlsProps {
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

export function GraphWorkspaceControls({
  layout,
  canvasMode = 'graph',
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

  // Handler untuk beralih canvas mode (mindmap vs graph)
  const handleModeSwitch = (mode: CanvasMode) => {
    if (onCanvasModeChange) {
      onCanvasModeChange(mode);
    } else {
      setStoreCanvasMode(mode);
    }
  };

  const layoutArrangement = useGraphInteractionStore((s) => s.layoutArrangement);
  const setLayoutArrangement = useGraphInteractionStore((s) => s.setLayoutArrangement);

  // Kontrol gear: toggle menu icon button ke bawah
  const [isGearOpen, setIsGearOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<SettingGroup | null>(null);
  const [appearanceTab, setAppearanceTab] = useState<'nodes' | 'links'>('nodes');
  const leafApi = useLeafGraphConfigApi();

  // Ambil config lokal jika ada di dalam tab, jika tidak gunakan global
  const localConfig = useLeafGraphConfig((s) => s.config);
  const globalConfig = useGraphStore((s) => s.config);
  const config = localConfig ?? globalConfig;

  // Actions terisolasi per-tab (leaf store) dengan fallback ke global store
  const setConfig = leafApi
    ? (cfg: GraphConfigState) => leafApi.getState().setFullConfig(cfg)
    : (cfg: GraphConfigState) => useGraphStore.getState().setConfig(cfg);
  const updateNodeConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState['setNodeConfig']>[0]) => leafApi.getState().setNodeConfig(upd)
    : (upd: Partial<NodeConfig>) => useGraphStore.getState().updateNodeConfig(upd);
  const updateLinkConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState['setLinkConfig']>[0]) => leafApi.getState().setLinkConfig(upd)
    : (upd: Partial<LinkConfig>) => useGraphStore.getState().updateLinkConfig(upd);
  const updateForceConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState['setForceConfig']>[0]) => leafApi.getState().setForceConfig(upd)
    : (upd: Partial<ForceConfig>) => useGraphStore.getState().updateForceConfig(upd);
  const updateTopologyConfig = leafApi
    ? (upd: Parameters<LeafGraphConfigState['setTopologyConfig']>[0]) =>
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
  const resetConfig = leafApi
    ? () => leafApi.getState().resetToDefault()
    : () => useGraphStore.getState().resetConfig();

  // Kamera & level-of-detail (engine store, dipakai langsung oleh canvas)
  const zoomOutRendering = useGraphEngineStore((s) => s.zoomOutRendering);
  const labelZoomThreshold = useGraphEngineStore((s) => s.labelZoomThreshold);
  const patchEngine = useGraphEngineStore((s) => s.patch);

  // Tipe link yang sedang diatur pada sub-grup per-type styling
  const [styleType, setStyleType] = useState<LinkStyleType>('hierarchy');


  // 1. Local state untuk input nama template baru
  const [templateName, setTemplateName] = useState('');
  const templates = useGraphTemplatesStore((s) => s.templates);
  const defaultTemplateId = useGraphTemplatesStore((s) => s.defaultTemplateId);
  const saveTemplate = useGraphTemplatesStore((s) => s.saveTemplate);
  const deleteTemplate = useGraphTemplatesStore((s) => s.deleteTemplate);
  const setDefaultTemplate = useGraphTemplatesStore((s) => s.setDefaultTemplate);

  const stats = useGraphStore((s) => s.stats);
  const requestReheat = useGraphInteractionStore((s) => s.requestReheat);
  const requestStop = useGraphInteractionStore((s) => s.requestStop);
  const setStoreCanvasMode = useGraphInteractionStore((s) => s.setCanvasMode);

  const filterCount =
    Number(minDepth > 0) +
    Number(maxDepth < 10) +
    Number(Boolean(search)) +
    Number(Boolean(contentFilter)) +
    Number(Boolean(tagFilter));

  const togglePanel = (group: SettingGroup) => {
    setActivePanel((curr) => (curr === group ? null : group));
  };

  const labelMode: LabelMode = !config.nodes.showLabels
    ? 'nodes'
    : config.nodes.labelBox
      ? 'boxes'
      : 'labels';

  const setLabelMode = (mode: LabelMode) => {
    if (mode === 'nodes') updateNodeConfig({ showLabels: false, labelBox: false });
    else if (mode === 'labels') updateNodeConfig({ showLabels: true, labelBox: false });
    else updateNodeConfig({ showLabels: true, labelBox: true });
  };

  // Handler 1: Simpan setting saat ini sebagai template baru
  const handleSaveTemplate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = templateName.trim();
    if (!trimmed) {
      toast.error('Masukkan nama template terlebih dahulu');
      return;
    }

    try {
      const newId = saveTemplate(trimmed, config, layout, orientation);
      setTemplateName('');
      toast.success(`Template "${trimmed}" berhasil disimpan`);
    } catch (err) {
      toast.error('Gagal menyimpan template graph');
    }
  };

  // Handler 2: Terapkan template terpilih ke graph saat ini
  const handleApplyTemplate = (template: GraphTemplate) => {
    try {
      // 1. Terapkan konfigurasi node, link, hierarki, dan physics
      setConfig(template.config);

      // 2. Terapkan mode layout dan orientasi bila tersimpan di template
      if (template.layoutMode) {
        onLayoutChange(template.layoutMode);
      }
      if (template.orientation) {
        onOrientationChange(template.orientation);
      }

      toast.success(`Template "${template.name}" diterapkan`);
    } catch (err) {
      toast.error('Gagal menerapkan template');
    }
  };

  // Handler 3: Jadikan template default (untuk tab baru atau vault default)
  const handleToggleDefault = (template: GraphTemplate) => {
    const isCurrentDefault = defaultTemplateId === template.id;
    const nextDefault = isCurrentDefault ? null : template.id;
    setDefaultTemplate(nextDefault);

    if (nextDefault) {
      toast.success(`"${template.name}" dijadikan template default`);
    } else {
      toast.info('Template default dihapus');
    }
  };

  // Handler 4: Hapus template
  const handleDeleteTemplate = (template: GraphTemplate) => {
    deleteTemplate(template.id);
    toast.info(`Template "${template.name}" telah dihapus`);
  };


  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-none absolute right-2 top-2 z-40 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4">
        {/* 1. Baris Setting: Gear Button & Horizontal Submenu */}
        <div className="pointer-events-auto flex items-center rounded-lg border border-border/60 bg-card/90 p-1 shadow-md shadow-black/25 backdrop-blur-md transition-all">
          {/* Horizontal Expanding Options ke arah Kiri (Width 280px max, smooth scroll) */}
          {isGearOpen && (
            <div className="mr-1 flex max-w-[calc(100vw-70px)] sm:w-[280px] items-center gap-1 overflow-x-auto overscroll-contain pr-1 border-r border-border/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-in fade-in-0 slide-in-from-right-2 duration-150">
              {/* 1. Search & Filters */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'search' ? 'secondary' : 'ghost'}
                    size="icon"
                    className={cn('relative h-7 w-7 rounded-md shrink-0 transition-colors', filterCount > 0 && 'text-primary')}
                    onClick={() => togglePanel('search')}
                    aria-label="Search and Depth Filters"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {filterCount > 0 && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Search & Filters</TooltipContent>
              </Tooltip>

              {/* 2. Layout Engine */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'layout' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-md shrink-0 transition-colors"
                    onClick={() => togglePanel('layout')}
                    aria-label="Layout Engine"
                  >
                    <Network className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Layout & Hierarchy</TooltipContent>
              </Tooltip>

              {/* 3. Color Engine */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'colors' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-md shrink-0 transition-colors"
                    onClick={() => togglePanel('colors')}
                    aria-label="Color Engine"
                  >
                    <Palette className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Color Engine</TooltipContent>
              </Tooltip>

              {/* 4. Atmosphere & Effects */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'atmosphere' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-md shrink-0 transition-colors"
                    onClick={() => togglePanel('atmosphere')}
                    aria-label="Atmosphere & Effects"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Atmosphere & Living Canvas</TooltipContent>
              </Tooltip>

              {/* 5. Nodes & Links */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'appearance' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-md shrink-0 transition-colors"
                    onClick={() => togglePanel('appearance')}
                    aria-label="Nodes & Links"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Nodes & Links</TooltipContent>
              </Tooltip>

              {/* 6. Global & Stats */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'global' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-md shrink-0 transition-colors"
                    onClick={() => togglePanel('global')}
                    aria-label="Graph Global & Templates"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Graph Global & Templates</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Main Gear Toggle Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={isGearOpen ? 'secondary' : 'ghost'}
                size="icon"
                className={cn('relative h-7 w-7 rounded-md shrink-0 transition-transform duration-200', isGearOpen && 'rotate-45')}
                aria-label="Toggle Graph Settings Menu"
                onClick={() => {
                  setIsGearOpen((prev) => !prev);
                  if (isGearOpen) setActivePanel(null);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                {filterCount > 0 && !isGearOpen && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {isGearOpen ? 'Collapse Settings' : 'Expand Graph Settings'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 2. Active Settings Panel (Width 100% simetris dengan Toolbar atas: 280px + gear = ~320px) */}
        {activePanel && (
          <section className="pointer-events-auto flex h-[280px] max-h-[280px] min-h-[280px] w-[min(324px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-lg shadow-black/30 backdrop-blur-md animate-in fade-in-0 slide-in-from-top-1 duration-150">
            {/* Header Panel */}
            <header className="flex h-7 shrink-0 items-center justify-between border-b border-border/50 px-2.5 bg-muted/20">
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                <span className="truncate text-[11px] font-medium text-foreground tracking-tight">
                  {activePanel === 'search' && 'Search & Depth'}
                  {activePanel === 'layout' && 'Layout Engine'}
                  {activePanel === 'appearance' && 'Nodes & Links'}
                  {activePanel === 'colors' && 'Color Engine'}
                  {activePanel === 'atmosphere' && 'Atmosphere & Effects'}
                  {activePanel === 'global' && 'Graph Global'}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Close settings panel"
                onClick={() => setActivePanel(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </header>

            {/* Body Panel dengan scrollbar halus */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2.5 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
              {/* 1. SEARCH & DEPTH PANEL */}
              {activePanel === 'search' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Search by title</Label>
                    <Input
                      value={search}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Type title..."
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 rounded-md bg-secondary/30 p-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium">Depth Level</span>
                      <span className="text-muted-foreground">{minDepth} - {maxDepth}</span>
                    </div>
                    <Slider
                      value={[minDepth, maxDepth]}
                      min={0}
                      max={10}
                      step={1}
                      onValueChange={([min, max]) => {
                        onMinDepthChange(min);
                        onMaxDepthChange(max);
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Content text</Label>
                    <Input
                      value={contentFilter}
                      onChange={(e) => onContentFilterChange(e.target.value)}
                      placeholder="Match content..."
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tag filter</Label>
                    <Input
                      value={tagFilter}
                      onChange={(e) => onTagFilterChange(e.target.value)}
                      placeholder="#tag..."
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* 2. LAYOUT ENGINE PANEL */}
              {activePanel === 'layout' && (
                <div className="space-y-3.5">
                  {/* Mode Switcher: Mindmap View vs Graph View */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">View Mode</Label>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-secondary/30 p-1">
                      <Button
                        type="button"
                        variant={canvasMode === 'mindmap' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 text-xs font-medium transition-all",
                          canvasMode === 'mindmap' && "bg-background text-foreground shadow-sm"
                        )}
                        onClick={() => handleModeSwitch('mindmap')}
                      >
                        <GitBranch className="h-3.5 w-3.5 text-primary" />
                        Mindmap View
                      </Button>
                      <Button
                        type="button"
                        variant={canvasMode === 'graph' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 text-xs font-medium transition-all",
                          canvasMode === 'graph' && "bg-background text-foreground shadow-sm"
                        )}
                        onClick={() => handleModeSwitch('graph')}
                      >
                        <Network className="h-3.5 w-3.5 text-primary" />
                        Graph View
                      </Button>
                    </div>
                  </div>

                  {/* TAMBAHKAN: Switcher Layout Arrangement (Auto vs Custom) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground">Layout Structure</Label>
                      <span className="text-[10px] text-muted-foreground/70">
                        {layoutArrangement === 'auto' ? 'Fixed (Anti-overlap)' : 'Freehand Custom'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
                      <Button
                        type="button"
                        variant={layoutArrangement === 'auto' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 text-xs font-medium transition-all",
                          layoutArrangement === 'auto' && "bg-background text-foreground shadow-sm"
                        )}
                        onClick={() => setLayoutArrangement('auto')}
                        title="Automated layout: fixed coordinates, prevents overlapping, auto snap-back"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Auto
                      </Button>
                      <Button
                        type="button"
                        variant={layoutArrangement === 'custom' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 text-xs font-medium transition-all",
                          layoutArrangement === 'custom' && "bg-background text-foreground shadow-sm"
                        )}
                        onClick={() => setLayoutArrangement('custom')}
                        title="Custom layout: free dragging and manual node coordinate placement"
                      >
                        <Move className="h-3.5 w-3.5 text-primary" />
                        Custom
                      </Button>
                    </div>
                  </div>

                  {/* Dynamic Layout Algorithm Options */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      {canvasMode === 'mindmap' ? 'Mindmap Algorithm' : 'Graph Algorithm'}
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(canvasMode === 'mindmap' ? MINDMAP_LAYOUTS : GRAPH_LAYOUTS).map((item) => {
                        const Icon = item.icon;
                        return (
                          <Button
                            key={item.value}
                            type="button"
                            variant={layout === item.value ? 'secondary' : 'outline'}
                            className="h-7 justify-start px-2 text-xs"
                            onClick={() => onLayoutChange(item.value)}
                          >
                            <Icon className="mr-1.5 h-3.5 w-3.5" />
                            {item.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Option Khusus Mindmap: Orientation */}
                  {canvasMode === 'mindmap' && layout === 'mindmap' && (
                    <div className="space-y-1.5 animate-in fade-in-0 duration-150">
                      <Label className="text-[11px] text-muted-foreground">Orientation</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['balanced', 'radial'] as MindmapOrientation[]).map((val) => (
                          <Button
                            key={val}
                            type="button"
                            variant={orientation === val ? 'secondary' : 'outline'}
                            className="h-7 text-xs capitalize"
                            onClick={() => onOrientationChange(val)}
                          >
                            {val}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opsi Umum: Zoom-Out Rendering */}
                  <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                    <Label className="text-[11px] text-muted-foreground">Zoom-Out Rendering</Label>
                    <Select
                      value={zoomOutRendering}
                      onValueChange={(val) =>
                        patchEngine({ zoomOutRendering: val as 'optimized' | 'full-detail' })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optimized" className="text-xs">
                          Optimized
                        </SelectItem>
                        <SelectItem value="full-detail" className="text-xs">
                          Keep full detail
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Keep full detail preserves node cards, labels, and link weight while zooming out.
                    </p>
                  </div>

                  {/* Opsi Umum: Label Zoom Threshold */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Label Zoom Threshold</span>
                      <span>{labelZoomThreshold.toFixed(2)}x</span>
                    </div>
                    <Slider
                      value={[labelZoomThreshold]}
                      min={0.1}
                      max={3}
                      step={0.05}
                      onValueChange={([v]) => patchEngine({ labelZoomThreshold: v })}
                    />
                  </div>
                </div>
              )}


              {/* COLOR ENGINE PANEL */}
              {activePanel === 'colors' && (
                <div className="space-y-3.5">
                  <ColorEngineControls
                    hierarchy={config.hierarchy}
                    nodeConfig={config.nodes}
                    onHierarchyUpdate={updateHierarchyConfig}
                    onNodeConfigUpdate={updateNodeConfig}
                  />
                </div>
              )}

              {activePanel === 'atmosphere' && (
                <AtmosphereControls
                  atmosphere={mergeAtmosphereConfig(config.atmosphere)}
                  linkConfig={config.links}
                  nodeConfig={config.nodes}
                  onAtmosphereUpdate={(updates) => {
                    if (leafApi) leafApi.getState().setAtmosphereConfig(updates);
                    else useGraphStore.getState().updateAtmosphereConfig(updates);
                  }}
                  onLinkUpdate={updateLinkConfig}
                  onNodeUpdate={updateNodeConfig}
                />
              )}

              {activePanel === 'appearance' && (
                <Tabs value={appearanceTab} onValueChange={value => { if (value === 'nodes' || value === 'links') setAppearanceTab(value); }} className="mb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="nodes">Nodes</TabsTrigger>
                    <TabsTrigger value="links">Links</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* 3. NODE APPEARANCE PANEL */}
              {activePanel === 'appearance' && appearanceTab === 'nodes' && (
                <div className="space-y-2">
                  <PanelSection title="Node Types" defaultOpen>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Folder Nodes</Label>
                      <Switch
                        checked={config.nodes.showFolderNodes}
                        onCheckedChange={(checked) => updateNodeConfig({ showFolderNodes: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">File Nodes</Label>
                      <Switch
                        checked={config.nodes.showFileNodes}
                        onCheckedChange={(checked) => updateNodeConfig({ showFileNodes: checked })}
                      />
                    </div>
                  </PanelSection>

                  <PanelSection title="Size & Geometry">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Shape</Label>
                      <Select
                        value={config.nodes.shape}
                        onValueChange={(val) =>
                          updateNodeConfig({ shape: val as NodeConfig['shape'] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NODE_SHAPES.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Relative Size</span>
                        <span>{config.nodes.relSize}</span>
                      </div>
                      <Slider
                        value={[config.nodes.relSize]}
                        min={1}
                        max={20}
                        step={1}
                        onValueChange={([v]) => updateNodeConfig({ relSize: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Size by hierarchy level</Label>
                      <Switch
                        checked={config.nodes.sizeByDepth}
                        onCheckedChange={(checked) => updateNodeConfig({ sizeByDepth: checked })}
                      />
                    </div>

                    {config.nodes.sizeByDepth && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Level size interval</span>
                          <span>{config.nodes.depthSizeInterval.toFixed(2)}px</span>
                        </div>
                        <Slider
                          value={[config.nodes.depthSizeInterval]}
                          min={0.25}
                          max={4}
                          step={0.25}
                          onValueChange={([v]) => updateNodeConfig({ depthSizeInterval: v })}
                        />
                      </div>
                    )}
                  </PanelSection>

                  <PanelSection title="Labels">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Labels display</Label>
                      <div className="grid grid-cols-3 gap-1">
                        {LABEL_MODES.map((item) => (
                          <Button
                            key={item.value}
                            type="button"
                            variant={labelMode === item.value ? 'secondary' : 'outline'}
                            className="h-7 text-[11px]"
                            onClick={() => setLabelMode(item.value)}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Show Labels</Label>
                      <Switch
                        checked={config.nodes.showLabels}
                        onCheckedChange={(checked) => updateNodeConfig({ showLabels: checked })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Label source field</Label>
                      <Select
                        value={config.nodes.labelField}
                        onValueChange={(val) =>
                          updateNodeConfig({ labelField: val as NodeConfig['labelField'] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LABEL_FIELDS.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Label Size</span>
                        <span>{config.nodes.labelSize}px</span>
                      </div>
                      <Slider
                        value={[config.nodes.labelSize]}
                        min={8}
                        max={32}
                        step={1}
                        onValueChange={([v]) => updateNodeConfig({ labelSize: v })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Font style</Label>
                      <Select
                        value={config.nodes.labelFontStyle}
                        onValueChange={(val) =>
                          updateNodeConfig({ labelFontStyle: val as NodeConfig['labelFontStyle'] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_STYLES.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ColorPicker
                      label="Label Text Color"
                      value={config.nodes.labelColor}
                      onChange={(val) => updateNodeConfig({ labelColor: val })}
                    />

                    <div className="flex items-center justify-between border-t border-border/50 pt-2">
                      <Label className="text-xs">Label Box</Label>
                      <Switch
                        checked={config.nodes.labelBox}
                        onCheckedChange={(checked) => updateNodeConfig({ labelBox: checked })}
                      />
                    </div>

                    {config.nodes.labelBox && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Box Background</Label>
                          <Switch
                            checked={config.nodes.labelBackground}
                            onCheckedChange={(checked) =>
                              updateNodeConfig({ labelBackground: checked })
                            }
                          />
                        </div>
                        {config.nodes.labelBackground && (
                          <ColorPicker
                            label="Box Color"
                            value={config.nodes.labelBackgroundColor}
                            onChange={(val) => updateNodeConfig({ labelBackgroundColor: val })}
                          />
                        )}
                      </>
                    )}
                  </PanelSection>
                </div>
              )}

              {/* 4. LINKS & PARTICLES PANEL */}
              {activePanel === 'appearance' && appearanceTab === 'links' && (
                <div className="space-y-2">
                  <PanelSection title="Link Types" defaultOpen>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Hierarchical Links</Label>
                      <Switch
                        checked={config.topology.showHierarchy}
                        onCheckedChange={(checked) =>
                          updateTopologyConfig({ showHierarchy: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Backlink Connections</Label>
                      <Switch
                        checked={config.topology.showBacklinks}
                        onCheckedChange={(checked) =>
                          updateTopologyConfig({ showBacklinks: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tag-Based Edges</Label>
                      <Switch
                        checked={config.topology.showTags}
                        onCheckedChange={(checked) => updateTopologyConfig({ showTags: checked })}
                      />
                    </div>
                    {config.topology.showTags && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Tag Threshold</span>
                          <span>
                            {config.topology.tagThreshold} tag
                            {config.topology.tagThreshold > 1 ? 's' : ''}
                          </span>
                        </div>
                        <Slider
                          value={[config.topology.tagThreshold]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={([v]) => updateTopologyConfig({ tagThreshold: v })}
                        />
                      </div>
                    )}
                  </PanelSection>

                  <PanelSection title="Per-Type Styling">
                    <div className="grid grid-cols-4 gap-1">
                      {LINK_STYLE_TYPES.map((item) => (
                        <Button
                          key={item.value}
                          type="button"
                          variant={styleType === item.value ? 'secondary' : 'outline'}
                          className="h-7 px-1 text-[10px]"
                          onClick={() => setStyleType(item.value)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>

                    <ColorPicker
                      label="Link Color"
                      value={config.topology.styles[styleType].color}
                      onChange={(val) => updateTopologyStyle(styleType, { color: val })}
                    />

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Line Style</Label>
                      <Select
                        value={config.topology.styles[styleType].lineStyle}
                        onValueChange={(val) =>
                          updateTopologyStyle(styleType, {
                            lineStyle: val as LinkStyle['lineStyle'],
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINE_STYLES.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Opacity</span>
                        <span>
                          {Math.round(config.topology.styles[styleType].opacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[config.topology.styles[styleType].opacity]}
                        min={0.1}
                        max={1}
                        step={0.05}
                        onValueChange={([v]) => updateTopologyStyle(styleType, { opacity: v })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Width</span>
                        <span>{config.topology.styles[styleType].width}px</span>
                      </div>
                      <Slider
                        value={[config.topology.styles[styleType].width]}
                        min={0.5}
                        max={5}
                        step={0.5}
                        onValueChange={([v]) => updateTopologyStyle(styleType, { width: v })}
                      />
                    </div>
                  </PanelSection>

                  <PanelSection title="Hierarchy Link Color">
                    <HierarchyLinkColorControls
                      hierarchy={config.hierarchy}
                      onChange={updateHierarchyConfig}
                    />
                  </PanelSection>

                  <PanelSection title="Global Link Geometry">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Link Curvature</span>
                        <span>{config.links.curvature.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[config.links.curvature]}
                        min={0}
                        max={0.8}
                        step={0.05}
                        onValueChange={([v]) => updateLinkConfig({ curvature: v })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Link Thickness</span>
                        <span>{config.links.width}px</span>
                      </div>
                      <Slider
                        value={[config.links.width]}
                        min={0.5}
                        max={5}
                        step={0.5}
                        onValueChange={([v]) => updateLinkConfig({ width: v })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Global Opacity</span>
                        <span>{Math.round(config.links.opacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[config.links.opacity]}
                        min={0.1}
                        max={1}
                        step={0.05}
                        onValueChange={([v]) => updateLinkConfig({ opacity: v })}
                      />
                    </div>
                  </PanelSection>


                </div>
              )}

              {/* 5. GRAPH GLOBAL & TEMPLATES PANEL */}
              {activePanel === 'global' && (
                <div className="space-y-4">
                  {/* Bagian A: Simpan Template Baru */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <Bookmark className="h-3 w-3 text-primary" />
                      <span>Save as Template</span>
                    </div>
                    <form onSubmit={handleSaveTemplate} className="flex gap-1.5">
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name (e.g. Focus Dark)..."
                        className="h-7 text-xs bg-background/50"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-7 shrink-0 px-2.5 text-xs gap-1"
                        disabled={!templateName.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </form>
                  </div>

                  {/* Bagian B: Daftar Template Tersimpan */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Saved Templates</span>
                      <span className="font-mono text-[10px]">
                        {Object.keys(templates).length}
                      </span>
                    </div>

                    <div className="max-h-[140px] space-y-1 overflow-y-auto pr-1">
                      {Object.keys(templates).length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/60 p-2.5 text-center text-[11px] text-muted-foreground">
                          Belum ada template tersimpan. Simpan preferensi graph Anda di atas.
                        </div>
                      ) : (
                        Object.values(templates).map((tmpl) => {
                          const isDefault = defaultTemplateId === tmpl.id;
                          return (
                            <div
                              key={tmpl.id}
                              className="group flex items-center justify-between gap-1.5 rounded-md border border-border/50 bg-secondary/20 px-2 py-1.5 transition-colors hover:bg-secondary/40"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-medium text-foreground">
                                    {tmpl.name}
                                  </span>
                                  {isDefault && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1 text-[9px] font-mono leading-none text-primary"
                                    >
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {tmpl.layoutMode || 'free-force'} •{' '}
                                  {new Date(tmpl.updatedAt).toLocaleDateString()}
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                {/* Tombol Terapkan */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleApplyTemplate(tmpl)}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Apply Template</TooltipContent>
                                </Tooltip>

                                {/* Tombol Jadikan Default */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        'h-6 w-6',
                                        isDefault
                                          ? 'text-primary hover:text-amber-500'
                                          : 'text-muted-foreground hover:text-foreground'
                                      )}
                                      onClick={() => handleToggleDefault(tmpl)}
                                    >
                                      <Star
                                        className={cn(
                                          'h-3 w-3',
                                          isDefault && 'fill-current'
                                        )}
                                      />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {isDefault ? 'Remove Default' : 'Set as Default'}
                                  </TooltipContent>
                                </Tooltip>

                                {/* Tombol Hapus */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDeleteTemplate(tmpl)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Delete Template</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Bagian C: Ringkasan Stats & Reset */}
                  <div className="space-y-2 border-t border-border/40 pt-2.5">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-md border border-border/60 bg-secondary/30 p-1.5">
                        <div className="text-sm font-bold text-foreground">{stats.totalCount}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Connections</div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-secondary/30 p-1.5">
                        <div className="text-sm font-bold text-foreground">{stats.hierarchyCount}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Hierarchy</div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-secondary/30 p-1.5">
                        <div className="text-sm font-bold text-foreground">{stats.backlinkCount}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Backlinks</div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-secondary/30 p-1.5">
                        <div className="text-sm font-bold text-foreground">{stats.tagCount}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Tags</div>
                      </div>
                    </div>

                    {stats.topHubs.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Top Hubs
                        </div>
                        {stats.topHubs.slice(0, 3).map((hub, index) => (
                          <div
                            key={hub.nodeId}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/30 px-2 py-1"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="text-[9px] font-mono text-muted-foreground">
                                #{index + 1}
                              </span>
                              <span className="truncate text-[11px] text-foreground">
                                {hub.nodeName}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                              {hub.connectionCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        resetConfig();
                        toast.info('Graph config dikembalikan ke default bawaan');
                      }}
                    >
                      <RotateCcw className="mr-1.5 h-3 w-3" />
                      Reset to Factory Defaults
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Quick Zoom Group (Otomatis berada di bawah Setting Bar, dan ikut terdorong turun jika Active Panel terbuka) */}
        <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-card/90 p-0.5 shadow-md shadow-black/25 backdrop-blur-md transition-all">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                aria-label="Zoom to fit"
                onClick={() => onSmartZoom('fit')}
              >
                <Frame className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">Zoom to fit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                aria-label="Zoom to selection"
                onClick={() => onSmartZoom('selection')}
              >
                <Focus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">Zoom to selection</TooltipContent>
          </Tooltip>

          {/* Dynamic Expand All / Clear Focus Button */}
          {(collapsedCount > 0 || focused) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-primary border-t border-border/40 pt-0.5 animate-in fade-in zoom-in-90 duration-150"
                  aria-label="Show everything"
                  onClick={() => {
                    onExpandAll();
                    onClearFocus();
                  }}
                >
                  <UnfoldVertical className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Show everything ({collapsedCount} collapsed)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}