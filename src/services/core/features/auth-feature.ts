/**
 * Auth Feature Module
 * 
 * Self-contained module for authentication functionality
 */

import type { Feature } from '../plugin-registry';

export const authFeature: Feature = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  dependencies: ['core'],
  services: [],
  components: {
    AuthForm: () => import('@/components/auth/AuthForm'),
    PasswordStrengthIndicator: () => import('@/components/auth/PasswordStrengthIndicator'),
    Auth: () => import('@/pages/Auth'),
  },
  routes: [
    { 
      path: '/auth', 
      component: 'Auth',
      protected: false,
    },
  ],
  hooks: {
    useAuth: () => import('@/components/auth/hooks/useAuth'),
  },
  initialize: async () => {
    console.log('[AuthFeature] Initializing auth feature...');
  },
  cleanup: async () => {
    console.log('[AuthFeature] Cleaning up auth feature...');
  },
};
