export type ModuleCategory = 'system' | 'shell' | 'workspace' | 'editor' | 'graph' | 'settings' | 'plugin';

export interface ModuleDefinition {
  id: string;
  name: string;
  friendlyMessage: string;
  category: ModuleCategory;
  loader: () => Promise<unknown>;
  warmup?: (moduleExport: unknown) => Promise<void> | void;
  priority?: number;
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
  currentMessage: string;
  currentCategory: ModuleCategory;
  currentStage: 'resolving' | 'evaluating' | 'warming' | 'ready';
  overallPercent: number; // 0 - 100%
  currentModulePercent: number;
  completed: LoadedModuleRecord[];
  slowestModule: LoadedModuleRecord | null;
  heaviestModule: LoadedModuleRecord | null;
  isComplete: boolean;
}

// ============================================================================
// DYNAMIC MODULE REGISTRY & DEEP WARMERS
// ============================================================================

class DynamicPreloadRegistry {
  private modulesMap = new Map<string, ModuleDefinition>();

  constructor() {
    this.registerDefaults();
  }

  public register(module: ModuleDefinition): void {
    this.modulesMap.set(module.id, module);
  }

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
      // --- SYSTEM & MEMORY CACHE ---
      {
        id: 'sys-di',
        name: 'DI Container & Event Bus',
        friendlyMessage: 'Menghubungkan bus event sistem & service locator...',
        category: 'system',
        priority: 15,
        loader: () => import('@/shared/di/container'),
      },
      {
        id: 'sys-vault-mgr',
        name: 'Vault Storage & Active Database',
        friendlyMessage: 'Membuka basis data IndexedDB & memulihkan vault aktif...',
        category: 'system',
        priority: 14,
        loader: () => import('@/domains/vault/services/VaultManagerSingleton'),
        warmup: async (mod: any) => {
          // Pre-warm: Buka IndexedDB dan hydrate data vault langsung ke memori
          const vaultManager = mod.getVaultManager();
          await vaultManager.initialize();
        },
      },
      {
        id: 'sys-fs',
        name: 'File System & Persistence Service',
        friendlyMessage: 'Menyiapkan driver persistence & storage bridge...',
        category: 'system',
        priority: 12,
        loader: () => import('@/domains/vault/persistence/FileSystemServiceSingleton'),
      },
      {
        id: 'sys-meta',
        name: 'Metadata Cache & Note Indexer',
        friendlyMessage: 'Mengindeks tautan wikilink, tag, dan metadata catatan di RAM...',
        category: 'system',
        priority: 11,
        loader: () => import('@/domains/metadata/MetadataCache'),
        warmup: async (mod: any) => {
          // Pre-warm: Dapatkan node aktif dan jalankan indexing awal di RAM
          try {
            const { getVaultManager } = await import('@/domains/vault/services/VaultManagerSingleton');
            const activeVault = getVaultManager().getActiveVault();
            if (activeVault) {
              const nodes = activeVault.graphService.getGraphData().nodes;
              if (nodes && nodes.length > 0) {
                mod.metadataCache.index(nodes);
              }
            }
          } catch (e) {
            console.warn('[Preload Warmup] Metadata cache indexing warning:', e);
          }
        },
      },
      {
        id: 'sys-sync',
        name: 'Sync Engine & Conflict Coordinator',
        friendlyMessage: 'Menyiapkan sinkronisasi offline-first...',
        category: 'system',
        priority: 10,
        loader: () => import('@/domains/sync/SyncEngine'),
      },

      // --- SHELL & NAVIGATION ---
      {
        id: 'shell-ribbon',
        name: 'Activity Ribbon Navigation',
        friendlyMessage: 'Menyiapkan navigasi samping & bilah aksi...',
        category: 'shell',
        loader: () => import('@/domains/workspace/components/Ribbon'),
      },
      {
        id: 'shell-sidebar',
        name: 'Vault Explorer & File Tree',
        friendlyMessage: 'Menyiapkan penjelajah hierarki file vault...',
        category: 'shell',
        loader: () => import('@/domains/workspace/components/SidebarPanel'),
      },
      {
        id: 'shell-statusbar',
        name: 'System Status & Breadcrumbs',
        friendlyMessage: 'Menginisialisasi status bar & diagnostik...',
        category: 'shell',
        loader: () => import('@/domains/workspace/components/StatusBar'),
      },
      {
        id: 'shell-palette',
        name: 'Fuzzy Command Palette',
        friendlyMessage: 'Menyiapkan mesin pencarian instan palette...',
        category: 'shell',
        loader: () => import('@/domains/settings/command-palette/CommandPalette'),
      },
      {
        id: 'shell-auth',
        name: 'Auth & Session Provider',
        friendlyMessage: 'Menyiapkan status otentikasi akun...',
        category: 'shell',
        loader: () => import('@/domains/auth/hooks/useAuth'),
      },

