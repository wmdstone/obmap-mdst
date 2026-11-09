-- Data API (PostgREST) does not grant default privileges on public tables.
-- Without these GRANT statements the app cannot reach its own tables even with RLS policies.

-- profiles: readable by signed-in users, public rows readable by anyone (per "Anyone can view public profiles")
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- vault tables: owner-only, so no anon access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vaults TO authenticated;
GRANT ALL ON public.user_vaults TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_history TO authenticated;
GRANT ALL ON public.vault_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_backups TO authenticated;
GRANT ALL ON public.vault_backups TO service_role;
