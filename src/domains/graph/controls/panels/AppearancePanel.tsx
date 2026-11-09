import { useState } from 'react';
import { Switch } from '@/shared/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ControlSliderRow } from '@/shared/ui/ControlSliderRow';
import { SectionHeaderWithReset } from '@/shared/ui/SectionHeaderWithReset';
import { ColorPicker } from '@/domains/graph/config-panel/ColorPicker';
import { HierarchyLinkColorControls } from '@/domains/graph/config-panel/HierarchyColorControls';
import { 
  Circle, 
  Link2, 
  Type, 
  Shapes,
  Sparkles,
  GitFork
} from 'lucide-react';
import type {
  GraphConfigState,
  NodeConfig,
  LinkConfig,
  TopologyConfig,
  LinkStyle,
  HierarchyColorConfig,
} from '@/domains/graph/stores/useGraphStore';

type LabelMode = 'nodes' | 'labels' | 'boxes';
export type LinkStyleType = keyof TopologyConfig['styles'];

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

const FONT_STYLES: { value: NodeConfig['labelFontStyle']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'bold-italic', label: 'Bold Italic' },
];

const NODE_SHAPES: { value: NodeConfig['shape']; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'hexagon', label: 'Hexagon' },
];

export interface AppearancePanelProps {
  config: GraphConfigState;
  updateNodeConfig: (upd: Partial<NodeConfig>) => void;
  updateTopologyConfig: (upd: Partial<TopologyConfig>) => void;
  updateTopologyStyle: (type: LinkStyleType, upd: Partial<LinkStyle>) => void;
  updateHierarchyConfig: (upd: Partial<HierarchyColorConfig>) => void;
  updateLinkConfig: (upd: Partial<LinkConfig>) => void;
}

