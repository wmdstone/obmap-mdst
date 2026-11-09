Pilihan arsitektur yang sangat tepat. Alternatif 1 (Domain-Driven Modular Architecture) adalah standar emas untuk aplikasi kompleks setingkat Obsidian/Notion/Excalidraw, di mana setiap domain bisnis memiliki batas tanggung jawab (bounded context) yang tegas, mandiri, dan mudah di-maintain.

Berikut adalah blueprint lengkap: Mental Model Tree, Kriteria & Aturan Direktori, Katalog Mapping Pemindahan File, dan Strategi Bertahap (Phase-by-Phase) Zero-Error.

---

1. Tree Mental Model & Kriteria Folder

Arsitektur baru membagi `src/` ke dalam 4 lapis hierarki yang memiliki aturan tegas:

```text
src/
├── app/                  # [Lapis 1] Application Shell: Bootstrapping, routing, global providers
├── domains/              # [Lapis 2] Core Business Domains (Bounded Contexts)
│   ├── auth/             # Autentikasi, user session, guarded routes
│   ├── vault/            # Engine storage, SQLite/IndexedDB, backup, multi-vault
│   ├── workspace/        # Golden Layout leaf/tabs, ribbon, status bar, explorer tree
│   ├── graph/            # 2D/3D Force graph, layout algorithms, canvas rendering
│   ├── editor/           # CodeMirror 6 engine, markdown live-preview, syntax trees
│   ├── metadata/         # Frontmatter, wikilinks indexing, Aho-Corasick tag scanner
│   ├── sync/             # Offline persistence, background sync, PWA lifecycle
│   └── settings/         # Settings hub, configuration panels, key management
├── shared/               # [Lapis 3] Pure Technical Infrastructure (100% Bebas Logika Bisnis)
│   ├── ui/               # Radix + Tailwind primitive components (shadcn/ui)
│   ├── hooks/            # Generic utility hooks (useMobile, useToast, useDebounce)
│   ├── lib/              # Pure mathematical/color/text functions (cn, color-engine)
│   └── events/           # Global lightweight event bus
└── integrations/         # [Lapis 4] Platform & 3rd Party Drivers (Lovable Cloud / Backend)
    └── supabase/         # Typed database client, schemas, generated models
```

Aturan Baku Kriteria (Golden Rules)
1. Domain Ownership Rule: Jika sebuah komponen, hook, store, atau type hanya digunakan oleh domain tersebut (contoh: `useGraphStore` milik domain `graph`), file tersebut wajib tinggal di dalam `domains/{nama-domain}/`. Tidak boleh diletakkan di `shared/`.
2. Kriteria `shared/` yang Bersih: `shared/` tidak boleh mengimpor apapun dari `domains/` atau `app/`. Isinya murni UI primitives (button, dialog) dan fungsi utilitas murni.
3. Struktur Seragam Setiap Domain: Setiap folder domain memiliki pola internal yang sama:
   - `components/` — UI komponen milik domain tersebut.
   - `hooks/` — React hooks milik domain tersebut.
   - `stores/` — Zustand store milik domain tersebut.
   - `services/` atau `model/` — Pure class / engine / algorithm tanpa ketergantungan UI.
   - `types.ts` — Interface dan types domain.
   - `index.ts` — Public API (hanya mengekspor yang boleh diakses modul lain).

---

2. Katalog Mapping Pemindahan & Rename File

Berikut adalah peta pergeseran dari struktur lama (`src/core/*` dan `src/shared/stores/*`) ke struktur baru:

