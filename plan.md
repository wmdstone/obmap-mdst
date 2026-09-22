Berikut **plan yang sudah diperbaiki**, dengan fokus utama pada filosofi TOC Notion-like yang minimalist (mini bar + hover) yang kamu suka, sambil tetap mempertahankan seluruh fitur heading folding yang sudah ada di plan asli.

Saya buang total ide “tampilkan full TOC secara permanen jika window lebar”. TOC tetap **selalu unobtrusive**.

---

# Collapsible Table of Contents (Notion-like Minimal) + Heading Folding

## Goal
Tambahkan **Table of Contents bergaya Notion minimalist** (mode mini selalu terlihat, full list hanya muncul saat hover) serta kemampuan collapse/expand section untuk setiap heading (level 1–6) di mode editing, live-preview, reading, dan split.

TOC harus:
- Always available, but unobtrusive
- Tidak pernah mencuri ruang konten utama
- Memberikan feedback visual posisi saat ini
- Super ringan dan smooth

## Implementation

### 1. Shared Heading Tree Utility
- Parse Markdown body menjadi pohon heading yang stabil.
- Setiap node menyimpan:
  - level (1–6)
  - visible label
  - source position (line start/end)
  - generated anchor/ID
  - children
- Utility ini dipakai bersama oleh:
  - Floating TOC
  - CodeMirror fold ranges
  - Reading-view section folding

### 2. Notion-like Minimalist Floating TOC
position: fixed;
top: 50%;
right: 1rem;
transform: translateY(-50%);
z-index: 50;→ TOC selalu berada di tengah vertikal sisi kanan, sehingga tidak terlalu ke atas maupun terlalu ke bawah. Posisi ini lebih nyaman dan simetris di berbagai ukuran layar.
- **Mode Mini (default, selalu terlihat)**  
  Deretan karakter `▃` kecil (font ~6–7pt)  
  - Abu-abu (`toc-light`) = tidak aktif  
  - putih = posisi heading yang sedang paling dekat dengan atas viewport  
- **Mode Full (hanya muncul saat hover)**  
  Daftar hierarchical dengan indentasi sesuai level  
  - Truncation dengan ellipsis (`max-width: 32ch`)  
  - Scrollbar tipis jika daftar panjang  
  - Item aktif di-bold  
- **Interaksi**  
  - Hover area mini → full list muncul dengan smooth transition  
  - Klik label heading → scroll ke heading + highlight kuning sementara (CSS transition)  
  - Klik tidak membuka/menutup branch (hanya navigasi)  
- **Current position tracking**  
  Update secara real-time saat scroll (closest heading ke top of viewport)
- **Sinkronisasi**  
  TOC selalu update segera saat heading ditambah/dihapus/diedit
- **Accessibility**  
  Keyboard-operable, `aria-expanded`, focus state, semantic markup

Tidak ada mode “always show full TOC” berdasarkan lebar window.

### 3. CodeMirror Heading Folding (Source & Live Edit)
- Tampilkan fold gutter control di samping heading yang memiliki konten di bawahnya.
- Fold range: dari heading sampai baris sebelum heading berikutnya dengan level sama atau lebih tinggi.
- Folding hanya mengubah presentasi, tidak mengubah teks dokumen atau Markdown yang disimpan.
- State folding bersifat lokal ke note yang sedang dibuka.
- pastikan kontrol collapse/expand nya menggunakan chevron icon rigth dan down sebagai indikator collapsa/expand.

### 4. Reading Mode Heading Folding
- Render kontrol collapse/expand di samping setiap heading. 
- pastikan kontrol collapse/expand nya menggunakan chevron icon rigth dan down sebagai indikator collapsa/expand.
- Collapse bersifat rekursif (nested sections bisa di-fold secara independen).
- Pastikan links, tags, lists, code blocks, dan elemen lain tetap ter-render dengan benar saat section di-hide/show.
-ketika di-hide maka tampilkan " ..." flat tanpa background yang mengganggu
- State collapse lokal ke note dan di-reconcile saat heading berubah.

### 5. Split Mode
- Kiri (editor): CodeMirror folding  
- Kanan (reading): Reading-mode folding  
- TOC floating masing-masing mode ada satu instance yang bekerja untuk masing-masing.

### 6. Styling & Accessibility
- Semantic styling, keyboard navigation penuh.
- `aria-expanded`, focus-visible, label yang jelas.
- Scrollbar TOC dibuat sangat tipis dan tidak mengganggu.

## Technical Details
- Shared heading parser/tree utility sebagai single source of truth.
- Floating TOC diimplementasikan dengan vanilla-style CSS + JS (atau framework ringan yang sudah dipakai app) mengikuti pola mini ↔ hover.
- CodeMirror: gunakan language fold service + gutter.
- Markdown renderer: tambahkan heading IDs + section-aware rendering state.
- Collapse/fold state disimpan lokal per note dan di-reconcile on heading change.

## Verification
- Test irregular nesting, duplicate heading names, empty sections, level 1–6, penambahan/penghapusan heading.
- Verifikasi navigasi TOC (klik + keyboard) dan current-position indicator.
- Verifikasi independent nested collapse di reading mode.
- Verifikasi source, live-preview, reading, dan split mode.
- Pastikan TypeScript clean dan preview build sukses.
- Pastikan TOC tetap super minimal saat tidak di-hover dan tidak pernah “mengambil” ruang konten.