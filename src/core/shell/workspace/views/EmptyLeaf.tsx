import { FilePlus, Network, FolderOpen } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useVaultSession } from '../VaultSessionContext';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import type { LeafViewProps } from '../ViewRegistry';

export default function EmptyLeaf({ leaf }: LeafViewProps) {
  const { onAddNode } = useVaultSession();
  const setLeafView = useWorkspaceStore((s) => s.setLeafView);

  const actions = [
    { icon: FilePlus, label: 'New note', run: () => onAddNode('file') },
    {
      icon: Network,
      label: 'Open graph',
      run: () => setLeafView(leaf.id, { type: 'graph', title: 'Graph View' }),
    },
    {
      icon: FolderOpen,
      label: 'Vault management',
      run: () =>
        setLeafView(leaf.id, { type: 'settings', settingsSection: 'vaults', title: 'Settings' }),
    },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p className="text-sm">Nothing open here yet.</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {actions.map(({ icon: Icon, label, run }) => (
          <Button key={label} variant="outline" size="sm" onClick={run}>
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
