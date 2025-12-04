import { useEffect, useState } from 'react';
import { Cloud, CloudOff, CheckCircle } from 'lucide-react';
import { eventBus, EventType } from '@/services/events/DomainEvents';
import { backgroundSyncService } from '@/services/sync/BackgroundSyncService';

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending count
    const updatePending = () => {
      setPendingCount(backgroundSyncService.getPendingCount());
    };

    const interval = setInterval(updatePending, 1000);
    updatePending();

    // Listen for sync complete
    const unsubscribe = eventBus.subscribe(EventType.VAULT_SYNC_COMPLETE, () => {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);
      updatePending();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm">
        <CloudOff className="w-4 h-4" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-destructive/20 text-xs font-medium">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (justSynced) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm animate-in fade-in">
        <CheckCircle className="w-4 h-4" />
        <span>Synced</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
        <Cloud className="w-4 h-4 animate-pulse" />
        <span>Syncing...</span>
        <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-xs font-medium">
          {pendingCount}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
      <Cloud className="w-4 h-4" />
      <span>Online</span>
    </div>
  );
}
