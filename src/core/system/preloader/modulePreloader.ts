export type ModuleCategory = 'system' | 'shell' | 'workspace' | 'editor' | 'graph' | 'settings' | 'plugin';

export interface ModuleDefinition {
  id: string;
  name: string;
  category: ModuleCategory;
  loader: () => Promise<unknown>;
  priority?: number; // Modul berbobot/inti dimuat lebih awal
}

export interface LoadedModuleRecord {
  id: string;
  name: string;
  category: ModuleCategory;
  durationMs: number;
  sizeKb: number;
  status: 'success' | 'warn' | 'error';
}

export interface PreloadProgressState {
  currentIndex: number;
  totalModules: number;
  currentModuleName: string;
  currentCategory: ModuleCategory;
  currentStage: 'resolving' | 'evaluating' | 'verifying' | 'ready';
  overallPercent: number;        // Presisi 1 desimal (misal: 64.8%)
  currentModulePercent: number; // 0 - 100%
  completed: LoadedModuleRecord[];
  slowestModule: LoadedModuleRecord | null;
  heaviestModule: LoadedModuleRecord | null;
  isComplete: boolean;
}

// ============================================================================
// DYNAMIC MODULE REGISTRY
// ============================================================================

class DynamicPreloadRegistry {
  private modulesMap = new Map<string, ModuleDefinition>();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Daftarkan satu modul baru secara dinamis (misal dari plugin atau view custom)
   */
  public register(module: ModuleDefinition): void {
    this.modulesMap.set(module.id, module);
  }

  /**
   * Daftarkan sekumpulan modul sekaligus
   */
  public registerBatch(modules: ModuleDefinition[]): void {
    modules.forEach((mod) => this.register(mod));
  }

