import { Input } from '@/global/ui/input';
import { Button } from '@/global/ui/button';
import { SectionHeaderWithReset } from '@/global/ui/SectionHeaderWithReset';
import { Search, Sliders, Tag, FileText } from 'lucide-react';
import { Slider } from '@/global/ui/slider-noinput';

interface SearchPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  minDepth: number;
  maxDepth: number;
  onMinDepthChange: (value: number) => void;
  onMaxDepthChange: (value: number) => void;
  contentFilter: string;
  onContentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
}

export function SearchPanel({
  search,
  onSearchChange,
  minDepth,
  maxDepth,
  onMinDepthChange,
  onMaxDepthChange,
  contentFilter,
  onContentFilterChange,
  tagFilter,
  onTagFilterChange,
}: SearchPanelProps) {
  const hasActiveFilters = Boolean(search || contentFilter || tagFilter || minDepth > 0 || maxDepth < 10);

  const handleResetFilters = () => {
    onSearchChange('');
    onContentFilterChange('');
    onTagFilterChange('');
    onMinDepthChange(0);
    onMaxDepthChange(10);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
      {/* BENTO 1: PENCARIAN TEKS & KONTEN */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
        <SectionHeaderWithReset
          title="Pencarian & Kata Kunci"
          icon={Search}
          description="Filter instan judul, tag, dan badan catatan"
          onReset={hasActiveFilters ? handleResetFilters : undefined}
          resetTooltip="Reset semua filter pencarian"
        />

        <div className="space-y-2.5">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Search className="h-3 w-3 text-primary" /> Judul Catatan
            </span>
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari berdasarkan nama file..."
              className="h-7 text-xs bg-muted/30 focus-visible:bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-primary" /> Filter Tag
              </span>
              <Input
                value={tagFilter}
                onChange={(e) => onTagFilterChange(e.target.value)}
                placeholder="#ide, #proyek..."
                className="h-7 text-xs bg-muted/30 focus-visible:bg-background"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-primary" /> Teks Konten
              </span>
              <Input
                value={contentFilter}
                onChange={(e) => onContentFilterChange(e.target.value)}
                placeholder="Kata kunci di dalam teks..."
                className="h-7 text-xs bg-muted/30 focus-visible:bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* BENTO 2: FILTER KEDALAMAN HIERARKI (DEPTH) */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
        <SectionHeaderWithReset
          title="Filter Kedalaman (Hierarchy Depth)"
          icon={Sliders}
          description="Batasi jarak relasi cabang graf yang divisualisasikan"
        />

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Rentang Level Ditampilkan</span>
            <span className="font-mono text-[10px] rounded bg-muted/80 px-2 py-0.5 font-semibold text-foreground">
              Level {minDepth} s/d Level {maxDepth}
            </span>
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
            className="py-1 cursor-pointer"
          />

          {/* Quick Depth Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground shrink-0">Preset Cepat:</span>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-[9px]"
                onClick={() => { onMinDepthChange(0); onMaxDepthChange(1); }}
              >
                Root Saja (0-1)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-[9px]"
                onClick={() => { onMinDepthChange(0); onMaxDepthChange(3); }}
              >
                Dangkal (0-3)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-[9px]"
                onClick={() => { onMinDepthChange(0); onMaxDepthChange(10); }}
              >
                Semua (0-10)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}