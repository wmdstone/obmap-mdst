/**
 * Core Feature Module
 * 
 * Foundation module that provides core infrastructure
 */

import type { Feature } from '../plugin-registry';
import { eventBus } from '../events';
import { container } from '../container';

export const coreFeature: Feature = {
  id: 'core',
  name: 'Core Infrastructure',
  version: '1.0.0',
  dependencies: [],
  services: [
    {
      name: 'EventBus',
      factory: () => eventBus,
      singleton: true,
    },
    {
      name: 'Container',
      factory: () => container,
      singleton: true,
    },
  ],
  components: {
    // Core UI components are available globally
    ErrorBoundary: () => import('@/components/core/common/ErrorBoundary'),
    ProtectedRoute: () => import('@/components/core/common/ProtectedRoute'),
    PWAInstallPrompt: () => import('@/components/core/common/PWAInstallPrompt'),
  },
  routes: [
    { 
      path: '/', 
      component: 'Landing',
      protected: false,
    },
    { 
      path: '/install', 
      component: 'Install',
      protected: false,
    },
    { 
      path: '/app', 
      component: 'Index',
      protected: true,
    },
  ],
  hooks: {
    useMobile: () => import('@/components/core/hooks/useMobile'),
    useToast: () => import('@/components/core/hooks/useToast'),
  },
  initialize: async () => {
    console.log('[CoreFeature] Initializing core feature...');
  },
  cleanup: async () => {
    console.log('[CoreFeature] Cleaning up core feature...');
  },
};
