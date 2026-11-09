# Roadmap

- [x] Repair graph preview compilation errors and verify the affected graph tests.

- [x] Make the Settings Hub responsive across mobile, tablet, and desktop.
- [x] Consolidate graph layout, search, and filters into one compact tool rail.
- [x] Default the graph mini-map to its minimized state.
- [x] Make single click select and double click collapse or expand in both graph views.
- [x] Fix default and hierarchy link color opacity handling.
- [x] Add hierarchy-level node sizing with a configurable level interval.
- [x] Add synchronized Living Graph play and pause controls.
- [x] Validate TypeScript and the running preview.
- [x] Preserve and connect every Visual Graph Engine node, link, topology, and force setting.
- [x] Repair timeline milestone/detail placement and link routing.
- [x] Repair fishbone branch geometry and prevent node/link overlap.
- [x] Verify all graph modes and global settings in tests and the running preview.
- [x] Remove hidden label-box geometry from shape-only graph nodes.
- [x] Move cloud synchronization status into the workspace status bar.
- [x] Simplify the workspace ribbon and add the collapsible universal Settings sidebar.
- [x] Phase 0–2 (auth-vault roadmap): remove dead code, unify sync engine behind SyncEngine, single SyncCoordinator trigger.
- [x] Phase 3–4: UUID vault identity, cloud-matched vault dedup, vault-scoped config sections in ConfigService.
- [x] Phase 6: logout no longer destroys local vaults; sync queue scoped per user; consolidated duplicate auth listener.
- [x] Phase 5: folder vaults survive refresh via remembered directory handles (with permission re-prompt); one shared FileSystemService; shared folder-capability detection in the UI.
- [x] Connect Lovable Cloud and recreate the app schema from supabase/migrations (profiles, user_vaults, user_api_keys, vault_history, vault_backups, user_settings) with RLS and data-API grants.
- [x] Enable email/password and Google sign-in on the new backend; confirm the sign-in screen reaches it.
- [ ] Make the avatars bucket public — waiting on a workspace admin to allow public buckets in Settings → Privacy & Security.
- [ ] Verify the signed-in workspace end to end — waiting on a first account (sign up in the preview, or ask for the developer quick-login account to be created).


## Refactoring & Architecture Audit (Completed)
- [x] Phase 0: Test baseline established (64 unit tests green, Playwright screenshots preserved).
- [x] Phase 1: Modularized `GraphWorkspaceControls` into compact tool rails and isolated panel components.
- [x] Phase 2: Extracted `NodePanel` subviews (`NodeBreadcrumbBar`, `NodeMediaPreview`, `NodeBacklinksSection`).
- [x] Phase 3: Decoupled `SidebarPanel` into `FileExplorerTree`, `ExplorerContextMenu`, and folder hooks.
- [x] Phase 4: Isolated `GraphCanvas` gesture bridging, drag reparenting, and atmosphere rendering loops.
- [x] Phase 5: Centralized pure hierarchy traversal (`hierarchyTraversal.ts`) and unified color engine (`color-engine.ts`).
- [x] Phase 6: Added comprehensive characterization test suites for `VaultManager` and `ImportExportService` (98 tests green).
- [x] Phase 8: Eliminated monolithic `VaultSessionContext` (~700 LOC), migrated all leaves to Zustand selectors, and established `useVaultLifecycle`.
