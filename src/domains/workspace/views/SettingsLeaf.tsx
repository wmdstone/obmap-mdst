import { SettingsHub } from "@/domains/settings/SettingsHub";
import { isSettingsSectionId, type SettingsSectionId } from "@/domains/settings/settingsNavigation";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";
import type { LeafViewProps } from "@/domains/workspace/registry/ViewRegistry";

export default function SettingsLeaf({ leaf }: LeafViewProps) {
  const section = isSettingsSectionId(leaf.view.settingsSection)
    ? leaf.view.settingsSection
    : "account";

  const handleSectionChange = (newSec: SettingsSectionId) => {
    useWorkspaceStore.getState().setLeafView(leaf.id, {
      ...leaf.view,
      settingsSection: newSec,
    });
  };

  return <SettingsHub active={section} onSectionChange={handleSectionChange} />;
}