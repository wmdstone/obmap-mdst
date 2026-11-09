# Rencana: Dual-Mode Canvas (Graph Network + Structured Mindmap)

## Tujuan
Satu kanvas, dua mode (Graph Network & Structured Mindmap), semua opsi dipakai bersama, dibuka lewat Icon Ribbon. Fitur baru **memperluas** komponen yang sudah ada, bukan menduplikasinya.

## Kondisi app saat ini (sudah diverifikasi)
- `GraphLeaf` merender satu `GraphCanvas` (react-force-graph-2d) + `GraphWorkspaceControls` (gear flyout: search, layout, nodes, links, physics, global, template, stats).
- Store per tab: `useLeafGraphConfigStore` (tampilan: nodes, links, topology, forces, hierarchy) dan `useGraphInteractionStore` (layoutMode, orientation, highlightMode, collapsedIds, focusedRootId).
- `LayoutMode` = `mindmap | timeline | fishbone | free-force`; `orientation` = `balanced | radial`. Layout deterministik di `layout/*.ts` lewat `useLayoutEngine`.
- Drag node hanya aktif di `free-force`. Collapse via toggle `+/-` sudah ada di `drawNode` (`RenderNode.toggle`).
- Pemindahan file sudah ada: `VaultSessionContext.onNodeMove(nodeId, newParentId)` (dipakai File Explorer).
- Warna: `nodes.autoColorBy = none | type | depth | tags`, `hierarchy` (HierarchyColorControls: preset, level, overflow, linkColorMode), glow (`glow`, `glowIntensity`, `glowSpeed`).
- Icon Ribbon: File Explorer, Open Graph View (⌘G), Settings. `ViewType` belum punya mode mindmap.

## Aturan integrasi (anti-konflik, anti-duplikat)
1. **Tidak ada store baru untuk tampilan.** Semua opsi baru masuk ke `GraphConfigState` / interaction store yang sudah ada, dengan default aman lewat `mergeGraphConfig` dan naik `GRAPH_CONFIG_VERSION`.
2. **Tidak ada view baru.** Mode adalah properti tab graph (`canvasMode: 'graph' | 'mindmap'`), bukan `ViewType` terpisah. Satu `GraphLeaf`, satu `GraphCanvas`.
3. **Tidak ada pill/segmented switcher di kanvas.** Peralihan mode hanya via Icon Ribbon + shortcut.
4. **Warna tetap satu selektor.** `autoColorBy` diperluas dengan `branch`; tidak ada panel warna kedua. Glow tetap layer efek di atas mode warna apa pun.
5. **Pemindahan file hanya lewat `onNodeMove`.** Kanvas tidak menulis file sendiri.
6. **Collapse memakai `collapsedIds` + toggle existing**, hanya visualnya diperbagus (badge `+N`).
7. **Gear flyout tetap satu**; tab Layout menampilkan pilihan sesuai mode aktif. Semua tab lain identik di kedua mode.

## Tahapan

### Tahap 1 — Mode kanvas & Icon Ribbon
- Tambah `canvasMode` di interaction store per tab (persist bersama layout terakhir per mode: `lastGraphLayout`, `lastMindmapLayout`).
- Icon Ribbon: ikon "Open Graph View" (⌘G) tetap; tambah ikon Mindmap (`GitBranch`, ⌘M). Keduanya: fokus tab graph aktif dan set mode; jika tidak ada tab, buka tab baru dengan mode itu. Judul tab mengikuti mode.
- Gear → tab Layout: daftar algoritma Graph saat mode graph, 5 layout struktural saat mode mindmap.
- Migrasi: `free-force` lama → mode graph; `mindmap/timeline/fishbone` lama → mode mindmap.
- Template yang ada tetap berlaku (menyimpan config + layout + mode).

### Tahap 2 — Layout Graph Network
- `LayoutMode` graph: `free-force` (existing), `fr-standard`, `fr-radial`, `kamada-kawai`, `grid`.
- F-R & Kamada-Kawai dihitung sebagai target deterministik (pure TS, tanpa paket d3 langsung), dianimasikan via `transitionController` yang sudah ada.
- Grid: opsi urutkan berdasarkan derajat koneksi / nama / tag.
- Slider fisika (Physics tab) hanya aktif untuk free-force; untuk layout lain ditampilkan sebagai disabled dengan keterangan singkat (bukan disembunyikan).
- Edge types, partikel, highlight pathway: dipakai apa adanya.