      // --- WORKSPACE LEAF VIEWS ---
      {
        id: 'ws-tree',
        name: 'Workspace Split Layout Engine',
        friendlyMessage: 'Menyiapkan manajemen tata letak panel...',
        category: 'workspace',
        loader: () => import('@/domains/workspace/components/WorkspaceTree'),
      },
      {
        id: 'ws-group',
        name: 'Tab Group & Keep-Alive Manager',
        friendlyMessage: 'Menyiapkan tab container & keep-alive buffer...',
        category: 'workspace',
        loader: () => import('@/domains/workspace/components/WorkspaceGroup'),
      },
      {
        id: 'ws-leaf-markdown',
        name: 'Markdown Note Leaf',
        friendlyMessage: 'Memuat modul tampilan dokumen catatan...',
        category: 'workspace',
        loader: () => import('@/domains/workspace/views/MarkdownLeaf'),
      },
      {
        id: 'ws-leaf-graph',
        name: 'Graph Visualization Leaf',
        friendlyMessage: 'Memuat modul visualisasi graf interaktif...',
        category: 'workspace',
        loader: () => import('@/domains/workspace/views/GraphLeaf'),
      },
      {
        id: 'ws-leaf-backlinks',
        name: 'Backlinks & Mentions Leaf',
        friendlyMessage: 'Memuat modul penjelajah relasi backlinks...',
        category: 'workspace',
        loader: () => import('@/domains/workspace/views/BacklinksLeaf'),
      },

      // --- CODE EDITOR & COMPILERS ---
      {
        id: 'ed-cm-core',
        name: 'CodeMirror 6 & Lezer Parser',
        friendlyMessage: 'Mengompilasi parser Markdown & syntax highlighter...',
        category: 'editor',
        priority: 10,
        loader: () => import('@/domains/editor/cm/setup'),
        warmup: async () => {
          // Pre-warm: Kompilasi Lezer grammar di V8 JIT engine tanpa mount DOM
          try {
            const { EditorState } = await import('@codemirror/state');
            const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown');
            EditorState.create({
              doc: '# Warmup Note',
              extensions: [markdown({ base: markdownLanguage })],
            });
          } catch (e) {
            console.warn('[Preload Warmup] CodeMirror pre-warm warning:', e);
          }
        },
      },
      {
        id: 'ed-markdown-view',
        name: 'Markdown Live Preview Engine',
        friendlyMessage: 'Menyiapkan render live-preview Markdown...',
        category: 'editor',
        loader: () => import('@/domains/editor/components/MarkdownView'),
      },
      {
        id: 'ed-suggest',
        name: 'Wikilink & Tag Autocomplete',
        friendlyMessage: 'Mengindeks kamus autocomplete wikilink & tag...',
        category: 'editor',
        loader: () => import('@/domains/editor/suggest/suggestions'),
      },

      // --- GRAPH & GPU ACCELERATION ---
      {
        id: 'graph-canvas',
        name: 'Canvas 2D & GPU Force Engine',
        friendlyMessage: 'Memanaskan GPU context & akselerasi Canvas...',
        category: 'graph',
        priority: 11,
        loader: () => import('@/domains/graph/components/GraphCanvas'),
        warmup: async () => {
          // Pre-warm: Inisialisasi test canvas context untuk priming pipeline GPU
          if (typeof document !== 'undefined') {
            try {
              const testCanvas = document.createElement('canvas');
              testCanvas.width = 16;
              testCanvas.height = 16;
              const ctx2d = testCanvas.getContext('2d');
              if (ctx2d) {
                ctx2d.fillStyle = 'rgba(0,0,0,0.1)';
                ctx2d.fillRect(0, 0, 16, 16);
              }
              const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
              if (gl) {
                (gl as WebGLRenderingContext).clearColor(0, 0, 0, 1);
              }
            } catch (e) {
              console.warn('[Preload Warmup] GPU Canvas context priming warning:', e);
            }
          }
        },
      },
      {
        id: 'graph-layouts',
        name: 'Hierarchical Layout Engine',
        friendlyMessage: 'Menyiapkan algoritma layout Mindmap & Radial...',
        category: 'graph',
        loader: () => import('@/domains/graph/shared/hooks/useLayoutEngine'),
      },
      {
        id: 'graph-projection',
        name: 'Graph Topology & Projection Model',
        friendlyMessage: 'Mengompilasi model proyeksi hierarki & filter...',
        category: 'graph',
        loader: () => import('@/domains/graph/shared/utils/buildGraphProjection'),
      },
      {
        id: 'graph-controls',
        name: 'Graph Controls & Atmospheric Panels',
        friendlyMessage: 'Menyiapkan bilah pengaturan kamera & efek graf...',
        category: 'graph',
        loader: () => import('@/domains/graph/components/GraphWorkspaceControls'),
      },

