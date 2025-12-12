/**
 * Profile Feature Module
 * 
 * Self-contained module for user profile functionality
 */

import type { Feature } from '../plugin-registry';

export const profileFeature: Feature = {
  id: 'profile',
  name: 'User Profile',
  version: '1.0.0',
  dependencies: ['core', 'auth'],
  services: [
    {
      name: 'ApiKeyService',
      factory: async () => {
        const { ApiKeyService } = await import('../../apikeys/ApiKeyService');
        return new ApiKeyService();
      },
      singleton: true,
    },
  ],
  components: {
    ProfileSettings: () => import('@/components/profile/ProfileSettings'),
    ApiKeyManager: () => import('@/components/profile/ApiKeyManager'),
    AvatarUpload: () => import('@/components/profile/AvatarUpload'),
    Profile: () => import('@/pages/Profile'),
  },
  routes: [
    { 
      path: '/profile', 
      component: 'Profile',
      protected: true,
    },
  ],
  hooks: {},
  initialize: async () => {
    console.log('[ProfileFeature] Initializing profile feature...');
  },
  cleanup: async () => {
    console.log('[ProfileFeature] Cleaning up profile feature...');
  },
};
