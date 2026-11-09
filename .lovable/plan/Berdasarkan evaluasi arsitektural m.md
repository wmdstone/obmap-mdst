Berdasarkan evaluasi arsitektural mendalam terhadap seluruh struktur direktori dan file-file `src/` (termasuk verifikasi terhadap 64 unit test yang saat ini sudah berjalan), berikut adalah Laporan Penilaian Senior Architect, diagnosis skala kesehatan, pembedahan file monster (>700 lines), serta rekomendasi refaktorisasi berbasis Refactoring Catalog.

---

1. Skala Kesehatan & Skala Profesionalitas Codebase

| Dimensi | Skor (Skala 1–10) | Status | Evaluasi Architect |
|---|:---:|:---:|---|
| Domain & Vision | 9.0 / 10 | World-Class | `PHILOSOPHY.md` sangat kuat, konsep vault-as-execution-context, dual-vault (Native FS vs In-Memory), dan mathematical graph layouts (fishbone, mindmap, timeline) sangat jelas. |
| Directory Skeleton | 8.0 / 10 | Mature Skeleton | Pemisahan ke `core/`, `shared/`, `app/`, `integrations/`, `pages/` sudah tepat. Tidak ada Lovable flat-folder spaghetti. |
| Testing Foundation | 6.5 / 10 | Improving | Ada 64 test lulus (100% pass) untuk algoritma layout, traversal, dan drag-reparenting. Namun, zero test untuk `VaultManager`, `ImportExportService`, dan Zustand stores. |
| Component Size & Purity | 4.0 / 10 | High Debt | 7 file melebihi 700 lines, bahkan ada yang tembus 1.430 lines. UI bercampur dengan business logic dan state derivation. |
| State & Data Boundaries | 5.5 / 10 | Fragile | Terdapat dual source of truth antara `VaultSessionContext.tsx` (692 lines) dengan Zustand stores (`useNodeStore`, `useGraphStore`, `useVaultStore`). |
| Skala Kesehatan Keseluruhan | 6.5 / 10 | B- (Transitional) | Siap bertransformasi ke level Production-Hardened Engine. |
| Skala Profesionalitas | 7.0 / 10 | Upper Mid-Level | Jauh di atas rata-rata template/AI app, namun butuh hygiene refactoring agar aman di-maintain jangka panjang. |

---

2. Apakah File > 700 Lines Itu Wajar?

Jawaban tegas: Tidak wajar untuk UI Components, namun bisa dimaklumi secara bersyarat pada Core Algorithms / Domain Engine.

 Dalam Clean Architecture, file UI component (`.tsx`) yang ideal berada di kisaran 120–250 baris. Jika melebihi 400 baris, hampir pasti component tersebut melanggar Single Responsibility Principle (SRP) dan mengalami Divergent Change*.
 File service/domain (`.ts`) bisa mencapai 400–600 baris jika menangani serialisasi kompleks atau state machine. Tetapi jika mencapai 800 baris, ia sudah menjadi God Object yang sulit diuji secara terisolasi (unit testable*).

---

3. Diagnosis Terhadap 7 File Raksasa (> 700 Lines)

Berikut identifikasi Code Smell konkret dan strategi dekomposisinya:

① `src/core/graph/GraphWorkspaceControls.tsx` (1.431 lines)
 Code Smells: God Component, Divergent Change, Feature Envy*.
* Diagnosis: Komponen ini memegang segalanya: Floating Zoom Toolbar, Search filter, Color Engine picker, Atmosphere toggles, Node Shape selectors, Link Styler, Export button, hingga template save/load preset. Jika ada perubahan styling pada slider warna, file ini diedit. Jika ada perubahan logika zoom, file ini juga diedit.
* Dekomposisi yang Harus Dilakukan:
  - `FloatingZoomControls.tsx` (~90 lines): Fit, Reset, Zoom In/Out, Dynamic Expand.
  - `FloatingMinimapWidget.tsx` (~110 lines): MiniMap wrapper + Level badges.
  - `FloatingGearContainer.tsx` (~130 lines): Horizontal scroll trigger & icon strip.
  - Extract Panels: Pecah active panels ke sub-folder `src/core/graph/controls/panels/` (`SearchPanel.tsx`, `AppearancePanel.tsx`, `AtmospherePanel.tsx`). File utama cukup menjadi orkestrator komposisi (~120 lines).

