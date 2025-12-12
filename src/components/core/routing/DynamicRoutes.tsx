/**
 * Dynamic Route Generator Component
 * 
 * Generates routes from the feature registry dynamically
 */

import React, { lazy, Suspense, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { pluginRegistry, type RouteConfig } from '@/services/core/plugin-registry';
import { ProtectedRoute } from '@/components/core/common/ProtectedRoute';
import { useFeatureConfigStore } from '@/services/ui/stores/useFeatureConfigStore';

// Static page imports for core routes that must always be available
const Landing = lazy(() => import('@/pages/Landing'));
const Auth = lazy(() => import('@/pages/Auth'));
const Install = lazy(() => import('@/pages/Install'));
const Index = lazy(() => import('@/pages/Index'));
const Profile = lazy(() => import('@/pages/Profile'));
const VaultDashboard = lazy(() => import('@/pages/VaultDashboard'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Map of component names to lazy-loaded components
const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  Landing,
  Auth,
  Install,
  Index,
  Profile,
  VaultDashboard,
  NotFound,
};

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

const FeatureDisabledFallback = ({ featureName }: { featureName: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4 max-w-md mx-auto px-4">
      <h2 className="text-xl font-semibold">Feature Disabled</h2>
      <p className="text-muted-foreground">
        The <span className="font-medium">{featureName}</span> feature is currently disabled.
        You can enable it in your profile settings.
      </p>
    </div>
  </div>
);

interface DynamicRouteProps {
  route: RouteConfig;
  featureId: string;
  featureName: string;
}

function DynamicRoute({ route, featureId, featureName }: DynamicRouteProps) {
  const { featureConfigs } = useFeatureConfigStore();
  const isFeatureEnabled = featureConfigs[featureId]?.enabled !== false;
  
  // Get the component from the map or create a lazy loader
  const Component = useMemo(() => {
    if (componentMap[route.component]) {
      return componentMap[route.component];
    }
    
    // Try to dynamically load from feature components
    const feature = pluginRegistry.get(featureId);
    if (feature?.components?.[route.component]) {
      return lazy(async () => {
        try {
          const module = await feature.components![route.component]();
          if (module.default) {
            return module;
          }
          const Comp = module[route.component] || Object.values(module)[0];
          return { default: Comp };
        } catch (error) {
          console.error(`Failed to load component ${route.component}:`, error);
          return { 
            default: () => (
              <div className="p-8 text-destructive">
                Failed to load {route.component}
              </div>
            )
          };
        }
      });
    }
    
    // Fallback for unknown components
    return lazy(async () => ({
      default: () => (
        <div className="p-8 text-destructive">
          Component {route.component} not found
        </div>
      )
    }));
  }, [route.component, featureId]);
  
  if (!isFeatureEnabled && featureId !== 'core') {
    return <FeatureDisabledFallback featureName={featureName} />;
  }
  
  const element = (
    <Suspense fallback={<LoadingFallback />}>
      <Component {...(route.props || {})} />
    </Suspense>
  );
  
  if (route.protected) {
    return <ProtectedRoute>{element}</ProtectedRoute>;
  }
  
  return element;
}

export function DynamicRoutes() {
  const { featureConfigs } = useFeatureConfigStore();
  
  // Collect all routes from enabled features
  const allRoutes = useMemo(() => {
    const features = pluginRegistry.getAll();
    const routes: Array<RouteConfig & { featureId: string; featureName: string }> = [];
    
    for (const feature of features) {
      if (feature.routes) {
        for (const route of feature.routes) {
          routes.push({
            ...route,
            featureId: feature.id,
            featureName: feature.name,
          });
        }
      }
    }
    
    return routes;
  }, [featureConfigs]); // Re-compute when feature configs change
  
  return (
    <Routes>
      {allRoutes.map((route) => (
        <Route
          key={`${route.featureId}-${route.path}`}
          path={route.path}
          element={
            <DynamicRoute
              route={route}
              featureId={route.featureId}
              featureName={route.featureName}
            />
          }
        />
      ))}
      
      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