export function AppearancePanel({
  config,
  updateNodeConfig,
  updateTopologyConfig,
  updateTopologyStyle,
  updateHierarchyConfig,
  updateLinkConfig,
}: AppearancePanelProps) {
  const [activeTab, setActiveTab] = useState<'nodes' | 'links'>('nodes');
  const [styleType, setStyleType] = useState<LinkStyleType>('hierarchy');

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

  const currentStyle = config.topology.styles[styleType] ?? {
    color: '#94a3b8',
    lineStyle: 'solid',
    opacity: 0.6,
    width: 1.2,
  };

  return (
    <div className="space-y-3.5">
      {/* Sub-Switch: Nodes vs Links */}
      <div className="flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'nodes' | 'links')}
          className="w-auto"
        >
          <TabsList className="h-8 p-1 bg-muted/60">
            <TabsTrigger value="nodes" className="h-6 px-3 text-xs gap-1.5">
              <Shapes className="h-3.5 w-3.5" />
              <span>Tampilan Node</span>
            </TabsTrigger>
            <TabsTrigger value="links" className="h-6 px-3 text-xs gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              <span>Tampilan Tautan (Links)</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'nodes' ? (
        /* ================= TAMPILAN NODE (3 BENTO CARDS) ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
          {/* BENTO 1: BENTUK & TIPE NODE */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Bentuk & Representasi"
              icon={Shapes}
              description="Bentuk geometris dan ikon format item"
              onReset={() =>
                updateNodeConfig({
                  showFolderNodes: true,
                  showFileNodes: true,
                  autoShapeByFormat: true,
                  formatMarkerStyle: 'shapes',
                })
              }
            />

            {/* Visibilitas Node */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2 rounded-lg border border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">Folder</span>
                <Switch
                  checked={config.nodes.showFolderNodes}
                  onCheckedChange={(checked) => updateNodeConfig({ showFolderNodes: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">File Note</span>
                <Switch
                  checked={config.nodes.showFileNodes}
                  onCheckedChange={(checked) => updateNodeConfig({ showFileNodes: checked })}
                />
              </div>
            </div>

            {/* Bentuk Otomatis Format */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-foreground">Bentuk Otomatis Format</span>
                  <p className="text-[10px] text-muted-foreground">Bentuk unik per tipe file</p>
                </div>
                <Switch
                  checked={config.nodes.autoShapeByFormat ?? true}
                  onCheckedChange={(checked) => updateNodeConfig({ autoShapeByFormat: checked })}
                />
              </div>

              {(config.nodes.autoShapeByFormat ?? true) ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">Gaya Marker:</span>
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/40">
                    <button
                      type="button"
                      onClick={() => updateNodeConfig({ formatMarkerStyle: 'shapes' })}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        (config.nodes.formatMarkerStyle ?? 'shapes') === 'shapes'
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Geometri
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNodeConfig({ formatMarkerStyle: 'icons' })}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        config.nodes.formatMarkerStyle === 'icons'
                          ? 'bg-background text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Ikon Explorer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Bentuk Manual Semua Node</span>
                  <Select
                    value={config.nodes.shape}
                    onValueChange={(val) => updateNodeConfig({ shape: val as NodeConfig['shape'] })}
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
              )}
            </div>
          </div>

          {/* BENTO 2: UKURAN & SKALA NODE */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Ukuran & Skala"
              icon={Circle}
              description="Dimensi relatif dan pembesaran hierarkis"
              onReset={() => updateNodeConfig({ relSize: 6, sizeByDepth: false })}
            />

            <ControlSliderRow
              label="Ukuran Relatif Node"
              description="Radius dasar lingkaran dan poligon node"
              value={config.nodes.relSize}
              min={1}
              max={60}
              step={1}
              defaultValue={6}
              onChange={(v) => updateNodeConfig({ relSize: v })}
            />

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div>
                <span className="text-xs font-medium text-foreground">Skala Kedalaman Hierarki</span>
                <p className="text-[10px] text-muted-foreground">Node root lebih besar dari cabang</p>
              </div>
              <Switch
                checked={config.nodes.sizeByDepth}
                onCheckedChange={(checked) => updateNodeConfig({ sizeByDepth: checked })}
              />
            </div>
          </div>

          {/* BENTO 3: LABEL & TIPOGRAFI */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Label & Tipografi"
              icon={Type}
              description="Penamaan, kotak teks, dan gaya font"
              onReset={() =>
                updateNodeConfig({
                  showLabels: true,
                  labelBox: false,
                  labelSize: 11,
                  labelFontStyle: 'normal',
                })
              }
            />

            {/* Segmented Mode Label */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Mode Tampilan Label</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                {[
                  { id: 'nodes', label: 'Titik Saja' },
                  { id: 'labels', label: '+ Label' },
                  { id: 'boxes', label: '+ Kotak' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLabelMode(m.id as LabelMode)}
                    className={`py-1 text-[11px] font-medium rounded transition-all ${
                      labelMode === m.id
                        ? 'bg-background text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Controls */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Gaya Huruf</span>
                <Select
                  value={config.nodes.labelFontStyle ?? 'normal'}
                  onValueChange={(val) =>
                    updateNodeConfig({ labelFontStyle: val as NodeConfig['labelFontStyle'] })
                  }
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
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

              <ControlSliderRow
                label="Ukuran Font Label"
                unit="px"
                value={config.nodes.labelSize}
                min={8}
                max={32}
                step={1}
                defaultValue={11}
                onChange={(v) => updateNodeConfig({ labelSize: v })}
              />

              <ColorPicker
                label="Warna Teks Label"
                value={config.nodes.labelColor}
                onChange={(val) => updateNodeConfig({ labelColor: val })}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ================= TAMPILAN LINKS (3 BENTO CARDS) ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
          {/* BENTO 1: VISIBILITAS TIPE LINK */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Tipe Relasi Tautan"
              icon={GitFork}
              description="Filter visibilitas garis berdasarkan hubungan"
              onReset={() =>
                updateTopologyConfig({
                  showHierarchy: true,
                  showBacklinks: true,
                  showTags: true,
                  tagThreshold: 1,
                })
              }
            />

            <div className="space-y-2 bg-muted/30 p-2.5 rounded-lg border border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">Tautan Hierarkis</span>
                <Switch
                  checked={config.topology.showHierarchy}
                  onCheckedChange={(checked) => updateTopologyConfig({ showHierarchy: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">Tautan Balik (Backlinks)</span>
                <Switch
                  checked={config.topology.showBacklinks}
                  onCheckedChange={(checked) => updateTopologyConfig({ showBacklinks: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">Relasi Berbasis Tag</span>
                <Switch
                  checked={config.topology.showTags}
                  onCheckedChange={(checked) => updateTopologyConfig({ showTags: checked })}
                />
              </div>
            </div>

            {config.topology.showTags && (
              <ControlSliderRow
                label="Ambang Batas Tag"
                description="Minimal tag bersama untuk membentuk garis"
                value={config.topology.tagThreshold}
                min={1}
                max={5}
                step={1}
                defaultValue={1}
                onChange={(v) => updateTopologyConfig({ tagThreshold: v })}
              />
            )}
          </div>

          {/* BENTO 2: STYLING SPESIFIK TIPE GARIS */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Gaya Per Tipe Tautan"
              icon={Link2}
              description="Warna, ketebalan, dan pola garis per tipe"
            />

            <Tabs
              value={styleType}
              onValueChange={(val) => setStyleType(val as LinkStyleType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-7 p-0.5 bg-muted/60">
                {LINK_STYLE_TYPES.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-[10px] px-1 py-0.5">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="space-y-2.5">
              <ColorPicker
                label="Warna Garis"
                value={currentStyle.color}
                onChange={(val) => updateTopologyStyle(styleType, { color: val })}
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Pola Garis</span>
                <Select
                  value={currentStyle.lineStyle}
                  onValueChange={(val) =>
                    updateTopologyStyle(styleType, { lineStyle: val as LinkStyle['lineStyle'] })
                  }
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
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

              <ControlSliderRow
                label="Ketebalan Garis"
                unit="px"
                value={currentStyle.width}
                min={0.5}
                max={5}
                step={0.5}
                defaultValue={1.2}
                formatValue={(v) => `${v.toFixed(1)}px`}
                onChange={(val) => updateTopologyStyle(styleType, { width: val })}
              />

              <ControlSliderRow
                label="Opasitas Tautan"
                unit="%"
                value={Math.round(currentStyle.opacity * 100)}
                min={10}
                max={100}
                step={5}
                defaultValue={60}
                onChange={(val) => updateTopologyStyle(styleType, { opacity: val / 100 })}
              />
            </div>
          </div>

          {/* BENTO 3: GEOMETRI GLOBAL & PARTIKEL */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
            <SectionHeaderWithReset
              title="Geometri Global & Partikel"
              icon={Sparkles}
              description="Kelengkungan global dan aliran partikel"
              onReset={() => updateLinkConfig({ curvature: 0, width: 1.2, showParticles: false })}
            />

            <div className="space-y-2.5">
              <ControlSliderRow
                label="Kelengkungan Tautan (Curvature)"
                value={config.links.curvature}
                min={0}
                max={0.8}
                step={0.05}
                defaultValue={0}
                formatValue={(v) => v.toFixed(2)}
                onChange={(val) => updateLinkConfig({ curvature: val })}
              />

              <ControlSliderRow
                label="Ketebalan Global"
                unit="px"
                value={config.links.width}
                min={0.5}
                max={5}
                step={0.5}
                defaultValue={1.2}
                formatValue={(v) => `${v.toFixed(1)}px`}
                onChange={(val) => updateLinkConfig({ width: val })}
              />

              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <div>
                  <span className="text-xs font-medium text-foreground">Aliran Partikel Bergerak</span>
                  <p className="text-[10px] text-muted-foreground">Animasi titik melintasi tautan</p>
                </div>
                <Switch
                  checked={config.links.showParticles}
                  onCheckedChange={(checked) => updateLinkConfig({ showParticles: checked })}
                />
              </div>

              {config.links.showParticles && (
                <ControlSliderRow
                  label="Jumlah Partikel per Garis"
                  value={config.links.particles}
                  min={1}
                  max={8}
                  step={1}
                  defaultValue={3}
                  onChange={(val) => updateLinkConfig({ particles: val })}
                />
              )}

              <div className="pt-2 border-t border-border/40">
                <HierarchyLinkColorControls
                  hierarchy={config.hierarchy}
                  onChange={updateHierarchyConfig}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}