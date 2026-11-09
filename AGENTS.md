# Project Rules

## Backend schema
- Recreate or repair the database by applying the SQL files already saved under `supabase/migrations/` in
  their existing order, byte-for-byte, instead of authoring parallel schema SQL. Why: those files are the app's
  schema source of truth, and divergent SQL silently breaks the typed client.
- Every `CREATE TABLE` in `public` must ship `GRANT` statements to `authenticated` (and `service_role`) in the
  same migration. Why: the data API grants no default privileges, so a table with RLS but no grants is unreachable.
- Storage buckets are created with the storage tools, never with SQL writes to `storage.buckets`. Why: that write
  path is rejected and aborts the whole migration.

## Application shell
- This is a Vite + React single-page app routed with `react-router-dom`; keep routing in that model and do not
  convert it to another router or framework. Why: the auth, workspace, and lazy-page wiring all assume it.
- Do not remove application source or installed packages as a "minimisation" step. Why: the user confirmed
  VaultGraph and its dependency set are the active app.

## Workspace and State Management
- Only free-force runs the D3 simulation; every other layout is a deterministic solver whose nodes are pinned after the transition. Decide this only via `layout/layoutCategory.ts`. Why: layering forces on solver targets (anchor forces) made the graph jitter endlessly.
- Workspace state and note mutations must use Zustand stores directly through pure action functions in `vaultSessionActions.ts`, never React Context providers. Why: eliminates app-wide re-render waterfalls across workspace leaves and provides predictable, testable state transitions.
- Graph data computations and edge styling are scoped to `useGraphData.ts` within the active graph leaf. Why: prevents non-graph leaves (Markdown, Sidebar, Settings) from recalculating or re-rendering on graph layout changes.
- Cross-vault switching and lifecycle orchestration are managed exclusively by `useVaultLifecycle.ts`. Why: unifies local vault persistence, cloud sync triggers, and window focus hooks in a single side-effect runner.
- Storage buckets (`avatars`, `vault-media`) are private and uploads must start with the user's ID folder; link files with `createSignedUrl`, never `getPublicUrl`. Why: the workspace blocks public buckets and storage policies check the first folder.
- Tables missing from generated DB types are queried via `src/shared/lib/untypedSupabase.ts` (loosely typed alias of the same client). Why: generated types are stale; swap back to the typed client once types are regenerated.
