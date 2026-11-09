import type { AppRole, VaultMemberRole } from "./collaboration";

export type AccountStatus = "active" | "suspended";

export interface UserWithRole {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: AppRole;
  status?: AccountStatus;
  vault_count?: number;
}

export interface SystemMetrics {
  totalNotes: number;
  draftNotes: number;
  inReviewNotes: number;
  publishedNotes: number;
  totalVaults: number;
  totalUsers: number;
  dbPingMs: number;
  storagePingMs?: number;
  hasSuperadminConfigured: boolean;
}

export interface VaultMemberWithProfile {
  id: string;
  vault_id: string;
  user_id: string;
  role: VaultMemberRole;
  created_at: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

// SystemTelemetryContract: Sumber data tunggal untuk 3 Tampilan Visualizer
export type SubsystemStatus = "healthy" | "degraded" | "failing";

export interface SubsystemNode {
  id: string;
  name: string;
  category: "engine" | "security" | "storage" | "network";
  status: SubsystemStatus;
  latencyMs: number;
  uptimePercent: number;
  description: string;
  dependencies: string[];
  enabled: boolean;
}

export interface DiagnosticsEntry {
  id: string;
  timestamp: string;
  subsystem: string;
  severity: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export interface SystemTelemetryContract {
  nodes: SubsystemNode[];
  diagnostics: DiagnosticsEntry[];
  memoryUsageMb: number;
  activeListeners: number;
  syncQueueDepth: number;
}