export type AppRole = 'superadmin' | 'member';

export type VaultMemberRole = 'admin' | 'editor' | 'contributor' | 'viewer';

export type NoteStatus = 'draft' | 'in_review' | 'published' | 'archived';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface VaultMemberRecord {
  id: string;
  vault_id: string;
  user_id: string;
  role: VaultMemberRole;
  invited_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRecord {
  id: string;
  vault_id: string;
  slug: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  status: NoteStatus;
  version: number;
  author_id: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRevisionRecord {
  id: string;
  note_id: string;
  version: number;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  diff_summary?: string | null;
  created_by: string;
  created_at: string;
}

export interface NoteLinkRecord {
  id: string;
  vault_id: string;
  source_note_id: string;
  target_slug: string;
  target_note_id?: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}