A. Domain `domains/auth/`
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/shell/auth/*` | `src/domains/auth/*` | `useAuth`, `AuthForm`, `ProtectedRoute`, `devAuth` |
| `src/pages/Auth.tsx` | Tetap / diarahkan ke `src/domains/auth/components/AuthPage.tsx` | Entry page auth |

B. Domain `domains/vault/` (Penggabungan `vault` + `persistence` + `import-export`)
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/system/vault/VaultManager.ts` | `src/domains/vault/services/VaultManager.ts` | Core vault engine |
| `src/core/system/vault/VaultManagerSingleton.ts` | `src/domains/vault/services/VaultManagerSingleton.ts` | Singleton instance |
| `src/core/system/vault/drivers/*` | `src/domains/vault/drivers/*` | IndexedDB & Storage driver |
| `src/core/system/persistence/*` | `src/domains/vault/services/persistence/*` | FileSystemService, directoryHandle |
| `src/core/system/import-export/*` | `src/domains/vault/services/import-export/*` | Zip & Markdown import/export |
| `src/shared/stores/useVaultStore.ts` | `src/domains/vault/stores/useVaultStore.ts` | Store vault aktif |
| `src/shared/stores/useBackupConfigStore.ts` | `src/domains/vault/stores/useBackupConfigStore.ts` | Store backup config |

C. Domain `domains/workspace/` (Shell UI, Leafs, Navigation, Tree)
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/shell/workspace/WorkspaceRoot.tsx` | `src/domains/workspace/WorkspaceRoot.tsx` | Root workspace shell |
| `src/core/shell/workspace/views/*` | `src/domains/workspace/views/` | `GraphLeaf`, `MarkdownLeaf`, `EmptyLeaf`, dll. |
| `src/core/shell/workspace/sidebar/*` | `src/domains/workspace/sidebar/` | `FileExplorerTree`, `ExplorerContextMenu` |
| `src/core/shell/workspace/Ribbon.tsx` | `src/domains/workspace/components/Ribbon.tsx` | Ribbon toolbar |
| `src/core/shell/workspace/StatusBar.tsx` | `src/domains/workspace/components/StatusBar.tsx` | Bottom status bar |
| `src/core/shell/workspace/services/vaultSessionActions.ts` | `src/domains/workspace/actions/workspaceActions.ts` | Rename lebih representatif |
| `src/core/shell/workspace/store/useWorkspaceStore.ts` | `src/domains/workspace/stores/useWorkspaceStore.ts` | Workspace layout store |
| `src/shared/stores/useUIStore.ts` | `src/domains/workspace/stores/useUIStore.ts` | Sidebar & modal UI store |

D. Domain `domains/graph/` (Graph Visualization & Layouts)
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/graph/GraphCanvas.tsx` | `src/domains/graph/components/GraphCanvas.tsx` | Canvas canvas rendering |
| `src/core/graph/layout/*` | `src/domains/graph/layout/*` | Fishbone, Mindmap, Timeline, dll. |
| `src/core/graph/render/*` | `src/domains/graph/render/*` | Node/Link/Atmosphere drawing |
| `src/core/graph/hooks/*` | `src/domains/graph/hooks/*` | `useGraphData`, `useCanvasAtmosphere`, dll. |
| `src/shared/stores/useGraphStore.ts` | `src/domains/graph/stores/useGraphStore.ts` | Core graph state |
| `src/shared/stores/useGraphEngineStore.ts` | `src/domains/graph/stores/useGraphEngineStore.ts` | Layout engine state |
| `src/shared/stores/useGraphTemplatesStore.ts` | `src/domains/graph/stores/useGraphTemplatesStore.ts` | Graph templates |
| `src/shared/stores/useNodeStore.ts` | `src/domains/graph/stores/useNodeStore.ts` | Nodes & links collections |

E. Domain `domains/editor/` (CodeMirror & Markdown)
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/editor/cm/*` | `src/domains/editor/cm/*` | Setup CodeMirror, extensions, state |
| `src/core/editor/MarkdownView.tsx` | `src/domains/editor/components/MarkdownView.tsx` | Markdown editor view |
| `src/core/editor/frontmatter/*` | `src/domains/editor/frontmatter/*` | Properties panel, frontmatter parser |
| `src/shared/stores/useEditorSettingsStore.ts` | `src/domains/editor/stores/useEditorSettingsStore.ts` | Editor settings store |

F. Domain `domains/metadata/`
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/system/metadata/*` | `src/domains/metadata/*` | Aho-Corasick, Wikilinks indexer, worker |
| `src/core/shell/workspace/backlinks/*` | `src/domains/metadata/backlinks/*` | UnlinkedMentions, BacklinksView |

G. Domain `domains/sync/` (Sync & PWA)
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/system/sync/*` | `src/domains/sync/*` | SyncCoordinator, SyncEngine |
| `src/shared/stores/useOfflineStore.ts` | `src/domains/sync/stores/useOfflineStore.ts` | Offline status store |
| `src/shared/components/PWAInstallPrompt.tsx` | `Hapus duplikat` | Satukan di `src/domains/sync/components/` |

H. Domain `domains/settings/`
| File Asal | File Tujuan | Keterangan |
| :--- | :--- | :--- |
| `src/core/shell/settings/*` | `src/domains/settings/*` | SettingsHub, sections |
| `src/core/shell/profile/*` | `src/domains/settings/profile/*` | ProfileSettings, ApiKeyManager |
| `src/core/shell/command-palette/*` | `src/domains/settings/palette/*` | CommandPalette |
| `src/shared/stores/useThemeStore.ts` | `src/domains/settings/stores/useThemeStore.ts` | Theme store |

---

3. Strategi Rahasia "Zero-Error" (The Re-Export Facade Bridge)

Agar saat kita memindahkan file, ratusan baris import di seluruh proyek tidak langsung patah (broken build), kita menerapkan Facade Re-export Bridge:

1. Pindahkan file fisik ke folder baru (`src/domains/...`).
2. Di lokasi lama (`src/shared/stores/...` atau `src/core/...`), tinggalkan satu baris file bridge:
   ```ts
   // src/shared/stores/useNodeStore.ts (Bridge sementara)
   export * from '@/domains/graph/stores/useNodeStore';
   ```
3. Jalankan `npm run test` & `npm run build` -> Pasti 100% Passed karena file lama masih ada dan berfungsi normal.
4. Lakukan migrasi import path konsumen secara bertahap.
5. Setelah semua import beralih, hapus file bridge lama dengan aman.

---

4. Roadmap Eksekusi Bertahap (Phase-by-Phase Plan)

Kita membagi eksekusi ini ke dalam 6 fase independen:

- Fase R1: Migrasi Domain Auth & Relokasi Global Stores
  - Buat `src/domains/auth/` dan `src/domains/settings/stores/useThemeStore.ts`.
  - Pindahkan `useThemeStore`, `useStatusNoticeStore`, `useOfflineStore` ke domain masing-masing dengan bridge.
  - Verifikasi: `npm run test` & `npm run build`.

- Fase R2: Domain Editor & Metadata Extraction
  - Pindahkan `src/core/editor/` -> `src/domains/editor/`.
  - Pindahkan `src/shared/stores/useEditorSettingsStore.ts` -> `src/domains/editor/stores/`.
  - Pindahkan `src/core/system/metadata/` -> `src/domains/metadata/`.
  - Verifikasi: `npm run test` & `npm run build`.

- Fase R3: Domain Graph Extraction
  - Pindahkan seluruh `src/core/graph/` -> `src/domains/graph/`.
  - Pindahkan `useGraphStore`, `useNodeStore`, `useGraphEngineStore`, `useGraphTemplatesStore` ke `src/domains/graph/stores/`.
  - Pasang bridge di `src/shared/stores/` agar konsumen tidak error.
  - Verifikasi: `npm run test` (11 suites / 98 tests) & `npm run build`.

- Fase R4: Domain Vault & Storage Engine Consolidation
  - Pindahkan `src/core/system/vault/`, `persistence/`, dan `import-export/` -> `src/domains/vault/`.
  - Pindahkan `useVaultStore`, `useBackupConfigStore` -> `src/domains/vault/stores/`.
  - Bersihkan duplikat `EventDebugPanel.tsx` dan `PWAInstallPrompt.tsx`.
  - Verifikasi: `npm run test` & `npm run build`.

- Fase R5: Domain Workspace & Shell Consolidation
  - Pindahkan `src/core/shell/workspace/` -> `src/domains/workspace/`.
  - Rename `vaultSessionActions.ts` menjadi `workspaceActions.ts`.
  - Reorganisasi `SidebarPanel`, `Ribbon`, `StatusBar`, dan leaf views.
  - Verifikasi: `npm run test` & `npm run build`.

- Fase R6: App Layer, Router Cleanup, dan Penghapusan Bridge Files
  - Rapikan `src/app/` dan `src/App.tsx`.
  - Update `AGENTS.md` dan `roadmap.md` dengan arsitektur domain baru.
  - Hapus seluruh folder `src/core/` dan file bridge lama yang sudah tidak digunakan.
  - Final full verification test & build.

---

Jika rencana dan tahapan ini sudah sesuai dengan ekspektasi Anda, kita bisa langsung mulai dengan Fase R1 (Setup domain `auth` dan pemindahan batch store pertama). Siap kita jalankan?