  public getModules(): ModuleDefinition[] {
    return Array.from(this.modulesMap.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  public getTotal(): number {
    return this.modulesMap.size;
  }

  private registerDefaults() {
    const defaults: ModuleDefinition[] = [
      // --- SYSTEM ---
      { id: 'sys-di', name: 'DI Container & Event Bus', category: 'system', priority: 10, loader: () => import('@/shared/di/container') },
      { id: 'sys-vault-mgr', name: 'Vault Manager Engine', category: 'system', priority: 10, loader: () => import('@/core/system/vault/VaultManagerSingleton') },
      { id: 'sys-fs', name: 'File System & Persistence Service', category: 'system', priority: 9, loader: () => import('@/core/system/persistence/FileSystemServiceSingleton') },
      { id: 'sys-sync', name: 'Sync Engine & Conflict Coordinator', category: 'system', priority: 8, loader: () => import('@/core/system/sync/SyncEngine') },
      { id: 'sys-meta', name: 'Metadata Cache & Markdown Parser', category: 'system', priority: 8, loader: () => import('@/core/system/metadata/MetadataCache') },

      // --- SHELL ---
      { id: 'shell-ribbon', name: 'Activity Ribbon & Icon Navigation', category: 'shell', loader: () => import('@/core/shell/workspace/Ribbon') },
      { id: 'shell-sidebar', name: 'Vault Explorer & Tree Panel', category: 'shell', loader: () => import('@/core/shell/workspace/SidebarPanel') },
      { id: 'shell-statusbar', name: 'System Status & Breadcrumbs', category: 'shell', loader: () => import('@/core/shell/workspace/StatusBar') },
      { id: 'shell-palette', name: 'Fuzzy Command Palette Engine', category: 'shell', loader: () => import('@/core/shell/command-palette/CommandPalette') },
      { id: 'shell-auth', name: 'Supabase Auth & Session Provider', category: 'shell', loader: () => import('@/core/shell/auth/hooks/useAuth') },

      // --- WORKSPACE ---
      { id: 'ws-tree', name: 'Workspace Split Tree & Layout', category: 'workspace', loader: () => import('@/core/shell/workspace/WorkspaceTree') },
      { id: 'ws-group', name: 'Tab Group & Keep-Alive Manager', category: 'workspace', loader: () => import('@/core/shell/workspace/WorkspaceGroup') },
      { id: 'ws-registry', name: 'Workspace View Registry', category: 'workspace', loader: () => import('@/core/shell/workspace/ViewRegistry') },
      { id: 'ws-backlinks-view', name: 'Backlinks & Unlinked Mentions Leaf', category: 'workspace', loader: () => import('@/core/shell/workspace/views/BacklinksLeaf') },
      { id: 'ws-empty', name: 'Quick Action Empty Leaf', category: 'workspace', loader: () => import('@/core/shell/workspace/views/EmptyLeaf') },

      // --- EDITOR ---
      { id: 'ed-cm-core', name: 'CodeMirror 6 Core Engine & Setup', category: 'editor', priority: 8, loader: () => import('@/core/editor/cm/setup') },
      { id: 'ed-markdown-view', name: 'Markdown Live Preview View', category: 'editor', loader: () => import('@/core/editor/MarkdownView') },
      { id: 'ed-frontmatter', name: 'YAML Frontmatter Properties Panel', category: 'editor', loader: () => import('@/core/editor/frontmatter/PropertiesPanel') },
      { id: 'ed-suggest', name: 'Wikilink & Tag Autocomplete Suggester', category: 'editor', loader: () => import('@/core/editor/suggest/suggestions') },
      { id: 'ed-heading-fold', name: 'Hierarchical Heading Folding Engine', category: 'editor', loader: () => import('@/core/editor/headings/headingTree') },

      // --- GRAPH ---
      { id: 'graph-canvas', name: 'WebGL & Canvas 2D Force Engine', category: 'graph', priority: 8, loader: () => import('@/core/graph/GraphCanvas') },
      { id: 'graph-layouts', name: 'Layout Engines (Mindmap, Timeline, Fishbone)', category: 'graph', loader: () => import('@/core/graph/layout/useLayoutEngine') },
      { id: 'graph-projection', name: 'Graph Topology & Projection Model', category: 'graph', loader: () => import('@/core/graph/model/buildGraphProjection') },
      { id: 'graph-controls', name: 'Floating Workspace Controls & Depth Filters', category: 'graph', loader: () => import('@/core/graph/GraphWorkspaceControls') },
      { id: 'graph-config', name: 'Graph Visual Styling & Engine Panel', category: 'graph', loader: () => import('@/core/graph/config-panel') },

      // --- UNIVERSAL SETTINGS ---
      { id: 'set-hub', name: 'Universal Settings Hub Modal', category: 'settings', loader: () => import('@/core/shell/settings/SettingsHub') },
      { id: 'set-vault', name: 'Per-Vault Configuration & Storage Panel', category: 'settings', loader: () => import('@/core/shell/settings/sections/VaultSettings') },
      { id: 'set-schema', name: 'Schema Definition & Properties Settings', category: 'settings', loader: () => import('@/core/shell/settings/sections/SchemaSettings') },
      { id: 'set-features', name: 'Plugin & Feature Toggles Manager', category: 'settings', loader: () => import('@/core/shell/settings/FeatureTogglesPanel') },
    ];

    this.registerBatch(defaults);
  }
}

export const preloadRegistry = new DynamicPreloadRegistry();

/**
   * Helper API untuk menambah modul dari luar file ini
   */
export function registerPreloadModule(module: ModuleDefinition) {
  preloadRegistry.register(module);
}

// ============================================================================
// HIGH-PRECISION PRELOAD RUNNER
// ============================================================================

export async function runModulePreloader(
  onProgress: (state: PreloadProgressState) => void
): Promise<LoadedModuleRecord[]> {
  const modules = preloadRegistry.getModules();
  const total = modules.length;
  const completed: LoadedModuleRecord[] = [];
  let slowest: LoadedModuleRecord | null = null;
  let heaviest: LoadedModuleRecord | null = null;

  for (let i = 0; i < total; i++) {
    const mod = modules[i];

    // Helper untuk menghitung continuous overall percent secara matematis
    const calcOverall = (subPercent: number) => {
      const exact = ((i + subPercent / 100) / total) * 100;
      return Math.round(exact * 10) / 10;
    };

    // 1. Tahap Inisialisasi Resolusi (20%)
    onProgress({
      currentIndex: i + 1,
      totalModules: total,
      currentModuleName: mod.name,
      currentCategory: mod.category,
      currentStage: 'resolving',
      overallPercent: calcOverall(20),
      currentModulePercent: 20,
      completed,
      slowestModule: slowest,
      heaviestModule: heaviest,
      isComplete: false,
    });

    // Catat resource timing snapshot sebelum modul dimuat
    const resCountBefore = performance.getEntriesByType('resource').length;
    const tStart = performance.now();
    let status: 'success' | 'warn' | 'error' = 'success';

    try {
      // 2. Tahap Fetch & Evaluasi (60%)
      onProgress({
        currentIndex: i + 1,
        totalModules: total,
        currentModuleName: mod.name,
        currentCategory: mod.category,
        currentStage: 'evaluating',
        overallPercent: calcOverall(60),
        currentModulePercent: 60,
        completed,
        slowestModule: slowest,
        heaviestModule: heaviest,
        isComplete: false,
      });

      const loadedModule = await mod.loader();

      // 3. Tahap Verifikasi Ekspor (90%)
      if (!loadedModule || (typeof loadedModule === 'object' && Object.keys(loadedModule as object).length === 0)) {
        status = 'warn';
      }

      onProgress({
        currentIndex: i + 1,
        totalModules: total,
        currentModuleName: mod.name,
        currentCategory: mod.category,
        currentStage: 'verifying',
        overallPercent: calcOverall(90),
        currentModulePercent: 90,
        completed,
        slowestModule: slowest,
        heaviestModule: heaviest,
        isComplete: false,
      });
    } catch (err) {
      status = 'error';
      console.warn(`[Preloader] Gagal memuat modul ${mod.name}:`, err);
    }

    const tEnd = performance.now();
    const durationMs = Math.round((tEnd - tStart) * 100) / 100;

    // Hitung ukuran presisi dari delta resource timing browser
    let sizeKb = 0;
    const resEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    for (let r = resCountBefore; r < resEntries.length; r++) {
      const entry = resEntries[r];
      if (entry && entry.encodedBodySize > 0) {
        sizeKb += entry.encodedBodySize / 1024;
      }
    }
    sizeKb = Math.round(sizeKb * 10) / 10;

    const record: LoadedModuleRecord = {
      id: mod.id,
      name: mod.name,
      category: mod.category,
      durationMs,
      sizeKb,
      status,
    };

    completed.push(record);

    if (!slowest || durationMs > slowest.durationMs) {
      slowest = record;
    }
    if (sizeKb > 0 && (!heaviest || (heaviest.sizeKb ?? 0) < sizeKb)) {
      heaviest = record;
    }

    // 4. Tahap Modul Siap (100%)
    const finalOverall = Math.round(((i + 1) / total) * 1000) / 10;

    onProgress({
      currentIndex: i + 1,
      totalModules: total,
      currentModuleName: mod.name,
      currentCategory: mod.category,
      currentStage: 'ready',
      overallPercent: Math.min(100, finalOverall),
      currentModulePercent: 100,
      completed: [...completed],
      slowestModule: slowest,
      heaviestModule: heaviest,
      isComplete: i === total - 1,
    });

    // Jeda mikro 8ms (1 frame tick) untuk memberi giliran rendering UI
    await new Promise((r) => setTimeout(r, 8));
  }

  return completed;
}