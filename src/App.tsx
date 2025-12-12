import { Toaster } from "@/components/core/ui/toaster";
import { Toaster as Sonner } from "@/components/core/ui/sonner";
import { TooltipProvider } from "@/components/core/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "./components/core/common/ErrorBoundary";
import { AuthProvider } from "./components/auth/hooks/useAuth";
import { EventDebugPanel } from "./components/core/debug/EventDebugPanel";
import { Suspense, useEffect, useState } from "react";
import { initializeFeatureLoader } from "./services/core/feature-loader";
import { DynamicRoutes } from "./components/core/routing/DynamicRoutes";
import { useFeatureConfigStore } from "./services/ui/stores/useFeatureConfigStore";

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

/**
 * Feature Initializer Component
 * Initializes the feature loader on mount and syncs with config store
 */
function FeatureInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { syncWithRegistry } = useFeatureConfigStore();

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeFeatureLoader();
        if (mounted) {
          // Sync feature config store with registry
          syncWithRegistry();
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('[App] Feature initialization failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Still show app even if features fail to initialize
          setIsInitialized(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [syncWithRegistry]);

  if (!isInitialized) {
    return <LoadingFallback />;
  }

  if (error) {
    console.warn('[App] Features initialized with error:', error.message);
  }

  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <EventDebugPanel />
        <BrowserRouter>
          <AuthProvider>
            <FeatureInitializer>
              <Suspense fallback={<LoadingFallback />}>
                <DynamicRoutes />
              </Suspense>
            </FeatureInitializer>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