② `src/core/graph/GraphCanvas.tsx` (954 lines)
 Code Smells: Large Class, Mixed Abstraction Levels*.
* Diagnosis: Menyatukan render canvas loop (`ForceGraph2D`), canvas frame clearing, drag-to-reparent math, particle physics calculation, gesture zoom synchronization, dan node selection highlight.
* Dekomposisi yang Harus Dilakukan:
  - `useCanvasGestureBridge.ts` (Hook): Menangani ref forwarding, auto-zoom to bounds, dan hover coordinate debounce.
  - `useCanvasParticleLoop.ts` (Hook): Logika `onRenderFramePre` dan particle physics simulation.
  - `useCanvasDragReparent.ts` (Hook): Logika drag hover node, distance threshold, dan reparent candidate preview.

③ `src/core/shell/workspace/SidebarPanel.tsx` (890 lines)
 Code Smells: Shotgun Surgery, God View Container*.
* Diagnosis: Menyimpan tree-folder visual, file search, inline tag search, folder renaming, context menu modal, drag and drop visual styles, serta switch rendering untuk Settings panel.
* Dekomposisi yang Harus Dilakukan:
  - `FileExplorerTree.tsx`: Khusus recursive folder/file tree rendering.
  - `ExplorerContextMenu.tsx`: Dialog dan dropdown aksi (Rename, Delete, New Note, New Folder).
  - `useFolderNavigation.ts`: Custom hook untuk collapsible folder ID, active tree expansion, dan breadcrumb sync.

④ `src/core/graph/NodePanel.tsx` (828 lines)
 Code Smells: Divergent Change, Data Clumps*.
* Diagnosis: Berperan ganda sebagai: Media Player (Audio player bar + Video player + Image lightbox), Breadcrumb navigation builder, Tag adder, Backlinks list renderer, Metadata inspector, dan Editor container.
* Dekomposisi yang Harus Dilakukan:
  - `NodeMediaPreview.tsx` (~140 lines): Komponen murni audio/video/image handling.
  - `NodeBreadcrumbBar.tsx` (~90 lines): Menghitung path dan handle folder navigation.
  - `NodeBacklinksSection.tsx` (~120 lines): Tampilan referensi link masuk.

⑤ `src/core/system/import-export/services/ImportExportService.ts` (824 lines)
 Code Smells: Primitive Obsession, Large Class*.
* Diagnosis: Satu class menangani Unzipping JSZip, binary chunking media (audio/video/image), parsing frontmatter, folder path deduction, JSON schema validation, dan batch node creation.
* Dekomposisi yang Harus Dilakukan:
  - `ZipArchiveProcessor.ts`: Pure ZIP unpacker dan directory-tree serializer.
  - `MediaAssetExtractor.ts`: Handler MIME-types, dataUrl conversion, dan storage quota check.
  - `MarkdownNoteImporter.ts`: Ekstraksi title, wikilinks, dan frontmatter.

⑥ `src/core/system/vault/VaultManager.ts` (791 lines)
 Code Smells: Divergent Change, Leaky Abstraction*.
* Diagnosis: Menyatukan operasi Native File System Access API (Chromium), IndexedDB fallback, LocalStorage pointer, Cloud vault synchronization trigger, dan repair cycle jika metadata corrupted.
* Dekomposisi yang Harus Dilakukan:
  - Pisahkan menjadi Strategy Pattern: `NativeFsVaultDriver.ts` vs `IndexedDbVaultDriver.ts` yang mengimplementasikan satu interface `IVaultStorageDriver`. `VaultManager` cukup menjadi context switcher murni (~180 lines).

⑦ `src/core/shell/workspace/VaultSessionContext.tsx` (692 lines)
 Code Smells: Dual Sources of Truth*.
* Diagnosis: File ini membuat React Context yang menduplikasi state yang sebenarnya sudah ada di Zustand (`useNodeStore`, `useGraphStore`, `useVaultStore`), lalu membuat method wrapper berulang (`createNode`, `deleteNode`, `saveNodeContent`).
* Langkah Arsitektur: Deprecate & Sentralisasi langsung ke Zustand store actions atau domain service hooks. Tidak perlu ada 2 layer state management yang saling membungkus.

---