### Tahap 3 — 5 layout Mindmap + konektor sesuai karakter
- Mindmap layouts: `mindmap` (Balanced, existing; orientation radial tetap jadi sub-opsi), `org-chart`, `brace-map`, `timeline` (existing), `fishbone` (existing).
- Hierarki bersumber dari folder & file vault (`parentId`), root = vault atau `focusedRootId`.
- Konektor di `drawLink`: Bezier (mindmap/brace), Manhattan siku radius 6 (org-chart), rib diagonal (fishbone, existing), garis lurus + ticks (timeline, existing).
- Wikilink antar cabang di mode mindmap: garis lengkung putus-putus memakai style `topology.styles.backlink` yang sudah ada.

### Tahap 4 — Subtree Override + Floating Contextual Toolbar
- `subtreeLayoutOverride: Record<nodeId, MindmapLayout>` di interaction store per tab, disimpan ke `.obmap/graph.json` bersama collapse.
- `useLayoutEngine` menghitung subtree ber-override secara terisolasi (bounding box), lalu menempelkannya ke induk.
- Toolbar mengambang (DOM overlay, 12px di atas node terpilih, hanya mode mindmap): Structure ▾ | Color | Add Sub | Focus | Delete.
  - Color → override warna cabang (`branchColorOverride`), dipakai mode warna `branch`.
  - Add Sub → `onAddNode` existing; Focus → `setFocusedRoot` existing; Delete → aksi hapus existing dengan konfirmasi.
- Klik kanan / tombol Tab/Delete sebagai shortcut aksi yang sama.

### Tahap 5 — Drag & Drop Reparenting
- Aktifkan drag di mode mindmap (graph mode tetap perilaku lama).
- Grab: skala 1.05, bayangan, link asal opacity 0.35. Target folder: glow ring warna `selectedColor`; indikator "masuk ke folder".
- Drop valid → `onNodeMove(nodeId, folderId)`; tidak valid (ke dirinya/keturunannya/file) → animasi kembali.
- Setelah move: layout ulang dengan transisi existing. Undo memakai history vault yang ada.
- Catatan: urutan antar-sibling belum didukung oleh vault (tidak ada field order) — indikator hanya "masuk ke folder" di tahap ini.

### Tahap 6 — Polish visual & warna
- Badge collapse: `—` saat terbuka, pill `+N` saat tertutup, animasi lipat.
- `autoColorBy: 'branch'` (Branch Color Inheritance): cabang level-1 ambil palet dari `hierarchy` preset aktif; anak mewarisi. Tidak menambah palet baru.
- Boundary grouping & summary bracket: **ditunda** (butuh model data baru); dicatat di roadmap.
- Cek mobile: toolbar mengambang tidak keluar layar; ribbon tetap rapi.

## Di luar cakupan
Collaboration/publish, superadmin dashboard, boundary/summary, urutan sibling manual.

## Detail teknis
- File diubah: `graphTypes.ts` (LayoutMode, CanvasMode), `useGraphInteractionStore.ts` (canvasMode, override, migrasi), `useGraphStore.ts` (`autoColorBy` + `branch`, version 3), `useLayoutEngine.ts`, `drawLink.ts`, `drawNode.ts`, `theme.ts`, `GraphCanvas.tsx` (drag mindmap, overlay anchor), `GraphWorkspaceControls.tsx` (daftar layout per mode), `IconRibbon.tsx`, `Ribbon.tsx`, `GraphLeaf.tsx`, `useWorkspaceStore` (buka/fokus tab dengan mode).
- File baru: `layout/fruchterman.ts`, `layout/kamadaKawai.ts`, `layout/grid.ts`, `layout/orgChart.ts`, `layout/braceMap.ts`, `layout/subtreeCompose.ts`, `interactions/dragReparent.ts`, `ContextualToolbar.tsx`.
- Tes vitest baru per layout (koordinat finite, deterministik, tanpa overlap dasar) + tes migrasi config; 42 tes lama harus tetap lulus.
- Setiap tahap selesai dengan tsgo bersih, vitest hijau, dan cek preview.