      // --- ASSETS & TYPOGRAPHY WARMUP ---
      {
        id: 'sys-typography',
        name: 'Typography & Font Glyph Caching',
        friendlyMessage: 'Memastikan font sistem & aset tipografi siap...',
        category: 'system',
        loader: async () => {
          if (typeof document !== 'undefined' && 'fonts' in document) {
            await document.fonts.ready;
          }
          return { ready: true };
        },
      },

      // --- UNIVERSAL SETTINGS ---
      {
        id: 'set-hub',
        name: 'Settings Hub & Plugin Registry',
        friendlyMessage: 'Menyiapkan preferensi & konfigurasi aplikasi...',
        category: 'settings',
        loader: () => import('@/domains/settings/SettingsHub'),
      },
      {
        id: 'set-vault',
        name: 'Vault Storage & Backup Settings',
        friendlyMessage: 'Menyiapkan utilitas backup & konfigurasi vault...',
        category: 'settings',
        loader: () => import('@/domains/settings/sections/VaultSettings'),
      },
    ];

    this.registerBatch(defaults);
  }
}

export const preloadRegistry = new DynamicPreloadRegistry();

export function registerPreloadModule(module: ModuleDefinition) {
  preloadRegistry.register(module);
}

// ============================================================================
// HIGH-PRECISION PRELOAD RUNNER WITH DEEP WARMING
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

    const calcOverall = (subPercent: number) => {
      const exact = ((i + subPercent / 100) / total) * 100;
      return Math.round(exact * 10) / 10;
    };

    // 1. Tahap Resolving
    onProgress({
      currentIndex: i + 1,
      totalModules: total,
      currentModuleName: mod.name,
      currentMessage: mod.friendlyMessage,
      currentCategory: mod.category,
      currentStage: 'resolving',
      overallPercent: calcOverall(15),
      currentModulePercent: 15,
      completed,
      slowestModule: slowest,
      heaviestModule: heaviest,
      isComplete: false,
    });

    const resCountBefore = performance.getEntriesByType('resource').length;
    const tStart = performance.now();
    let status: 'success' | 'warn' | 'error' = 'success';

    try {
      // 2. Tahap Evaluating (Import Chunk)
      onProgress({
        currentIndex: i + 1,
        totalModules: total,
        currentModuleName: mod.name,
        currentMessage: mod.friendlyMessage,
        currentCategory: mod.category,
        currentStage: 'evaluating',
        overallPercent: calcOverall(50),
        currentModulePercent: 50,
        completed,
        slowestModule: slowest,
        heaviestModule: heaviest,
        isComplete: false,
      });

      const loadedModule = await mod.loader();

      // 3. Tahap Deep Warmup (Jika modul memiliki warming handler)
      if (mod.warmup) {
        onProgress({
          currentIndex: i + 1,
          totalModules: total,
          currentModuleName: mod.name,
          currentMessage: `${mod.friendlyMessage} (Memanaskan cache RAM...)`,
          currentCategory: mod.category,
          currentStage: 'warming',
          overallPercent: calcOverall(85),
          currentModulePercent: 85,
          completed,
          slowestModule: slowest,
          heaviestModule: heaviest,
          isComplete: false,
        });

        await mod.warmup(loadedModule);
      }

      if (!loadedModule || (typeof loadedModule === 'object' && Object.keys(loadedModule as object).length === 0)) {
        status = 'warn';
      }
    } catch (err) {
      status = 'error';
      console.warn(`[Preloader] Gagal memuat/menghangatkan modul ${mod.name}:`, err);
    }

    const tEnd = performance.now();
    const durationMs = Math.round((tEnd - tStart) * 100) / 100;

    // Kalkulasi ukuran delta dari Resource Timing
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

    // 4. Modul Selesai (100% per modul)
    const finalOverall = Math.round(((i + 1) / total) * 1000) / 10;

    onProgress({
      currentIndex: i + 1,
      totalModules: total,
      currentModuleName: mod.name,
      currentMessage: mod.friendlyMessage,
      currentCategory: mod.category,
      currentStage: 'ready',
      overallPercent: Math.min(100, finalOverall),
      currentModulePercent: 100,
      completed: [...completed],
      slowestModule: slowest,
      heaviestModule: heaviest,
      isComplete: i === total - 1,
    });

    // Jeda mikro 10ms agar event loop browser memberikan frame render UI yang mulus
    await new Promise((r) => setTimeout(r, 10));
  }

  return completed;
}
