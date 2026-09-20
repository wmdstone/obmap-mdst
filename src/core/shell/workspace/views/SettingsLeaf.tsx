import { SettingsHub } from "@/core/shell/settings/SettingsHub";
import { isSettingsSectionId } from "@/core/shell/settings/settingsNavigation";
import type { LeafViewProps } from "../ViewRegistry";

export default function SettingsLeaf({ leaf }: LeafViewProps) {
  const section = isSettingsSectionId(leaf.view.settingsSection)
    ? leaf.view.settingsSection
    : "account";

  return <SettingsHub active={section} />;
}
