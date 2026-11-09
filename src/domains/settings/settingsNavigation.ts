import {
  Cloud,
  Database,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  UserCircle,
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
  | 'roles'; // Dipertahankan di level tipe untuk backward compatibility

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  group: string;
  icon: LucideIcon;
  description: string;
}

// 4 Grup Utama yang Rapi & Ringkas (Grup 'Collaboration' dilebur ke 'Account & Profile')
export const SETTINGS_GROUPS = [
  'Account & Profile',
  'Vault Management',
  'System & Sync',
  'Editor & Schema',
] as const;

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { 
    id: 'account', 
    label: 'Account & Profile', 
    group: 'Account & Profile', 
    icon: UserCircle, 
    description: 'Profil, sesi login, kolaborasi hak akses vault, dan kredensial API.' 
  },
  { 
    id: 'vaults', 
    label: 'Vault Management', 
    group: 'Vault Management', 
    icon: Database, 
    description: 'Vault aktif, penyimpanan lokal/cloud, backup, serta impor & ekspor.' 
  },
  { 
    id: 'system', 
    label: 'System & Sync', 
    group: 'System & Sync', 
    icon: Cloud, 
    description: 'Status koneksi cloud, antrean unggah, dan cache offline.' 
  },
  { 
    id: 'features', 
    label: 'Features', 
    group: 'System & Sync', 
    icon: ToggleLeft, 
    description: 'Nyalakan atau matikan modul eksperimental aplikasi.' 
  },
  { 
    id: 'configuration', 
    label: 'Configuration Vault', 
    group: 'System & Sync', 
    icon: SlidersHorizontal, 
    description: 'Penyimpanan preferensi aplikasi, ekspor, impor, dan reset.' 
  },
  { 
    id: 'editor', 
    label: 'Editor', 
    group: 'Editor & Schema', 
    icon: Pencil, 
    description: 'Tipografi, pengetikan, asisten penulisan, dan bilah alat markdown.' 
  },
  { 
    id: 'schema', 
    label: 'Properties & Schema', 
    group: 'Editor & Schema', 
    icon: ShieldCheck, 
    description: 'Aturan properti global yang diwariskan ke setiap catatan.' 
  },
];

export function isSettingsSectionId(value: string | undefined): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value) || value === 'roles';
}