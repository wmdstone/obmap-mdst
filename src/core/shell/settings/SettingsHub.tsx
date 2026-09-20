/**
 * Unified Settings Hub — one place for every app configuration, with a quiet
 * sidebar navigation instead of scattered sheets.
 */

import { ScrollArea } from "@/shared/ui/scroll-area";
import { EditorSettingsContent } from "@/core/editor/settings/EditorSettingsPanel";
import { FeatureTogglesPanel } from "@/core/shell/settings/FeatureTogglesPanel";
import { SyncPanel } from "@/core/shell/settings/SyncPanel";
import { SchemaSettings } from "@/core/shell/settings/sections/SchemaSettings";
import { GraphEngineSettings } from "@/core/shell/settings/sections/GraphEngineSettings";
import { RolesSettings } from "@/core/shell/settings/sections/RolesSettings";
import { AccountSettings } from "@/core/shell/settings/sections/AccountSettings";
import { VaultSettings } from "@/core/shell/settings/sections/VaultSettings";
import { ConfigurationSettings } from "@/core/shell/settings/sections/ConfigurationSettings";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settingsNavigation";

export function SettingsHub({
  active = "account",
}: {
  active?: SettingsSectionId;
}) {
  const section =
    SETTINGS_SECTIONS.find((s) => s.id === active) ?? SETTINGS_SECTIONS[0];
  const ActiveIcon = section.icon;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-border px-3 py-3 sm:px-6">
          <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">
              {section.label}
            </h1>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {section.description}
            </p>
          </div>
        </header>

        {active === "editor" ? (
          <EditorSettingsContent />
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
              {active === "account" && <AccountSettings />}
              {active === "vaults" && <VaultSettings />}
              {active === "system" && <SyncPanel />}

              {active === "features" && <FeatureTogglesPanel />}
              {active === "schema" && <SchemaSettings />}
              {active === "graph" && <GraphEngineSettings />}
              {active === "configuration" && <ConfigurationSettings />}
              {active === "roles" && <RolesSettings />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
