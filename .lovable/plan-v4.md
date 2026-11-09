Berikut adalah ringkasan cetak biru menyeluruh (Comprehensive Architecture & Implementation Plan) yang dirumuskan secara khusus berdasarkan 10 keputusan strategis yang telah kita sepakati bersama, dengan mengedepankan Keamanan (Zero-Trust Security), Kenyamanan & Kemudahan (UX/DX), Clarity (Kejelasan Kode & Tata Kelola), serta Skalabilitas Jangka Panjang:

---

Cetak Biru Arsitektur: Kolaborasi, Web Publishing ala Notion, & Superadmin Dashboard ObMap

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OBMAP UNIFIED ECOSYSTEM                                  │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│  1. WORKSPACE (/app)     │  2. PUBLIC READER (/p/:...) │  3. SUPERADMIN COCKPIT (/admin)│
│  - Personal & Shared     │  - Clean Notion-like Doc    │  - User & Role Governance     │
│  - Presence & Diff Lock  │  - Interactive Graph        │  - Health, Ping & Audit Trail │
│  - Two-Stage Linter      │  - Graceful Inactive Links  │  - 3-View System Architecture │
└─────────────┬────────────┴──────────────┬──────────────┴───────────────┬───────────────┘
              │                           │                              │
              ▼                           ▼                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER & POSTGRESQL RLS ENFORCEMENT                         │
│  - notes (granular)      - note_revisions (diffs)      - note_links (graph index)      │
│  - vault_members (RBAC)  - user_roles (platform roles) - audit_logs (compliance)       │
│  - Storage Bucket: `vault-media` (public read, authenticated scoped upload)            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

1. Rekapitulasi 10 Keputusan Arsitektur

| # | Domain Arsitektur | Keputusan Terpilih | Justifikasi Teknis & Dampak |
|---|---|---|---|
| 1 | Model Kolaborasi | Hybrid: Personal & Shared Vault | Pengguna tetap memiliki catatan pribadi yang terisolasi total, sekaligus dapat membuat/bergabung ke Shared Vault tim dengan kontrol akses berbasis anggota. |
| 2 | Alur Kurasi & Terbit | Two-Tier: Personal Instan, Tim Terkurasi | Catatan pribadi dapat langsung terbit ke web seketika tanpa hambatan. Pada Shared Vault, kontributor melewati antrean Submit for Review dengan verifikasi Diff View oleh Editor/Admin. |
| 3 | Tampilan Pembaca Publik | Dual-Mode: Artikel Bersih + Visual Graph | Halaman publik (`/p/:vaultSlug/:noteSlug`) menampilkan dokumen teks yang bersih ala Notion, dengan toggle instan untuk menjelajahi Interactive Knowledge Graph catatan yang telah terbit. |
| 4 | Kontrol Terbit & Broken Links | Granular Catatan + Graceful Inactive Link | Publikasi dikontrol per-catatan (bukan serentak se-vault). Tautan ke catatan yang belum terbit (ghost links) tidak memicu 404, melainkan ditampilkan redup dengan tooltip elegan. |
| 5 | Pipeline Media & Gambar | Auto-Bundle & Upload saat Publish | Pengguna bebas menyisipkan gambar lokal secara offline saat draf. Saat tombol Publish ditekan, aset lokal otomatis dipindai, diunggah ke Cloud Storage, dan ditautkan ke URL CDN publik. |
| 6 | Pencegahan Konflik Edit | Presence Badge + Optimistic Diff Warning | Avatar kolaborator aktif ditampilkan secara real-time. Jika dua orang mengedit bersamaan, sistem mendeteksi perbedaan nomor versi (`version`) dan menampilkan dialog rekonsiliasi Diff visual. |
| 7 | Akses Superadmin Dashboard | Dedicated Route `/admin` (Full Cockpit) | Terisolasi di halaman layar penuh `/admin` dengan proteksi RLS dan fungsi `is_superadmin()`, memisahkan area kerja kreatif dengan tata kelola sistem. |
| 8 | Validasi Skema & Metadata | Two-Stage: Soft saat Draf, Ketat saat Terbit | Autosave tidak pernah memblokir pengetikan draf ide. Validasi skema (Hard Gate) hanya diaktifkan saat mengajukan review atau publikasi dengan ceklis perbaikan otomatis. |
| 9 | Migrasi Data Vault Lama | Seamless Auto-Hydration | Vault lama berbasis `graph_data` monolitik otomatis dikonversi ke baris `notes` & `note_links` di latar belakang saat dibuka pertama kali, dengan backup lama tetap disimpan sebagai fail-safe. |
| 10 | System Architecture Visualizer | 3 Tampilan Otonom (Graph, Bento, Tabel) | Menyediakan switcher 3 tampilan (Living Graph, Bento Grid Telemetry, dan Deep Diagnostics Table) yang dirancang modular dan terisolasi otonom untuk kemudahan eksperimen dan debugging. |

