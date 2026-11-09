Wawancara telah lengkap (7 dari 7 keputusan telah disepakati). Berikut adalah rangkuman rencana eksekusi komprehensif (UI/UX Breakthrough: App Settings, Graph Controls, & Unified Design Consistency):

---

📋 Rangkuman Rencana Eksekusi: UI/UX Breakthrough & Konsistensi Terpadu

🎯 Tujuan & Prinsip Utama
1. Clarity Over Cleverness: Menghilangkan tumpukan kontrol vertikal yang padat dan membingungkan; menggantikannya dengan susunan kartu visual intuitif yang memanfaatkan ruang secara optimal.
2. Zero Collision & Declutter: Menghilangkan tabrakan antar elemen melayang di kanvas graf dengan membagi zona fungsi secara tegas: Atas untuk Utilitas Kanvas/Kamera, Bawah untuk Pengaturan Toolbar.
3. Unified Consistency: Menyeragamkan seluruh slider, switch, tombol, ukuran font, dan border radius di seluruh penjuru aplikasi dengan satu spesifikasi desain semantik (micro-control spec).
4. Seamless Responsive: Pengalaman mulus tanpa patahan tata letak di monitor lebar, tablet, maupun saat leaf di-split sempit (< 768px).

---

🏛️ 5 Pilar Arsitektur yang Akan Dibangun

```text
┌────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE CANVAS                                                       │
│                                                                        │
│  [Top-Left: Breadcrumb]            [Top-Right: Unified Utility Dock]   │
│                                    (Zoom, Fit, Levels, Minimap, Lapse) │
│                                                                        │
│                           GRAFIK & KANVAS                              │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ BOTTOM TOOLBAR (Default Horizontal Ribbon / Gear)                  │ │
│ │ ┌───────────────────┬───────────────────┬────────────────────────┐ │ │
│ │ │ Kolom 1: Presets  │ Kolom 2: Layout   │ Kolom 3: Micro-Sliders │ │ │
│ │ │ (Visual Cards)    │ (Solver Engine)   │ (Label + Badge + Reset)│ │ │
│ │ └───────────────────┴───────────────────┴────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

Pilar 1: Revamp Total Pengaturan Aplikasi (`SettingsLeaf` & `SettingsHub`)
- Sub-Sidebar Navigasi Internal: Bilah menu vertikal ramping di sisi kiri leaf pengaturan yang mengelompokkan kategori (Account, Vaults, System & Sync, Editor, User Roles).
- Instant Search Bar: Kolom pencarian di bagian atas untuk menyaring pengaturan secara seketika (instant filter) tanpa perlu menebak kategori.
- Fluid Drawer Responsif: Pada layar atau split-leaf < 768px, sub-sidebar otomatis beralih menjadi sheet drawer ramah sentuhan, menyisakan 100% lebar untuk konten pengaturan.

Pilar 2: Perombakan Isi Tab Toolbar Graf (`GraphWorkspaceControls`)
- Struktur Hybrid Bento Cards:
  - Tab Layout: Kolom preset visual graf/mindmap di kiri, seleksi algoritma fisika di tengah, dan parameter gaya pegas (force sliders) di kanan.
  - Tab Appearance: Pembagian bersih antara Node Representation, Link Dynamics, dan Typography & Badges tanpa tumpukan collapsible yang dalam.
  - Tab Color Engine & Atmosphere: Pemilih palet tema satu-klik diiringi slider intensitas neon, glow, dan kabut latar yang rapi.
  - Tab Search & Filter: Input pencarian terpadu dengan slider kedalaman (min/max depth) bersanding langsung dengan filter konten dan tag.

Pilar 3: Unified Top Utility Dock di Kanvas Graf
- Menyatukan `FloatingZoomControls` dan `GraphBottomOverlays` ke dalam satu kapsul dock melayang yang elegan di pojok kanan atas kanvas.
- Menggabungkan kontrol kamera (Fit to Screen, Focus Selection, Expand All), Minimap popover, Hierarchy Levels popover, dan Time-lapse playback.
- Area bawah kanvas menjadi 100% bebas hambatan saat Toolbar diperbesar atau digeser tingginya (zero collision).

Pilar 4: Micro-Control Design System (Standarisasi Komponen)
- Membangun komponen dasar terpadu:
  - `ControlSliderRow`: Label di kiri, nilai terformat (unit badge, misal: `45px`, `1.2x`) di kanan, slider track ramping semantik di bawah.
  - `ControlSegmentedToggle`: Pengganti tombol acak dengan tab pil interaktif bergaya iOS/macOS.
  - `SectionHeaderWithReset`: Header seksi dengan tombol Reset to Default halus di sudut kanan.

Pilar 5: Engine Responsif & Penyesuaian Ruang Kerja
- Breakpoint adaptif berbasis kontainer (container-aware query) agar tata letak bento cards di Toolbar dan formulir di Settings otomatis menyesuaikan diri dengan lebar leaf aktif, bukan hanya lebar layar fisik perangkat.

---

🗂️ Rincian File yang Akan Disentuh

| Bagian | File yang Ditargetkan | Peran / Modifikasi |
| :--- | :--- | :--- |
| Micro-Controls | `src/shared/ui/ControlSliderRow.tsx` (Baru) <br> `src/shared/ui/SectionHeaderWithReset.tsx` (Baru) | Komponen kontrol presisi yang seragam di seluruh aplikasi |
| Settings Hub | `src/domains/settings/SettingsHub.tsx` <br> `src/domains/settings/components/SettingsInternalNav.tsx` (Baru) | Penambahan sub-sidebar internal, instant search, dan responsive drawer |
| Graph Toolbar | `src/domains/graph/components/GraphWorkspaceControls.tsx` <br> `src/domains/graph/controls/panels/LayoutPanel.tsx` <br> `src/domains/graph/controls/panels/AppearancePanel.tsx` <br> `src/domains/graph/controls/panels/SearchPanel.tsx` | Penataan ulang komposisi isi tab menjadi Bento Cards multi-kolom |
| Utility Dock | `src/domains/graph/components/GraphCanvasUtilityDock.tsx` (Baru) <br> `src/domains/graph/components/GraphCanvas.tsx` <br> `src/domains/workspace/views/GraphLeaf.tsx` | Menyatukan zoom, minimap, levels, dan lapse ke dock pojok atas kanvas |

---

🚀 Rencana Pembagian Tahapan Eksekusi Gradual

Untuk menjaga kepastian dan kemudahan pengujian di lokal Anda, eksekusi disarankan dibagi menjadi 3 Tahap:

 Tahap 1: Design System & Unified Utility Dock* (Membangun komponen `ControlSliderRow`, `SectionHeaderWithReset`, dan menyatukan tombol kamera/minimap ke `GraphCanvasUtilityDock` di pojok atas kanvas).
 Tahap 2: Revamp Total Isi Tab Toolbar Graf* (Merombak `LayoutPanel`, `AppearancePanel`, `SearchPanel`, dan `GraphWorkspaceControls` ke format Hybrid Bento Cards multi-kolom).
 Tahap 3: Revamp Settings Leaf* (Menghadirkan sub-sidebar navigasi internal, bilah pencarian instan, dan adaptasi responsif mobile/split-leaf di `SettingsHub`).

---

Rencana eksekusi sudah terangkum lengkap berdasarkan seluruh preferensi Anda. Apakah Anda ingin kita mulai eksekusi Tahap 1 sekarang?