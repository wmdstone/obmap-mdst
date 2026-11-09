# Rencana Refaktorisasi Bertahap VaultGraph

Tujuan: memecah 7 file besar dan menyatukan sumber state, **tanpa mengubah perilaku aplikasi**. Setiap fase kecil, bisa dijalankan satu per satu, dan selalu berakhir dalam kondisi aplikasi berjalan normal.

## Kondisi saat ini (sudah dicek)

| File | Baris |
|---|---:|
| core/graph/GraphWorkspaceControls.tsx | 1428 |
| core/graph/GraphCanvas.tsx | 1111 |
| core/shell/workspace/SidebarPanel.tsx | 894 |
| core/graph/NodePanel.tsx | 825 |
| core/system/import-export/services/ImportExportService.ts | 824 |
| core/system/vault/VaultManager.ts | 791 |
| core/shell/workspace/VaultSessionContext.tsx | 697 |

`useVaultSession` dipakai di 7 file. Belum ada perintah `test` di package.json.

## Aturan keamanan (berlaku di setiap langkah)

1. Satu langkah = satu ekstraksi. Tidak ada rewrite besar.
2. Hanya "pindahkan kode" — tidak mengubah logika, nama props publik, atau tampilan.
3. File lama tetap mengekspor nama yang sama (re-export) agar import di tempat lain tidak rusak.
4. Setelah setiap langkah: build bersih, semua test lulus, cek cepat di preview (Playwright) pada area yang disentuh.
5. Jika ada yang gagal, langkah itu dibatalkan sebelum lanjut.
6. Tidak menyentuh database, login, atau paket yang terpasang.

## Fase 0 — Jaring pengaman (wajib pertama)

- 0.1 Tambah script `test` di package.json yang menjalankan test yang sudah ada (64 test), pastikan semuanya hijau.
- 0.2 Buat skrip cek visual Playwright dasar: buka workspace, graph tampil, sidebar tampil, panel node bisa dibuka. Simpan screenshot acuan.
- 0.3 Catat baseline di roadmap.md (jumlah baris, jumlah test).

## Fase 1 — GraphWorkspaceControls (1428 → ~200)

Folder baru `src/core/graph/controls/`.
- 1.1 Ekstrak `FloatingZoomControls.tsx`.
- 1.2 Ekstrak `FloatingMinimapWidget.tsx`.
- 1.3 Ekstrak `FloatingGearContainer.tsx`.
- 1.4 Ekstrak panel satu per satu ke `controls/panels/`: `SearchPanel`, `AppearancePanel`, `AtmospherePanel` (satu panel per langkah).
- 1.5 File utama tinggal orkestrator. Cek visual toolbar + tiap panel.

## Fase 2 — NodePanel (825 → ~250)

- 2.1 Ekstrak `NodeMediaPreview.tsx` (audio/video/gambar).
- 2.2 Ekstrak `NodeBreadcrumbBar.tsx`.
- 2.3 Ekstrak `NodeBacklinksSection.tsx`.

## Fase 3 — SidebarPanel (894 → ~250)

- 3.1 Ekstrak hook `useFolderNavigation.ts` (state buka/tutup folder).
- 3.2 Ekstrak `ExplorerContextMenu.tsx`.
- 3.3 Ekstrak `FileExplorerTree.tsx`.

## Fase 4 — GraphCanvas (1111 → ~350)

Paling sensitif (render loop), jadi setelah UI lain stabil.
- 4.1 Hook `useCanvasGestureBridge.ts`.
- 4.2 Hook `useCanvasDragReparent.ts` (dilindungi test drag-reparent yang sudah ada).
- 4.3 Hook `useCanvasParticleLoop.ts`.

## Fase 5 — Sentralisasi utilitas murni

- 5.1 Tulis test untuk fungsi hitung rantai parent/breadcrumb yang ada sekarang.
- 5.2 Satukan ke `src/core/graph/model/hierarchyTraversal.ts`; Sidebar & NodePanel memakainya.
- 5.3 Tulis test parsing warna (HEX/HSL/var CSS), lalu satukan ke `src/shared/lib/color-engine.ts`.

## Fase 6 — Characterization tests sebelum memecah service

- 6.1 Test `VaultManager`: buat vault in-memory, simpan catatan, baca ulang.
- 6.2 Test `ImportExportService`: ekspor ZIP lalu impor ulang menghasilkan data sama.

## Fase 7 — Pecah service (dilindungi test fase 6)

- 7.1 Definisikan interface `IVaultStorageDriver`.
- 7.2 Pindahkan logika IndexedDB ke `IndexedDbVaultDriver.ts`.
- 7.3 Pindahkan logika File System ke `NativeFsVaultDriver.ts`.
- 7.4 `VaultManager` jadi pemilih driver (~180 baris).
- 7.5 ImportExport: ekstrak `ZipArchiveProcessor`, `MediaAssetExtractor`, `MarkdownNoteImporter` (satu per langkah).

## Fase 8 — Hapus sumber state ganda (paling akhir, paling berisiko)

- 8.1 Petakan setiap nilai/aksi di `VaultSessionContext` ke store Zustand yang setara.
- 8.2 Ubah `useVaultSession()` menjadi pembungkus tipis di atas store (API tetap sama).
- 8.3 Migrasikan 7 pemakai satu file per langkah ke selector store langsung.
- 8.4 Setelah tidak ada pemakai, hapus Context.
- 8.5 (Opsional) Ganti callback berantai dengan event bus yang sudah ada, satu event per langkah.

## Cara eksekusi

Setiap pesan Anda cukup: "jalankan langkah X.Y". Saya kerjakan langkah itu saja, verifikasi, lalu centang di roadmap.md. Disarankan mulai dari Fase 0.

## Detail teknis

- Verifikasi per langkah: `build-errors.log` bersih, `bun run test` hijau, skrip Playwright Fase 0 lulus untuk area terkait.
- Ekstraksi komponen: props diteruskan apa adanya; state lokal ikut pindah hanya jika tidak dipakai bagian lain.
- Keputusan struktur (folder `controls/`, pola driver, store sebagai satu-satunya sumber state) dicatat di AGENTS.md.