---

2. Rincian Teknis & Rencana Pembangunan

A. Lapisan Database & Keamanan (Backend Cloud)
1. Tabel `user_roles` & `vault_members`:
   - `user_roles`: Menyimpan peran tingkat platform (`superadmin`, `member`).
   - `vault_members`: Menyimpan peran per-vault (`admin`, `editor`, `contributor`, `viewer`).
   - Fungsi PostgreSQL `is_superadmin()` dan `has_vault_permission(v_id, req_role)` berstatus `SECURITY DEFINER` untuk evaluasi RLS tanpa celah eskalasi hak istimewa (privilege escalation).
2. Tabel Granular Catatan (`notes`, `note_revisions`, `note_links`):
   - `notes`: `id`, `vault_id`, `slug`, `title`, `content`, `frontmatter`, `status` (`draft` | `in_review` | `published` | `archived`), `version`, `author_id`, `published_at`.
   - `note_revisions`: Menyimpan riwayat perubahan teks dan diff untuk keperluan perbandingan oleh Editor.
   - `note_links`: Mengindeks relasi `source_note_id` ke `target_slug` untuk mempercepat query graf visual tanpa perlu me-parse markdown berulang-ulang di server.
3. Tabel Kepatuhan & Audit (`audit_logs`):
   - Mencatat setiap perubahan peran user, approval penerbitan catatan publik, serta penghapusan vault/catatan.
4. Storage Bucket `vault-media`:
   - Akses publik untuk membaca aset catatan terbit, dengan batasan unggah (ukuran maks 10MB, filter tipe MIME gambar/diagram).

---

B. Alur Kerja Dual-Realm & Tampilan Publik
1. Editor Toolbar & Workflow Actions:
   - Status badge dinamis di editor (`Draf`, `Menunggu Review`, `Terbit`).
   - Tombol kontekstual sesuai role:
     - Contributor di Shared Vault: "Ajukan Review" (membuka ceklis Two-Stage Linter).
     - Admin/Editor: "Tinjau Perubahan" (membuka Diff Viewer berdampingan) dan "Setujui & Publikasikan".
2. Audit Ghost Link & Bundler Media:
   - Modul parser mengekstrak tautan `[[...]]` dan tag `![...](...)`.
   - Menampilkan modal konfirmasi pra-publikasi: status aset yang akan diunggah dan daftar tautan yang masih berstatus draf.
3. Route Pembaca Publik (`/p/:vaultSlug` & `/p/:vaultSlug/:noteSlug`):
   - Layout independen yang sangat cepat dan ringan (bebas panel editor/sidebar workspace).
   - Sidebar navigasi pohon dokumen terbit.
   - Toggle tombol ke Public Interactive Graph (merender graf visual khusus catatan `status = 'published'` menggunakan canvas graf ObMap yang sudah teroptimasi).
   - Penanganan Ghost Link: Tautan ke catatan internal dirender dengan gaya teks bergaris bawah putus-putus dan tooltip elegan "Catatan ini belum dipublikasikan oleh penulis".

---

