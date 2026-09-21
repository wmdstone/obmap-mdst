\# Deep Audit: Auth, Vault, Storage, Config, Sync



Read-only audit. No code changed. On approval this document is written to `PLAN.MD` at the project root (the existing `plan.md` is a different, older document and stays untouched).



\## 1. System Diagnosis \& Root Cause Analysis



\### 1.1 Three sync systems write to the same cloud table

\- `src/core/vault/VaultSyncService.ts` — whole-vault push/pull, pure last-write-wins on timestamps (`:201-217`). Pull overwrites the local graph wholesale; push overwrites the cloud row without ever checking whether the cloud moved ahead.

\- `src/core/sync/SyncEngine.ts` — per-note dirty tracking, offline queue (`src/core/sync/sync-queue.ts`), base-version conflict detection and `(conflict YYYY-MM-DD)` copies (`:207-302`). This is the one wired into live editing (`VaultSessionContext.tsx:112-113`).

\- `src/core/sync/BackgroundSyncService.ts` — a third queue in `localStorage\['vault\_pending\_changes']`; its `syncSingleChange` (`:141-154`) only re-emits an event and never persists anything. Effectively dead, yet still holds an `online` listener.



Both real engines call `cloudVaultService.updateVault/createVault` on the same `user\_vaults` row with no shared coordination token. `VaultSyncService` neither sets nor reads `SyncEngine`'s `baseUpdatedAt`, so a login-time pull can discard locally dirty notes that `SyncEngine` would have preserved as conflict copies. \*\*This is the primary cause of "data not up to date" and lost edits.\*\*



\### 1.2 Login fans out into 3+ concurrent syncs

Three separately mounted components each run their own `isAuthenticated` effect calling `vaultManager.initialize()` + `vaultSyncService.syncFromCloud()`:

\- `src/features/workspace/VaultSessionContext.tsx:222-234`

\- `src/features/vault-dashboard/hooks/useVaultSync.tsx:64-75`

\- `src/features/vault-dashboard/VaultRequiredGate.tsx:40-57`



Plus `src/core/config/useConfigSync.ts:45-60`, which pulls config on `\[user]` \*\*and\*\* registers its own `onAuthStateChange` that re-pulls on `TOKEN\_REFRESHED` — i.e. on every silent token refresh, not just login. `useVaultSync.tsx:56-61` also runs a permanent 1s interval per mount purely for a UI label. Two independent `online` listeners exist (`SyncEngine:59-63`, `BackgroundSyncService:64-77`).



\### 1.3 Why vaults duplicate across devices

Vault identity is a locally generated `vault-<timestamp>-<random>` (`VaultManager.ts:140, 216`). `cloudId` only exists after the first successful upload, and matching is done \*solely\* by `cloudId` (`VaultSyncService.ts:196-199`). `createVault` can be called from three places (`SyncEngine.ts:217-226`, `VaultSyncService.ts:132-146`, `:313-325`) with no dedupe by name/owner and no server-side uniqueness in this code. Two devices (or two racing login effects) each holding an unlinked local vault therefore create two cloud rows for "the same" vault, after which they diverge permanently. `importCloudVault` (`:239-260`) always creates a \*new\* local vault for any cloud row without a local `cloudId`, compounding the same-name duplication.



\### 1.4 Why sessions drop

\- Preview auth broker `src/integrations/supabase/previewAuthStorage.ts`: an empty-string reply is treated as a hard logout tombstone and deletes the local session (`:73-75`); every read round-trips `postMessage` with a 2000 ms timeout and silently falls back to `localStorage` (`:77`); writes are fire-and-forget (`:81, :85`), so broker and local copy can disagree until the next read.

\- `useAuth.signOut` (`useAuth.tsx:223-240`) deletes the whole `VaultManagerDB` IndexedDB before signing out — \*\*every logout wipes all local vaults\*\*, including offline-only ones with unsynced edits.

\- The `SyncEngine` offline queue (`VaultSyncQueueDB`) is never scoped to `user.id` and is not cleared on sign-out, so queued vault payloads can leak into the next account on a shared device.

\- Two independent `onAuthStateChange` subscriptions (`useAuth.tsx:134-150`, `useConfigSync.ts:51-58`) each kick off async work, widening the race window during OAuth redirects.



\### 1.5 The config dualism, precisely

| Format | Written by | Read by | Status |

|---|---|---|---|

