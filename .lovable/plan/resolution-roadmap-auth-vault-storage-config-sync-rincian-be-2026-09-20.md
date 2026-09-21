\# Resolution Roadmap: Auth, Vault, Storage, Config, Sync — Rincian Bertahap



Breakdown detail dari "Proposed Resolution Strategy" di PLAN.MD (deep-audit-…-2026-09-20.md). Setiap langkah kecil, bisa diverifikasi sendiri, dan tidak mengubah perilaku sampai eksplisit dinyatakan mengubah.



Prinsip urutan: bersihkan yang mati → satukan mesin → satukan pemicu → perbaiki identitas → satukan konfigurasi → satukan storage → perkeras sesi. Fase awal tidak bergantung pada fase akhir, jadi progress bisa berhenti aman di tiap titik.



\## Phase 0 — Hapus kode mati (tanpa perubahan perilaku)



Tujuan: mengecilkan permukaan masalah sebelum menyentuh logika.



\- 0.1 Hapus `src/core/system/vault/hooks/useVault.tsx` (stack vault paralel tanpa importer).

\- 0.2 Hapus `src/core/system/sync/BackgroundSyncService.ts` dan queue `localStorage\['vault\_pending\_changes']` beserta listener `online`-nya.

\- 0.3 Hapus penulisan `.vaultconfig` di `ExportToFileSystem.tsx:120-129` (write-only marker).

\- 0.4 Putuskan `FolderConfigStore`: karena `writeSections` tidak pernah dipanggil, opsi A = hapus; opsi B = sambungkan ke `ConfigService.persist()` sebagai mirror turunan. Rekomendasi: hapus dulu, hidupkan kembali di Fase 4 sebagai adapter turunan.

\- 0.5 Gabungkan dua `ProtectedRoute` (features/auth vs shared/components) menjadi satu, update semua import.

\- Verifikasi: `tsgo`, `vitest`, grep memastikan tidak ada import tersisa; jalankan app, login, buka vault, sinkron manual — semua harus identik dengan sebelumnya.



\## Phase 1 — Satu mesin sinkron



Tujuan: hanya `SyncEngine` yang menulis ke `user\_vaults`.



\- 1.1 Tambahkan flag/parameter di `VaultSyncService` agar pull-nya mengecek dirty set `SyncEngine` sebelum menimpa lokal (perbaikan cepat untuk kehilangan edit, tanpa refactor besar).

\- 1.2 Alihkan semua pemanggil `VaultSyncService.syncToCloud` ke `SyncEngine` (push per-note, bukan whole-vault).

\- 1.3 Ubah `VaultSyncService` menjadi facade tipis yang mendelegasikan ke `SyncEngine`, dengan signature publik yang sama agar pemanggil tidak berubah lagi.

\- 1.4 Pastikan pull memakai `baseUpdatedAt` sehingga note yang berubah di dua sisi menjadi conflict copy, bukan tertimpa diam-diam.

\- 1.5 Uji skenario: edit offline → online → edit di device lain → sync; tidak ada edit lokal yang hilang, konflik menghasilkan `(conflict <date>)` copy.

\- Catatan risiko: verifikasi `GraphService.setNode/clearGraph` (dipanggil `applyToLocalVault`) tidak memicu `markDirty`/`saveVault` ulang (loop umpan balik). Jika ya, tambahkan guard "applying remote".



\## Phase 2 — Satu pemicu sinkron



Tujuan: satu tempat yang memutuskan kapan sync berjalan.



\- 2.1 Buat `SyncCoordinator`: satu subscription auth, satu listener `online`, mutex + debounce agar permintaan yang tumpang tindih melebur jadi satu.

\- 2.2 Hapus tiga efek login yang masing-masing memanggil `initialize()` + `syncFromCloud()` (`VaultSessionContext.tsx:222-234`, `useVaultSync.tsx:64-75`, `VaultRequiredGate.tsx:40-57`); semuanya berlangganan ke coordinator.

\- 2.3 Di `useConfigSync.ts:51-58`: `TOKEN\_REFRESHED` tidak boleh memicu full pull; hanya `SIGNED\_IN` yang memicu.

\- 2.4 Ganti interval 1 detik di `useVaultSync.tsx:56-61` dengan subscription status yang sudah ada.

\- Verifikasi: login hanya memicu tepat satu sync; refresh halaman, login/logout berulang, dan token refresh tidak menimbulkan burst request (cek tab Network).



\## Phase 3 — Identitas vault yang stabil



Tujuan: satu vault = satu id yang sama di lokal dan cloud; tidak ada duplikasi lintas device.



\- 3.1 Ganti id lokal `vault-<timestamp>-<random>` menjadi UUID yang dipakai juga sebagai primary key cloud (`user\_vaults`).

\- 3.2 Tambahkan unique constraint `(user\_id, vault\_uuid)` di database (migrasi); tangani konflik insert sebagai "sudah ada, lakukan update".

\- 3.3 Satukan tiga titik `createVault` (`SyncEngine.ts:217-226`, `VaultSyncService.ts:132-146`, `:313-325`) menjadi satu fungsi.

