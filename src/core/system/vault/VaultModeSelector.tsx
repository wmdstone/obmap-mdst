/**
 * Vault creation dialog.
 *
 * Two real choices, no browser-memory option:
 *  - a folder on this computer (create a new one, or open an existing one)
 *  - a cloud vault that lives in the account
 *
 * The folder picker opens exactly once, and errors are shown here instead of
 * closing the dialog silently.
 */

import { useState } from 'react';
import { HardDrive, FolderOpen, Plus, AlertTriangle, ArrowLeft, Cloud, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { pickVaultFolder, supportsFolderPicker } from '@/core/system/vault/repository/capabilities';

type VaultKind = 'folder' | 'cloud';
type Step = 'kind' | 'folder-action' | 'name';

export interface VaultModeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create a brand new vault folder called `name` inside the picked folder. */
  onCreateFolderVault: (
    handle: FileSystemDirectoryHandle,
    name: string,
    cloudSync: boolean
  ) => Promise<string | null>;
  /** Use the picked folder itself as the vault. */
  onOpenFolderVault: (handle: FileSystemDirectoryHandle) => Promise<string | null>;
  /** Create a vault that lives in the account. */
  onCreateCloudVault: (name: string) => Promise<string | null>;
  onVaultCreated: (vaultId: string) => void;
  isAuthenticated?: boolean;
}

const supportsFolders = supportsFolderPicker;

async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  return pickVaultFolder();
}

export const VaultModeSelector = ({
  open,
  onOpenChange,
  onCreateFolderVault,
  onOpenFolderVault,
  onCreateCloudVault,
  onVaultCreated,
  isAuthenticated = false,
}: VaultModeSelectorProps) => {
  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<VaultKind>('folder');
  const [vaultName, setVaultName] = useState('');
  const [cloudSync, setCloudSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('kind');
    setKind('folder');
    setVaultName('');
    setCloudSync(false);
    setBusy(false);
    setError(null);
  };

  const finish = (vaultId: string | null) => {
    if (!vaultId) return;
    onVaultCreated(vaultId);
    onOpenChange(false);
    reset();
  };

  const describeError = (err: unknown) => {
    if (err instanceof Error) {
      if (err.name === 'AbortError') return null;
      if (err.name === 'NotAllowedError') return 'Permission to use that folder was denied.';
      return err.message;
    }
    return 'Something went wrong.';
  };

  const handleOpenExisting = async () => {
    setError(null);
    setBusy(true);
    try {
      const handle = await pickFolder();
      if (!handle) return;
      finish(await onOpenFolderVault(handle));
    } catch (err) {
      const message = describeError(err);
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!vaultName.trim()) {
      setError('Please enter a vault name');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (kind === 'cloud') {
        finish(await onCreateCloudVault(vaultName.trim()));
      } else {
        const handle = await pickFolder();
        if (!handle) return;
        finish(await onCreateFolderVault(handle, vaultName.trim(), cloudSync));
      }
    } catch (err) {
      const message = describeError(err);
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) reset();
      }}
    >
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {step === 'kind' && 'Where should this vault live?'}
            {step === 'folder-action' && 'Folder on this computer'}
            {step === 'name' && (kind === 'cloud' ? 'New cloud vault' : 'New vault folder')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 'kind' && 'Notes in a folder on this computer, or in your account.'}
            {step === 'folder-action' && 'Create a new vault folder, or open one you already have.'}
            {step === 'name' && 'Give the vault a name.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {step === 'kind' && (
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <button
              className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-40"
              disabled={!supportsFolders()}
              onClick={() => {
                setKind('folder');
                setStep('folder-action');
                setError(null);
              }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Folder on this computer</div>
                  <Badge variant="secondary" className="mt-0.5 text-[10px]">
                    Markdown files
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {supportsFolders()
                  ? 'Notes are real .md files you can open in any editor. Cloud sync optional.'
                  : 'This browser cannot open folders — use Chrome or Edge on desktop.'}
              </p>
            </button>

            <button
              className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/50"
              onClick={() => {
                setKind('cloud');
                setStep('name');
                setCloudSync(true);
                setError(null);
              }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Cloud vault</div>
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {isAuthenticated ? 'Synced' : 'Sign in to sync'}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Lives in your account and follows you across devices. You can attach a folder later.
              </p>
            </button>
          </div>
        )}

        {step === 'folder-action' && (
          <div className="space-y-3 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/50"
                disabled={busy}
                onClick={() => {
                  setStep('name');
                  setError(null);
                }}
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-2 text-green-400">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground">Create new</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  We create a new vault folder inside a folder you pick.
                </p>
              </button>

              <button
                className="group rounded-xl border border-border bg-secondary/30 p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/50"
                disabled={busy}
                onClick={handleOpenExisting}
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  </div>
                  <span className="font-medium text-foreground">Open existing</span>
                </div>
                <p className="text-xs text-muted-foreground">Pick a folder that already holds your notes.</p>
              </button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setStep('kind')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-4 py-4">
            <Input
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && handleCreate()}
              placeholder={kind === 'cloud' ? 'My cloud vault' : 'My vault'}
              autoFocus
            />

            {kind === 'folder' && (
              <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <Checkbox
                  checked={cloudSync}
                  onCheckedChange={(checked) => setCloudSync(checked === true)}
                  disabled={!isAuthenticated}
                />
                <span className="text-xs text-muted-foreground">
                  Also keep a synced copy in my account
                  {!isAuthenticated && ' (sign in first)'}
                </span>
              </label>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(kind === 'cloud' ? 'kind' : 'folder-action')}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreate} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {kind === 'folder' ? 'Choose folder & create' : 'Create vault'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