| `obmap-config-<date>.json` (all sections in one file) | `ConfigService.exportConfig` (`:293-304`) via `ConfigurationSettings.tsx:35-45` | `ConfigService.importConfig` (`:307-340`) | Live, manual button only |

| `.obmap/<section>.json` folder mirror | `FolderConfigStore.writeSections` (`FolderConfigStore.ts:20-31`) | nothing | \*\*Dead\*\* — `ConfigService.persist()` never calls it; exported from `core/config/index.ts:6` and unused. Silent no-op, no error |

| `.vault-config.json` (graph + backup config only) | `FileSystemService.writeVaultConfig` (`:266-279`) via `VaultManager.setGraphConfig` (`:484-489`) | `VaultManager.openLocalFolderVault` (`:230`) | Live, but covers 2 of \~9 setting sections |

| `.vaultconfig` (name/exportedAt/nodeCount only) | `ExportToFileSystem.tsx:120-129` | nothing | Write-only marker, confusingly named |



The real live pipeline is `ConfigService` → `LocalConfigStore` (IndexedDB `ObmapConfigDB`) + `CloudConfigStore` (Supabase `user\_settings`). Because `FolderConfigStore` is never invoked, no `.obmap`/`.obsidian`-style folder is ever produced — in \*\*any\*\* environment. The behaviour the app appears to promise does not exist.



\### 1.6 Storage conflicts

\- Graph config is persisted twice, independently, with no reconciliation: as `vault.graphConfig` in `VaultStorage` (IndexedDB `VaultManagerDB`) and as the `graph` section in `LocalConfigStore`/`user\_settings`.

\- Backup config lives in three places: `localStorage\['vault\_backup\_configs']` (`VaultBackupService.ts:34-58`), `vault.backupConfig` in IndexedDB, and the `backup\_config` column in the cloud. `VaultManager.getBackupConfig` (`:552-559`) reads one and falls back to another.

\- `FileSystemService` is instantiated three times (`VaultManager.ts:220`, `useVault.tsx:63`, DI via `FolderConfigStore`), each with its own `vaultHandle` — one instance cannot see another's open folder.



\## 2. Script Relationship Map \& Duplication Audit



\*\*Auth\*\* — `integrations/supabase/client.ts`, `previewAuthStorage.ts`, `features/auth/useAuth.tsx` (+ `devAuth.ts`, `AuthForm.tsx`, `ProtectedRoute.tsx`). Duplication: `src/features/auth/ProtectedRoute.tsx` and `src/shared/components/ProtectedRoute.tsx`; a second auth listener in `useConfigSync.ts`.



\*\*Vault\*\* — `core/vault/VaultManager.ts` (+ `VaultManagerSingleton`, `VaultHistory`, `types`), `features/workspace/VaultSessionContext.tsx` (live CRUD), `pages/VaultDashboard.tsx`, `shared/stores/useVaultStore.ts`. Duplication: `features/vault-dashboard/hooks/useVault.tsx` is a complete parallel vault stack with its own `FileSystemService` + `GraphService` and \*\*zero importers\*\* — dead code. `VaultSessionContext` re-implements commit → history → save → sync logic that also lives in `VaultManager`.



\*\*Storage\*\* — `core/vault/VaultStorage.ts` (IndexedDB), `core/persistence/FileSystemService.ts` (File System Access API), `core/persistence/offline-storage.ts` (Cache API), `core/vault/CloudVaultService.ts` (Supabase), `core/config/LocalConfigStore.ts` (a second IndexedDB). Duplication: two offline subsystems that never talk (Cache API vs. the write queue in `BackgroundSyncService`); three sources of truth for backup config.



\*\*Config\*\* — `core/config/{ConfigService,LocalConfigStore,CloudConfigStore,FolderConfigStore,registry,sections/index,types,useConfigSync}.ts`, `features/settings/sections/ConfigurationSettings.tsx`, plus `.vault-config.json` in `FileSystemService`/`VaultManager` and `.vaultconfig` in `ExportToFileSystem.tsx`. Duplication: four formats, two of them write-only/dead.



\*\*Sync\*\* — `core/sync/{SyncEngine,BackgroundSyncService,sync-queue}.ts`, `core/vault/VaultSyncService.ts`, `features/vault-dashboard/hooks/useVaultSync.tsx`, `features/settings/SyncPanel.tsx`, `features/sync/\*Indicator.tsx`, `core/config/useConfigSync.ts`. Duplication: two live engines + one dead one; three login-triggered pulls; two `online` listeners.



