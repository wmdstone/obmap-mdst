/**
 * Unified Settings Hub — Pusat pengaturan modern dengan navigasi minimalis.
 */

import { ScrollArea } from "@/shared/ui/scroll-area";
import { EditorSettingsContent } from "@/domains/editor/settings/EditorSettingsPanel";
import { FeatureTogglesPanel } from "@/domains/settings/FeatureTogglesPanel";
import { SyncPanel } from "@/domains/settings/SyncPanel";
import { SchemaSettings } from "@/domains/settings/sections/SchemaSettings";
import { AccountSettings } from "@/domains/settings/sections/AccountSettings";
import { VaultSettings } from "@/domains/settings/sections/VaultSettings";
import { ConfigurationSettings } from "@/domains/settings/sections/ConfigurationSettings";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settingsNavigation";

export interface SettingsHubProps {
  active?: SettingsSectionId;
  onSectionChange?: (section: SettingsSectionId) => void;
}

export function SettingsHub({
  active = "account",
  onSectionChange,
}: SettingsHubProps) {
  // Jika active adalah 'roles', arahkan ke 'account' dengan tab 'roles'
  const resolvedActive = active === "roles" ? "account" : active;
  const section =
    SETTINGS_SECTIONS.find((s) => s.id === resolvedActive) ?? SETTINGS_SECTIONS[0];
  const ActiveIcon = section.icon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header Dinamis Ringkas */}
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6 bg-card/40 backdrop-blur-xs">
          <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">
              {section.label}
            </h1>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {section.description}
            </p>
          </div>
        </header>

        {/* Konten Halaman */}
        {resolvedActive === "editor" ? (
          <EditorSettingsContent />
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
              {(resolvedActive === "account" || active === "roles") && (
                <AccountSettings initialTab={active === "roles" ? "roles" : "profile"} />
              )}
              {resolvedActive === "vaults" && <VaultSettings />}
              {resolvedActive === "system" && <SyncPanel />}
              {resolvedActive === "features" && <FeatureTogglesPanel />}
              {resolvedActive === "schema" && <SchemaSettings />}
              {resolvedActive === "configuration" && <ConfigurationSettings />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}