4. Modul yang Perlu Disentralisasi vs Dipecah

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   ARSITEKTUR REFAKTORISASI                             │
├──────────────────────────────────┬─────────────────────────────────────┤
│   HARUS DIPERIKSA & DIPINDAH     │      HARUS DISENTRALISASI           │
│         (DECOMPOSITION)          │        (CENTRALIZATION)             │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 1. GraphWorkspaceControls.tsx    │ 1. Event Bus Decoupling             │
│    -> Split panels & toolbars    │    -> Gunakan DomainEvents alih2    │
│ 2. NodePanel.tsx                 │       passing prop callbacks.       │
│    -> Media / Breadcrumb / Links │ 2. Vault Session State              │
│ 3. SidebarPanel.tsx              │    -> Satukan ke Zustand store,     │
│    -> Tree vs ContextMenu        │       hapus wrapper React Context.  │
│ 4. ImportExportService.ts        │ 3. Color & Token Resolver           │
│    -> Zip vs Media vs Note Import│    -> Sentralisasi color-utils &    │
│ 5. VaultManager.ts               │       CSS var theme mapper.         │
│    -> Extract Driver Strategies  │ 4. Path & Hierarchy Traverser       │
│                                  │    -> Jadikan pure domain util.     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

Modul yang Perlu Sentralisasi (Penyatuan Titik Kebenaran):
1. Event Bus (`src/shared/events/events.ts`):
   Saat ini event bus sudah dibuat rapi (336 lines), tetapi jarang dipakai oleh UI. UI masih memanggil callback langsung secara berantai (props drilling). Saat node dibuat atau diedit, cukup trigger `eventBus.emit('node:updated', payload)`.
2. Hierarchy & Breadcrumb Traversal:
   Logika menghitung rantai parent-folder tersebar di `SidebarPanel.tsx`, `NodePanel.tsx`, dan `traversal.ts`. Harus disentralisasi ke satu modul domain murni: `src/core/graph/model/hierarchyTraversal.ts`.
3. Color Resolution Engine:
   Logika parsing HEX, HSL, CSS variable `hsl(var(--...))` masih tersebar antara `hierarchyColors.ts`, `ColorEngineControls.tsx`, dan `drawNode.ts`. Harus dipusatkan ke `src/shared/lib/color-engine.ts`.

---

5. Rekomendasi "Smallest Valuable Step" (Langkah Terkecil Bernilai Tinggi)

Mengikuti prinsip "Never do a massive rewrite that halts feature delivery", berikut urutan tahapan yang aman dan terukur:

1. Step 1: Dekomposisi UI Terbesar (`GraphWorkspaceControls.tsx`)
   - Buat subdirektori `src/core/graph/controls/`.
   - Ekstrak floating zoom bar & minimap group tanpa merubah interface luarnya.
   - Efek: File dari 1.430 lines turun menjadi < 200 lines. Render performance meningkat drastis.

2. Step 2: Menghapus Dual Source of Truth (`VaultSessionContext.tsx`)
   - Alihkan pemanggilan komponen yang membaca `useVaultSession()` langsung ke selector Zustand: `useNodeStore(s => s.nodes)` dan `useVaultStore(s => s.activeVault)`.
   - Hilangkan 692 baris overhead React context wrapper.

3. Step 3: Characterization Tests untuk `VaultManager` & `ImportExportService`
   - Sebelum memecah `VaultManager.ts`, tulis characterization tests untuk fungsi vital: create in-memory vault, save markdown, export zip.
   - Jalankan via `bun test` untuk mengunci perilaku sebelum ekstraksi storage driver.

4. Step 4: Pemecahan `NodePanel.tsx` (Media vs Metadata vs Backlinks)
   - Ekstrak `MediaPreview` dan `Breadcrumbs` menjadi komponen independen.

---

Kesimpulan Diskusi

Codebase Anda bukan spaghetti. Kualitas pondasi, algoritma graf, dan konsep vault lokalnya berada di level Top 10% aplikasi indie/SaaS produktivitas. 

Masalah utama saat ini hanyalah akumulasi tanggung jawab (Feature Bloat) di beberapa komponen UI kunci. Dengan memecah 4 komponen UI utama (`GraphWorkspaceControls`, `NodePanel`, `SidebarPanel`, `GraphCanvas`) dan menyatukan titik kebenaran state ke Zustand + Event Bus, codebase ini akan naik kelas dari transitional menjadi enterprise-grade architecture yang sangat mudah dirawat.

Bagian mana yang paling ingin Anda prioritaskan untuk dibahas lebih rinci atau dieksekusi strateginya terlebih dahulu?