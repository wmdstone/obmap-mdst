import { useState, useEffect } from 'react';

interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  cacheStatus: 'ready' | 'updating' | 'error' | 'unknown';
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    isServiceWorkerReady: false,
    cacheStatus: 'unknown',
  });

  useEffect(() => {
    // Online/Offline listeners
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          setStatus(prev => ({ 
            ...prev, 
            isServiceWorkerReady: true,
            cacheStatus: 'ready'
          }));
        })
        .catch(() => {
          setStatus(prev => ({ ...prev, cacheStatus: 'error' }));
        });

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setStatus(prev => ({ ...prev, cacheStatus: 'updating' }));
        setTimeout(() => {
          setStatus(prev => ({ ...prev, cacheStatus: 'ready' }));
        }, 2000);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if app can work offline
  const canWorkOffline = status.isServiceWorkerReady && status.cacheStatus === 'ready';

  return {
    ...status,
    canWorkOffline,
  };
}
