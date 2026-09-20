import {
  Cloud,
  Database,
  Network,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type SettingsSectionId =
  | 'account'
  | 'vaults'
  | 'system'
  | 'features'
  | 'configuration'
  | 'editor'
  | 'schema'
  | 'graph'
  | 'roles';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  group: string;
  icon: LucideIcon;
  description: string;
}

export const SETTINGS_GROUPS = [
  'Account & Profile',
  'Vault Management',
  'System & Sync',
  'Editor & Schema',
  'Visual',
  'Collaboration',
] as const;

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'account', label: 'Account & Profile', group: 'Account & Profile', icon: UserCircle, description: 'Session, profile details, plan and API keys.' },
  { id: 'vaults', label: 'Vault Management', group: 'Vault Management', icon: Database, description: 'Active vault, storage adapter, backups, import and export.' },
  { id: 'system', label: 'System & Sync', group: 'System & Sync', icon: Cloud, description: 'Connection state, pending uploads and offline cache.' },
  { id: 'features', label: 'Features', group: 'System & Sync', icon: ToggleLeft, description: 'Turn parts of the app on or off.' },
  { id: 'configuration', label: 'Configuration Vault', group: 'System & Sync', icon: SlidersHorizontal, description: 'Where your settings are saved, plus export, import and reset.' },
  { id: 'editor', label: 'Editor', group: 'Editor & Schema', icon: Pencil, description: 'Typography, typing behaviour, assistance and toolbar.' },
  { id: 'schema', label: 'Properties & Schema', group: 'Editor & Schema', icon: ShieldCheck, description: 'Global property rules inherited by every note.' },
  { id: 'graph', label: 'Visual Graph Engine', group: 'Visual', icon: Network, description: 'Default layout, colours, link routing and depth rules.' },
  { id: 'roles', label: 'User Roles', group: 'Collaboration', icon: Users, description: 'Who can write, review and publish.' },
];

export function isSettingsSectionId(value: string | undefined): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}