C. Superadmin Dashboard (`/admin`) & 3 Tampilan System Inspector
1. Route Guard & Layout:
   - Route `/admin` dilindungi oleh hook `useSuperadminGuard()` yang memeriksa izin di level database. Pengguna tanpa role admin langsung diarahkan kembali dengan notifikasi aman.
2. Tab 1: Manajemen User & Role:
   - Tabel kolaborator lengkap (Avatar, Email/Nama, Role, Tanggal Bergabung, Kontribusi).
   - Dropdown perubahan role instan dengan aturan keselamatan: Admin tidak dapat mencabut akses admin dirinya sendiri jika hanya tersisa satu admin di sistem.
3. Tab 2: Health, Metrik & Audit Trail:
   - Metrik ringkasan: Total catatan (draf vs review vs terbit), total vault, kuota storage.
   - Ping latensi database real-time.
   - Feed audit trail interaktif yang dapat difilter berdasarkan aksi dan tanggal.
4. Tab 3: System Architecture Visualizer (3 Tampilan Otonom):
   - Tampilan 1 (Living Interactive Graph): Representasi kanvas visual graf dari subsistem aplikasi (Sync Engine, Layout Engine, Diff Engine, Auth, RLS, Storage Adapters) dengan denyut status hijau/kuning/merah.
   - Tampilan 2 (Bento Grid Telemetry): Kartu status performa, latensi, dan feature toggle switch individual untuk setiap modul sistem.
   - Tampilan 3 (Deep Diagnostics Table): Tabel diagnostik mendalam berisi event listener aktif, antrean sinkronisasi, dan log error klien.
   - Arsitektur Otonom: Ketiga tampilan mengonsumsi satu antarmuka data telemetri yang sama (`SystemTelemetryContract`), sehingga setiap sub-komponen terisolasi murni, tidak saling bergantung, dan sangat mudah di-debug atau dikembangkan lebih lanjut.

---

3. Rencana Tahapan Eksekusi (Roadmap)

1. Tahap 1 (Fondasi Database & Akses):
   - Penulisan migrasi skema tabel baru (`user_roles`, `vault_members`, `notes`, `note_revisions`, `note_links`, `audit_logs`).
   - Konfigurasi RLS policies dan fungsi PostgreSQL `SECURITY DEFINER`.
   - Setup bucket storage `vault-media`.
2. Tahap 2 (Model Data & Migrasi Otomatis):
   - Service adaptasi per-note (`NoteService`, `NoteSyncService`).
   - Mesin Seamless Auto-Hydration untuk membaca vault lama dan memecahnya ke baris catatan baru tanpa menghapus data asli.
3. Tahap 3 (Workflow Kurasi, Diff Viewer, & Asset Bundler):
   - Antarmuka status draf, review, dan publikasi di editor.
   - Komponen visual Diff Viewer berdampingan (side-by-side split).
   - Pipeline otomatis deteksi & upload aset gambar lokal ke cloud storage saat publikasi.
4. Tahap 4 (Portal Pembaca Publik / Dynamic Reader):
   - Pembuatan route `/p/:vaultSlug` dan `/p/:vaultSlug/:noteSlug`.
   - Renderer artikel Notion-style yang bersih dengan penanganan Ghost Link.
   - Integrasi kanvas graf interaktif publik untuk catatan terbit.
5. Tahap 5 (Superadmin Dashboard & 3-View System Visualizer):
   - Halaman `/admin` dengan guard keamanan.
   - Tab manajemen user dan audit logs.
   - Pembangunan 3 tampilan otonom pada System Inspector (Living Graph, Bento Grid, dan Deep Diagnostics Table).

---

Rencana arsitektur ini sudah lengkap, solid, dan menjawab seluruh poin dalam masukan yang Anda unggah.

Langkah berikutnya adalah memulai pembangunan Tahap 1 (Fondasi Database & Akses). Bila Anda ingin saya mulai mengimplementasikannya, beri tahu dan kita dapat beralih ke Build mode!