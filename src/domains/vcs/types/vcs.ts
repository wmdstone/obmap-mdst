export type VcsScope = 'vault' | 'folder' | 'file';
export type VcsItemType = 'markdown' | 'canvas' | 'binary' | 'folder';
export type VcsChangeType = 'added' | 'modified' | 'deleted' | 'renamed';
export type VcsMergeStatus = 'open' | 'merged' | 'closed';

export interface VcsBranch {
  id: string;
  vaultId: string;
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  isArchived: boolean;
  autoDeleteOnMerge: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VcsBlob {
  blobHash: string;
  vaultId: string;
  contentText?: string | null;
  storagePath?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface VcsCommit {
  id: string;
  vaultId: string;
  branchId: string;
  commitHash: string;
  parentCommitId: string | null;
  message: string;
  scope: VcsScope;
  targetPath: string | null;
  authorId: string;
  isRevert: boolean;
  revertedCommitId: string | null;
  createdAt: string;
  author?: {
    displayName: string;
    avatarUrl?: string;
    email?: string;
  };
}

export interface VcsCommitItem {
  id: string;
  commitId: string;
  path: string;
  blobHash: string;
  itemType: VcsItemType;
  title: string;
  changeType: VcsChangeType;
  sizeBytes: number;
}

export interface VcsMergeRequest {
  id: string;
  vaultId: string;
  sourceBranchId: string;
  targetBranchId: string;
  title: string;
  description: string | null;
  status: VcsMergeStatus;
  authorId: string;
  mergedBy: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceBranch?: VcsBranch;
  targetBranch?: VcsBranch;
}

// Struktur Micro-Revision Lokal (IndexedDB - P1 & P6)
export interface LocalMicroRevision {
  id: string;
  vaultId: string;
  branchId: string;
  noteId: string;
  path: string;
  title: string;
  content: string;
  timestamp: number;
  expiresAt: number; // TTL 6 Hari (Garbage Collection)
}

// Struktur Auto-Stash Lokal saat Ganti Branch (P10)
export interface LocalBranchStash {
  vaultId: string;
  branchId: string;
  stashedAt: number;
  items: {
    noteId: string;
    path: string;
    title: string;
    content: string;
  }[];
}

// Struktur Co-Presence Realtime (P10)
export interface DocumentCoPresenceUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  lastActive: number;
  isTyping?: boolean;
}

// Hasil Validasi Graf pada 3-Way Merge (Penyempurnaan 1)
export interface GraphMergeValidationResult {
  hasBrokenLinks: boolean;
  brokenLinks: {
    sourcePath: string;
    targetSlug: string;
    line: number;
  }[];
}