\- 3.4 `importCloudVault` mencocokkan berdasarkan UUID itu, bukan hanya `cloudId`; jika lokal sudah ada id yang sama, tautkan — jangan buat vault baru.

\- 3.5 Sambungkan penghapusan cloud ke `deleteVault` (sekarang hanya mengembalikan `cloudId` tanpa membersihkan).

\- Verifikasi: buat vault di device A, login di device B → satu vault, bukan dua; hapus di satu device → hilang di keduanya.



\## Phase 4 — Satu sumber kebenaran konfigurasi



Tujuan: `ConfigService` memiliki semua setting; file hanyalah ekspor turunan.



\- 4.1 Pindahkan bagian vault-scoped (graph, graph-engine, workspace, schema) keluar dari `vault.graphConfig`/`vault.backupConfig` menjadi section `ConfigService` dengan kunci per-vault.

\- 4.2 Pindahkan `localStorage\['vault\_backup\_configs']` (VaultBackupService.ts:34-58) ke section `backup` milik `ConfigService`; tulis lapisan migrasi satu kali yang membaca nilai lama.

\- 4.3 Jadikan `.vault-config.json` dan `.obmap/\*.json` ekspor turunan: satu adapter menulisnya ketika folder handle tersedia; keduanya tidak pernah dibaca sebagai sumber kebenaran.

\- 4.4 `obmap-config-<date>.json` tetap format portabilitas manual dan memakai serializer yang sama persis dengan internal.

\- Verifikasi: ubah setting → hanya satu tempat yang berubah; ekspor → impor menghasilkan state identik; setting vault bertahan lintas login dan device.



\## Phase 5 — Adapter storage di balik satu antarmuka



Tujuan: tidak ada lagi percabangan ad hoc `vault.type`; tidak ada no-op diam-diam.



\- 5.1 Definisikan `VaultRepository` (load/save/list/delete) dengan adapter `memory`, `indexeddb`, `filesystem`, `cloud`.

\- 5.2 Tambahkan capability flags (`canWriteFolderConfig`, `canPersistHandle`, …); UI men-disable fitur yang tidak didukung alih-alih gagal senyap.

\- 5.3 Simpan directory handle di IndexedDB dan lakukan permission re-prompt saat load, sehingga vault folder lokal bertahan setelah refresh.

\- 5.4 Tambahkan feature detection untuk `window.showDirectoryPicker` sebelum dipanggil (`VaultManager.ts:213-214`).

\- 5.5 Satukan tiga instans `FileSystemService` menjadi satu (DI tunggal).

\- Verifikasi: vault folder lokal terbuka kembali setelah refresh (dengan prompt izin); di browser tanpa File System Access API, tombol terkait ter-disable dengan penjelasan, bukan no-op.



\## Phase 6 — Perkeras sesi multi-device



Tujuan: logout tidak menghapus data; antrian tidak bocor antar akun; timeout tidak membunuh sesi.



\- 6.1 `useAuth.signOut` tidak lagi menghapus seluruh `VaultManagerDB`; hapus hanya salinan cloud-backed, pertahankan vault local-only (atau tanyakan dulu ke pengguna).

\- 6.2 Scope `VaultSyncQueueDB` per `user.id` dan kosongkan saat ganti akun.

\- 6.3 Di `previewAuthStorage.ts`: timeout broker diperlakukan sebagai "unknown" (pakai salinan lokal), bukan tombstone yang menghapus sesi.

\- 6.4 Satukan dua subscription `onAuthStateChange` (`useAuth.tsx`, `useConfigSync.ts`) melalui coordinator dari Fase 2.

\- Verifikasi: login/logout berulang di dua akun pada device yang sama; antrian tidak tercampur; sesi tidak jatuh saat token refresh; vault lokal-only selamat dari logout.



\## Sumber kebenaran akhir (target)



\- Sesi: satu Supabase client; `useAuth` satu-satunya auth listener.

\- Konten vault: `VaultRepository` untuk vault aktif; baris cloud ber-UUID shared sebagai kebenaran lintas device.

\- Setting: `ConfigService` (`user\_settings` saat login, `ObmapConfigDB` saat offline); file hanyalah ekspor.

\- Status sync: `SyncEngine` + queue-nya; semua indikator membaca dari sana.



\## Detail teknis



\- Setiap fase diakhiri: `bunx tsgo --noEmit`, `bunx vitest run`, lint file yang diubah, dan uji manual skenario di atas via preview.

\- Fase 3 butuh migrasi database (unique constraint + kolom UUID); fase lain murni frontend.

\- Urutan antar fase bisa berhenti kapan pun; fase 0–2 memberi perbaikan terbesar untuk gejala yang dilaporkan (sync loop, duplikasi vault, kehilangan edit).

\- Pertanyaan terbuka yang perlu dijawab saat eksekusi: apakah `user\_vaults` sudah punya constraint unik; apakah tiga komponen login-effect benar ter-mount bersamaan; apakah `applyToLocalVault` menimbulkan loop `markDirty`.



