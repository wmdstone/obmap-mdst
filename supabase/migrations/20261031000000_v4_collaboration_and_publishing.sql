-- ==============================================================================
-- TAHAP 1: FONDASI DATABASE & KONTROL AKSES (COLLABORATION & PUBLISHING)
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('superadmin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_member_role AS ENUM ('admin', 'editor', 'contributor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.note_status AS ENUM ('draft', 'in_review', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL: user_roles (Platform-level roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_platform_role UNIQUE (user_id, role)
);

-- 3. TABEL: vault_members (Per-vault collaboration roles)
CREATE TABLE IF NOT EXISTS public.vault_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES public.user_vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.vault_member_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_vault_member UNIQUE (vault_id, user_id)
);

-- 4. TABEL: notes (Granular note storage)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES public.user_vaults(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.note_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  author_id UUID NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_vault_note_slug UNIQUE (vault_id, slug)
);

-- 5. TABEL: note_revisions (Audit riwayat perubahan & visual diff)
CREATE TABLE IF NOT EXISTS public.note_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_summary TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABEL: note_links (Indeks relasi graf visual [[wiki-links]])
CREATE TABLE IF NOT EXISTS public.note_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES public.user_vaults(id) ON DELETE CASCADE,
  source_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_slug TEXT NOT NULL,
  target_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_source_target_link UNIQUE (source_note_id, target_slug)
);

-- 7. TABEL: audit_logs (Kepatuhan & jejak audit superadmin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexing untuk query cepat
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_members_vault_user ON public.vault_members(vault_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notes_vault_status ON public.notes(vault_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_slug ON public.notes(slug);
CREATE INDEX IF NOT EXISTS idx_note_revisions_note_id ON public.note_revisions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_vault_id ON public.note_links(vault_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action ON public.audit_logs(actor_id, action);

-- Trigger updated_at otomatis
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vault_members_updated_at
  BEFORE UPDATE ON public.vault_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 8. FUNGSI KEAMANAN (SECURITY DEFINER)
-- ==============================================================================

-- Cek apakah user saat ini adalah superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  );
$$;

-- Cek hierarki izin per-vault
CREATE OR REPLACE FUNCTION public.has_vault_permission(
  _vault_id UUID,
  _required_role public.vault_member_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_owner BOOLEAN;
  _member_role public.vault_member_role;
BEGIN
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Pemilik vault (user_vaults.user_id) otomatis memiliki hak penuh (Admin)
  SELECT EXISTS(
    SELECT 1 FROM public.user_vaults
    WHERE id = _vault_id AND user_id = _user_id
  ) INTO _is_owner;

  IF _is_owner THEN
    RETURN TRUE;
  END IF;

  -- 2. Evaluasi keanggotaan di vault_members
  SELECT role INTO _member_role
  FROM public.vault_members
  WHERE vault_id = _vault_id AND user_id = _user_id;

  IF _member_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Cek hierarki role
  CASE _required_role
    WHEN 'viewer' THEN
      RETURN _member_role IN ('admin', 'editor', 'contributor', 'viewer');
    WHEN 'contributor' THEN
      RETURN _member_role IN ('admin', 'editor', 'contributor');
    WHEN 'editor' THEN
      RETURN _member_role IN ('admin', 'editor');
    WHEN 'admin' THEN
      RETURN _member_role = 'admin';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: user_roles
CREATE POLICY "Users can view own role or superadmin can view all"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_superadmin());

CREATE POLICY "Only superadmin can modify user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Policies: vault_members
CREATE POLICY "Members can view vault membership"
  ON public.vault_members FOR SELECT
  TO authenticated
  USING (public.has_vault_permission(vault_id, 'viewer') OR public.is_superadmin());

CREATE POLICY "Admins can manage vault membership"
  ON public.vault_members FOR ALL
  TO authenticated
  USING (public.has_vault_permission(vault_id, 'admin') OR public.is_superadmin())
  WITH CHECK (public.has_vault_permission(vault_id, 'admin') OR public.is_superadmin());

-- Policies: notes
-- Catatan 'published' dapat diakses anon/siapa saja (Portal Pembaca Publik /p/:slug)
CREATE POLICY "Public read for published notes or member read for drafts"
  ON public.notes FOR SELECT
  USING (status = 'published' OR public.has_vault_permission(vault_id, 'viewer') OR public.is_superadmin());

CREATE POLICY "Contributors can create notes"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_vault_permission(vault_id, 'contributor') AND auth.uid() = author_id)
    OR public.is_superadmin()
  );

CREATE POLICY "Editors can update any note, contributors can update own drafts"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (
    public.has_vault_permission(vault_id, 'editor')
    OR (public.has_vault_permission(vault_id, 'contributor') AND author_id = auth.uid() AND status != 'published')
    OR public.is_superadmin()
  );

CREATE POLICY "Admins can delete notes"
  ON public.notes FOR DELETE
  TO authenticated
  USING (public.has_vault_permission(vault_id, 'admin') OR public.is_superadmin());

-- Policies: note_revisions
CREATE POLICY "Members can view revisions"
  ON public.note_revisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_revisions.note_id AND public.has_vault_permission(notes.vault_id, 'viewer'))
    OR public.is_superadmin()
  );

CREATE POLICY "Contributors can create revisions"
  ON public.note_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_revisions.note_id AND public.has_vault_permission(notes.vault_id, 'contributor'))
    OR public.is_superadmin()
  );

-- Policies: note_links
CREATE POLICY "Public read for links of published notes or members read all"
  ON public.note_links FOR SELECT
  USING (
    public.has_vault_permission(vault_id, 'viewer')
    OR EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_links.source_note_id AND notes.status = 'published')
    OR public.is_superadmin()
  );

CREATE POLICY "Editors can manage note links"
  ON public.note_links FOR ALL
  TO authenticated
  USING (public.has_vault_permission(vault_id, 'editor') OR public.is_superadmin())
  WITH CHECK (public.has_vault_permission(vault_id, 'editor') OR public.is_superadmin());

-- Policies: audit_logs
CREATE POLICY "Users can view own actions, superadmins view all"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid() OR public.is_superadmin());

CREATE POLICY "Authenticated users can record audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_superadmin());

-- ==============================================================================
-- 10. GRANTS PERMISSIONS
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_members TO authenticated;
GRANT ALL ON public.vault_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT ON public.notes TO anon; -- Izin akses baca untuk publik
GRANT ALL ON public.notes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_revisions TO authenticated;
GRANT ALL ON public.note_revisions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_links TO authenticated;
GRANT SELECT ON public.note_links TO anon; -- Izin render graf untuk publik
GRANT ALL ON public.note_links TO service_role;

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- ==============================================================================
-- 11. STORAGE BUCKET: vault-media
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-media',
  'vault-media',
  true,
  10485760, -- Batas maks 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read for vault-media assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vault-media');

CREATE POLICY "Authenticated users can upload vault-media assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vault-media');

CREATE POLICY "Authenticated users can update their uploaded assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their uploaded assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);