\*\*Import/Export\*\* — `features/import-export/services/ImportExportService.ts` vs. `graph-export.ts`/`graph-import.ts` + `core/graph/ZipImportService.ts`: two ZIP formats with different frontmatter conventions.



\## 3. Architecture Evaluation



The intent (local-first vault, optional cloud mirror) is sound; the implementation lacks a single owner per concern. Concretely:

\- \*\*No environment abstraction.\*\* Nothing exposes "which storage adapter backs this vault" as a single interface. Instead, `vault.type`/`storageStrategy` is branched on ad hoc, and filesystem-only calls silently no-op (`readVaultConfig`/`writeVaultConfig` return `null`/`false`; `FolderConfigStore` returns `false`) instead of reporting that a setting was not saved.

\- \*\*Local-folder vaults cannot survive a refresh.\*\* Directory handles are not persisted (`VaultManager.ts:102`), and folder vaults are stored with an empty `graphData` (`:261`), so the metadata row survives while the content does not.

\- \*\*`window.showDirectoryPicker` is called without feature detection\*\* in `VaultManager.openLocalFolderVault` (`:213-214`); only `ExportToFileSystem` checks first.

\- \*\*Cloud has no counterpart for the folder config.\*\* Since `.obmap` is never written even locally, "cloud does not create the folder" is a symptom of a feature that was designed but never wired, not of a cloud-specific gap.

\- \*\*Deleting a vault locally never deletes its cloud row\*\* — `VaultManager.deleteVault` returns `cloudId`/`wasCloudVault` and leaves cleanup to callers.



\## 4. Proposed Resolution Strategy



\*\*Phase 0 — Freeze and delete dead weight (no behaviour change)\*\*

Remove `useVault.tsx`, `BackgroundSyncService`, `.vaultconfig` writing, and either wire or delete `FolderConfigStore`. Consolidate the duplicate `ProtectedRoute`.



\*\*Phase 1 — One sync engine\*\*

Keep `SyncEngine` (queue + base version + conflict copies) as the only writer to `user\_vaults`. Reduce `VaultSyncService` to a thin facade delegating to it, or retire it. All pulls must consult the dirty set instead of overwriting wholesale.



\*\*Phase 2 — One sync trigger\*\*

A single `SyncCoordinator`: one auth-state subscription, one `online` listener, a mutex plus debounce so overlapping requests coalesce, and explicit handling that `TOKEN\_REFRESHED` does \*not\* trigger a full pull. Remove the three login effects and the 1s polling interval (use the existing status subscription).



\*\*Phase 3 — Stable vault identity\*\*

Generate a UUID at creation and use it as the cloud primary key so local and cloud ids are the same value; add a unique constraint on `(user\_id, vault\_uuid)`; make `importCloudVault` match by that id. Route all cloud creation through one function. Wire cloud deletion into `deleteVault`.



\*\*Phase 4 — Single source of truth for configuration\*\*

`ConfigService` owns every setting. Vault-scoped sections (graph, graph-engine, workspace, schema) move out of `vault.graphConfig`/`vault.backupConfig` and out of `localStorage\['vault\_backup\_configs']`. `.vault-config.json` / `.obmap/\*.json` become a \*derived export\* written by one adapter when a folder handle exists, never a second source of truth. `obmap-config-<date>.json` stays as the manual portability format and shares the exact same serializer.



\*\*Phase 5 — Storage adapters behind one interface\*\*

`VaultRepository` with `memory` / `indexeddb` / `filesystem` / `cloud` adapters; capability flags (`canWriteFolderConfig`, `canPersistHandle`) so the UI can disable rather than silently no-op. Persist directory handles in IndexedDB with permission re-prompt on load.



\*\*Phase 6 — Session hardening\*\*

Stop wiping `VaultManagerDB` on sign-out (only drop cloud-backed copies, keep local-only vaults, or ask first). Scope the sync queue by `user.id` and clear it on account change. Treat a broker timeout as "unknown" rather than tombstoning the session.



\### Definition of the single sources of truth

\- \*\*Session:\*\* the one Supabase client; `useAuth` the only auth listener.

\- \*\*Vault content:\*\* `VaultRepository` for the active vault; the cloud row keyed by the shared UUID for cross-device truth.

\- \*\*Settings:\*\* `ConfigService` (`user\_settings` when signed in, `ObmapConfigDB` offline); files are exports only.

\- \*\*Sync state:\*\* `SyncEngine` + its queue; every indicator reads from it.



