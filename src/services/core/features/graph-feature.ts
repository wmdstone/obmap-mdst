/**
 * Graph Feature Module
 * 
 * Self-contained module for graph visualization functionality
 */

import type { Feature } from '../plugin-registry';

export const graphFeature: Feature = {
  id: 'graph',
  name: 'Graph Visualization',
  version: '1.0.0',
  dependencies: ['core', 'vault'],
  services: [
    {
      name: 'GraphService',
      factory: async () => {
        const { GraphService } = await import('../../graph/GraphService');
        return new GraphService();
      },
      singleton: true,
    },
    {
      name: 'RelationshipMapper',
      factory: async () => {
        const { RelationshipMapper } = await import('../../graph/RelationshipMapper');
        return new RelationshipMapper();
      },
      singleton: true,
    },
    {
      name: 'ZipImportService',
      factory: async () => {
        const { ZipImportService } = await import('../../graph/ZipImportService');
        return new ZipImportService();
      },
      singleton: true,
    },
  ],
  components: {
    NetworkGraph: () => import('@/components/graph/NetworkGraph'),
    NodePanel: () => import('@/components/graph/NodePanel'),
    BacklinksPanel: () => import('@/components/graph/BacklinksPanel'),
    LinkManager: () => import('@/components/graph/LinkManager'),
    DynamicLinkManager: () => import('@/components/graph/DynamicLinkManager'),
    GraphMiniMap: () => import('@/components/graph/GraphMiniMap'),
    MarkdownRenderer: () => import('@/components/graph/MarkdownRenderer'),
    GraphConfigPanel: () => import('@/components/graph/config-panel'),
  },
  routes: [],
  hooks: {
    useAutoLinks: () => import('@/components/graph/hooks/useAutoLinks'),
  },
  initialize: async () => {
    console.log('[GraphFeature] Initializing graph feature...');
  },
  cleanup: async () => {
    console.log('[GraphFeature] Cleaning up graph feature...');
  },
};
