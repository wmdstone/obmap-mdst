import { useState } from 'react';
import { Bookmark, Check, Plus, Star, Trash2, Globe, Activity, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/global/ui/button';
import { Input } from '@/global/ui/input';
import { Badge } from '@/global/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/global/ui/tooltip';
import { cn } from '@/global/utils/cn';
import { useGraphStore } from '@/shared/stores';
import { SectionHeaderWithReset } from '@/global/ui/SectionHeaderWithReset';
import {
  useGraphTemplatesStore,
  type GraphTemplate,
} from '@/domains/graph/shared/stores/useGraphTemplatesStore';
import type { GraphConfigState } from '@/domains/graph/shared/stores/useGraphStore';
import type { LayoutMode, MindmapOrientation } from '@/domains/graph/shared/utils/graph.types';

export interface GlobalTemplatesPanelProps {
  config: GraphConfigState;
  layout: LayoutMode;
  orientation: MindmapOrientation;
  onLayoutChange: (layout: LayoutMode) => void;
  onOrientationChange: (orientation: MindmapOrientation) => void;
  setConfig: (cfg: GraphConfigState) => void;
  resetConfig: () => void;
}

export function GlobalTemplatesPanel({
  config,
  layout,
  orientation,
  onLayoutChange,
  onOrientationChange,
  setConfig,
  resetConfig,
}: GlobalTemplatesPanelProps) {
  const [templateName, setTemplateName] = useState('');
  const templates = useGraphTemplatesStore((s) => s.templates);
  const defaultTemplateId = useGraphTemplatesStore((s) => s.defaultTemplateId);
  const saveTemplate = useGraphTemplatesStore((s) => s.saveTemplate);
  const deleteTemplate = useGraphTemplatesStore((s) => s.deleteTemplate);
  const setDefaultTemplate = useGraphTemplatesStore((s) => s.setDefaultTemplate);
  const stats = useGraphStore((s) => s.stats);

  const handleSaveTemplate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = templateName.trim();
    if (!trimmed) {
      toast.error('Masukkan nama template terlebih dahulu');
      return;
    }

    try {
      saveTemplate(trimmed, config, layout, orientation);
      setTemplateName('');
      toast.success(`Template "${trimmed}" berhasil disimpan`);
    } catch {
      toast.error('Gagal menyimpan template graph');
    }
  };

  const handleApplyTemplate = (template: GraphTemplate) => {
    try {
      setConfig(template.config);
      if (template.layoutMode) {
        onLayoutChange(template.layoutMode);
      }
      if (template.orientation) {
        onOrientationChange(template.orientation);
      }
      toast.success(`Template "${template.name}" diterapkan`);
    } catch {
      toast.error('Gagal menerapkan template');
    }
  };

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

  const handleDeleteTemplate = (template: GraphTemplate) => {
    deleteTemplate(template.id);
    toast.info(`Template "${template.name}" telah dihapus`);
  };

  const templateCount = Object.keys(templates).length;

  return (
    <div className="grid grid-cols-1 gap-3.5">
      {/* BENTO CARD 1: SIMPAN & AKSI TEMPLATE */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Bookmark}
            title="Simpan Konfigurasi"
            description="Abadikan snapshot layout, warna, dan gaya saat ini"
          />

          <form onSubmit={handleSaveTemplate} className="space-y-2">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nama template (e.g. Focus Minimal)..."
              className="h-8 text-xs bg-background/50"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              disabled={!templateName.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Simpan Template Baru
            </Button>
          </form>

          <div className="border-t border-border/40 pt-2 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Aksi Global
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetConfig}
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Semua Konfigurasi ke Default
            </Button>
          </div>
        </div>
      </div>

      {/* BENTO CARD 2: PUSTAKA TEMPLATE TERSIMPAN */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Globe}
            title="Pustaka Template"
            badge={templateCount}
            description="Koleksi preset tersimpan yang dapat diterapkan instan"
          />

          <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
            {templateCount === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Belum ada template tersimpan. Masukkan nama dan simpan di kartu sebelah kiri.
              </div>
            ) : (
              Object.values(templates).map((tmpl) => {
                const isDefault = defaultTemplateId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/20 px-2.5 py-2 transition-colors hover:bg-secondary/40"
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
                        <TooltipContent side="top">Terapkan Template</TooltipContent>
                      </Tooltip>

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
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                            onClick={() => handleToggleDefault(tmpl)}
                          >
                            <Star
                              className={cn(
                                'h-3 w-3',
                                isDefault && 'fill-current',
                              )}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {isDefault ? 'Hapus Default' : 'Jadikan Default'}
                        </TooltipContent>
                      </Tooltip>

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
                        <TooltipContent side="top">Hapus Template</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* BENTO CARD 3: TELEMETRI & TOP HUBS */}
      <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs space-y-3">
        <div className="space-y-3">
          <SectionHeaderWithReset
            icon={Activity}
            title="Telemetri & Hub Graf"
            description="Statistik topologi relasi dan node dengan derajat tertinggi"
          />

          <div className="grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
              <div className="text-sm font-bold text-foreground">{stats.totalCount}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Koneksi</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
              <div className="text-sm font-bold text-foreground">{stats.hierarchyCount}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Hierarki</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
              <div className="text-sm font-bold text-foreground">{stats.backlinkCount}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Backlinks</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
              <div className="text-sm font-bold text-foreground">{stats.tagCount}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Tags</div>
            </div>
          </div>

          {stats.topHubs.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Top Connected Hubs
              </span>
              <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5">
                {stats.topHubs.slice(0, 3).map((hub, index) => (
                  <div
                    key={hub.nodeId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-secondary/20 px-2 py-1"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-[9px] font-mono text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="truncate text-xs text-foreground">
                        {hub.nodeName}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-mono font-semibold text-primary">
                      {hub.connectionCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}