Wawancara telah selesai. Berikut adalah Rangkuman Rencana Arsitektur & Implementasi Lengkap berdasarkan seluruh 10 pilihan Opsi C yang telah Anda tetapkan:

---

📋 Rangkuman Rencana Eksekusi: RBAC & Dynamic Admin Dashboard

1. Arsitektur Inti & Penempatan Komponen (Zero-Duplication)
```text
┌────────────────────────────────────────────────────────────────────────┐
│                          OBMAP / VAULTGRAPH APP                        │
├───────────────────────────────────┬────────────────────────────────────┤
│   AREA WORKSPACE (/app)           │   AREA SUPERADMIN (/admin)         │
│   (Kolaborasi & Peran Per-Vault)  │   (Pengawasan & Kontrol Global)    │
├───────────────────────────────────┼────────────────────────────────────┤
│ • SettingsHub → RolesSettings     │ • Route Guard (useSuperadminGuard) │
│   (Daftar Anggota Vault Aktif,    │ • Setup Wizard (First Superadmin)  │
│    Invite by Email, Role Member)  │ • Cockpit Tab 1: User Management   │
│ • Editor & Graph Adaptive UX      │ • Cockpit Tab 2: Health & Audit    │
│   (Viewer / Contributor / Editor) │ • Cockpit Tab 3: 3-View System     │
│ • useVaultPermission Hook         │   (Living Graph, Bento, Table)     │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

2. Rincian Lapisan & File yang Akan Dibangun

A. Service & State Management (Dinamika Data & RBAC)
1. `src/domains/admin/services/AdminService.ts`:
   - `checkSuperadminBootstrapStatus()`: Memeriksa apakah sistem sudah memiliki superadmin pertama.
   - `claimInitialSuperadmin()`: Mengklaim hak superadmin pertama kali secara aman.
   - `getUsersWithRoles()`: Mengambil daftar pengguna, profil, role global, jumlah vault, dan status penangguhan akun.
   - `updateUserRole()`: Mengubah role (`member` $\leftrightarrow$ `superadmin`) dengan lockout guard (mencegah pencopotan superadmin terakhir) + otomatis mencatat ke `audit_logs`.
   - `toggleUserSuspension()`: Menangguhkan / mengaktifkan akun pengguna + catat audit log.
   - `getAuditLogs()`: Mengambil log aktivitas dengan filter kategori dan pencarian.
   - `pingSupabaseCloudHealth()`: Mengukur latensi riil round-trip ke Database dan Storage Supabase Cloud.
2. `src/domains/vault/services/VaultMemberService.ts`:
   - `getVaultMembers(vaultId)`: Mengambil anggota vault aktif beserta role (`admin`, `editor`, `contributor`, `viewer`).
   - `lookupUserByEmail(email)`: Auto-complete cepat mencari user terdaftar untuk diundang ke vault.
   - `addOrUpdateVaultMember(vaultId, userId, role)`: Menambah/mengubah role anggota vault.
   - `removeVaultMember(vaultId, userId)`: Menghapus akses anggota dari vault.
3. `src/domains/auth/hooks/useVaultPermission.ts`:
   - Hook terpusat yang membaca role pengguna di vault aktif:
     - `canEdit`: `true` untuk `contributor`, `editor`, `admin`, `superadmin`.
     - `canPublish`: `true` untuk `editor`, `admin`, `superadmin`.
     - `canManageMembers`: `true` untuk `admin`, `superadmin`.
     - `isReadOnly`: `true` untuk `viewer`.

---

B. Halaman & Komponen Superadmin (`/admin`)
1. `src/pages/Admin.tsx`:
   - Halaman kokpit responsif dengan proteksi guard. Menampilkan header status koneksi Supabase Cloud, navigasi tab adaptif (Desktop tabs / Mobile dropdown), dan tombol kembali ke workspace.
2. `src/domains/admin/components/FirstTimeSetupWizard.tsx`:
   - Layar aktivasi elegan yang muncul jika sistem belum memiliki superadmin, memungkinkan Anda mengklaim akun pertama dengan 1-klik.
3. `src/domains/admin/components/UserManagementTab.tsx`:
   - Tabel Pengguna Responsif: Pencarian instan (nama/email), filter role, badge avatar.
   - Optimistic UI: Perubahan role dan toggle status akun (Active/Suspended) merespons instan <50ms dengan rollback jika gagal.
   - User Drill-Down Modal: Menampilkan rincian vault milik pengguna dan riwayat audit aktivitasnya.
4. `src/domains/admin/components/AuditFeedTab.tsx`:
   - Human-Readable Cards: Menampilkan ringkasan aksi dalam bahasa yang mudah dibaca.
   - Filter Kategori: Filter instan (Role, Status Akun, Vault, Publishing).
   - Modal Detail JSON/Metadata: Pemeriksaan perbandingan nilai lama vs baru.
   - Ekspor CSV/JSON: Tombol unduh log audit.
5. `src/domains/admin/components/SystemArchitectureTab.tsx`:
   - Living Graph View: Graf node interaktif yang memetakan relasi subsistem aplikasi.
   - Bento Telemetry View: Kartu metrik modern yang terhubung ke live ping Supabase Cloud dan saklar kontrol modul dari `feature-toggles.ts`.
   - Diagnostics Table View: Tabel latensi dan status kepatuhan sistem.

---

C. Revamp Workspace Settings & Adaptive UI (`/app`)
1. `src/domains/settings/sections/RolesSettings.tsx` (Direvamp Total):
   - Menghilangkan placeholder "Coming soon".
   - Superadmin Gateway Banner: Menampilkan kartu perisai emas "Anda adalah Superadmin. Buka Cockpit Sistem Global ↗" jika akun aktif adalah superadmin.
   - Vault Members Manager: Input pencarian email pengguna, pemilih role, dan daftar anggota vault aktif saat ini dengan tombol hapus/ubah role.
2. Adaptasi Editor & Workflow (`NodePanel.tsx` / `EditorWorkflowToolbar.tsx`):
   - Menggunakan `useVaultPermission()` terpusat:
     - Jika `viewer`: Mode baca bersih.
     - Jika `contributor`: Tombol otomatis bertuliskan "Ajukan Review".
     - Jika `editor`/`admin`/`superadmin`: Tombol bertuliskan "Setujui & Terbitkan" lengkap dengan linter modal.

---

3. Alur Kerja & Jaminan Kualitas
- Zero-Duplication (DRY): Seluruh komponen UI memanfaatkan pustaka `@/shared/ui/` yang sudah ada (Card, Table, Dialog, Badge, Select, Sheet).
- Responsif Penuh: Tata letak grid otomatis adaptif dari layar smartphone (drawer + data cards) hingga layar monitor ultrawide (sidebar + multi-column grid).
- Integritas Database: Menggunakan fungsi RPC `is_superadmin()` dan `has_vault_permission()` yang sudah kita buat di migrasi Supabase pada Tahap 1.

---

Rencana arsitektur di atas telah siap. Apakah Anda ingin saya mulai menyusun dan menyajikan kode implementasinya untuk Anda terapkan di proyek lokal Anda?