/**
 * useGraphConfig Hook - Centralized graph configuration state
 * 
 * Manages node styling, link styling, topology controls, and force engine settings
 * for react-force-graph 2D rendering
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

// ============= TYPE DEFINITIONS =============

export interface NodeConfig {
  // Dimensions & Fidelity
  relSize: number;          // nodeRelSize (default: 4)
  resolution: number;       // nodeResolution (geometry detail)
  
  // Shape
  shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon';
  
  // Visibility & Transparency
  visible: boolean;         // nodeVisibility
  opacity: number;          // nodeOpacity (0.0-1.0)
  
  // Color Management
  autoColorBy: 'none' | 'type' | 'depth' | 'tags';  // nodeAutoColorBy
  folderColor: string;
  fileColor: string;
  selectedColor: string;
  
  // Labels
  labelField: 'name' | 'id' | 'custom';  // nodeLabel source
  showLabels: boolean;
  labelSize: number;
  labelColor: string;
  labelFontStyle: 'normal' | 'bold' | 'italic' | 'bold-italic';
  labelBackground: boolean;
  labelBackgroundColor: string;
}

export interface LinkStyle {
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  width: number;
}

export interface LinkConfig {
  // Geometric Properties
  width: number;            // linkWidth
  curvature: number;        // linkCurvature (0 = straight)
  curveRotation: number;    // linkCurveRotation (radians)
  
  // Visual Differentiation
  color: string;            // linkColor
  opacity: number;
  dashArray: string;        // linkLineDash ("" = solid, "8,4" = dashed)
  
  // Directionality - Arrows
  arrowLength: number;      // linkDirectionalArrowLength
  arrowRelPos: number;      // linkDirectionalArrowRelPos (0-1)
  showArrows: boolean;
  
  // Directionality - Particles
  particles: number;        // linkDirectionalParticles
  particleSpeed: number;    // linkDirectionalParticleSpeed
  particleWidth: number;    // linkDirectionalParticleWidth
  particleColor: string;
  showParticles: boolean;
}

export interface TopologyConfig {
  showHierarchy: boolean;
  showBacklinks: boolean;
  showTags: boolean;
  tagThreshold: number;
  
  // Per-type styling
  styles: {
    hierarchy: LinkStyle;
    backlink: LinkStyle;
    tag: LinkStyle;
    semantic: LinkStyle;
  };
}

export interface ForceConfig {
  // Layout Mode
  dagMode: 'null' | 'td' | 'bu' | 'lr' | 'rl' | 'radialin' | 'radialout';  // dagMode
  dagLevelDistance: number; // dagLevelDistance
  
  // Physics Tuning
  alphaDecay: number;       // d3AlphaDecay (0.0-1.0)
  velocityDecay: number;    // d3VelocityDecay (0.0-1.0)
  
  // Force Parameters
  chargeStrength: number;   // d3Force('charge').strength()
  linkDistance: number;     // d3Force('link').distance()
  centerStrength: number;   // d3Force('center')
  
  // Simulation Control
  warmupTicks: number;      // warmupTicks
  cooldownTicks: number;    // cooldownTicks
  cooldownTime: number;     // cooldownTime (ms)
}

export interface LinkStats {
  hierarchyCount: number;
  backlinkCount: number;
  tagCount: number;
  totalCount: number;
  topHubs: Array<{
    nodeId: string;
    nodeName: string;
    connectionCount: number;
    inDegree: number;
    outDegree: number;
  }>;
}

export interface GraphConfigState {
  nodes: NodeConfig;
  links: LinkConfig;
  topology: TopologyConfig;
  forces: ForceConfig;
}

// ============= DEFAULTS =============

const defaultNodeConfig: NodeConfig = {
  relSize: 6,
  resolution: 8,
  shape: 'circle',
  visible: true,
  opacity: 1.0,
  autoColorBy: 'type',
  folderColor: 'hsl(48, 100%, 60%)',
  fileColor: 'hsl(270, 70%, 65%)',
  selectedColor: 'hsl(270, 80%, 70%)',
  labelField: 'name',
  showLabels: true,
  labelSize: 12,
  labelColor: 'hsl(0, 0%, 100%)',
  labelFontStyle: 'normal',
  labelBackground: true,
  labelBackgroundColor: 'hsl(0, 0%, 0%)',
};

const defaultLinkConfig: LinkConfig = {
  width: 2,
  curvature: 0,
  curveRotation: 0,
  color: 'hsl(var(--primary))',
  opacity: 0.6,
  dashArray: '',
  arrowLength: 0,
  arrowRelPos: 1,
  showArrows: false,
  particles: 0,
  particleSpeed: 0.01,
  particleWidth: 4,
  particleColor: 'hsl(var(--accent))',
  showParticles: false,
};

const defaultTopologyConfig: TopologyConfig = {
  showHierarchy: true,
  showBacklinks: true,
  showTags: true,
  tagThreshold: 1,
  styles: {
    hierarchy: {
      color: "hsl(var(--primary))",
      lineStyle: "solid",
      opacity: 0.8,
      width: 2.5,
    },
    backlink: {
      color: "hsl(var(--accent))",
      lineStyle: "dashed",
      opacity: 0.6,
      width: 2,
    },
    tag: {
      color: "hsl(var(--secondary))",
      lineStyle: "dotted",
      opacity: 0.4,
      width: 1.5,
    },
    semantic: {
      color: "hsl(var(--muted-foreground))",
      lineStyle: "dotted",
      opacity: 0.3,
      width: 1,
    },
  },
};

const defaultForceConfig: ForceConfig = {
  dagMode: 'null',
  dagLevelDistance: 50,
  alphaDecay: 0.02,
  velocityDecay: 0.3,
  chargeStrength: -300,
  linkDistance: 100,
  centerStrength: 1,
  warmupTicks: 100,
  cooldownTicks: 100,
  cooldownTime: 15000,
};

const defaultConfig: GraphConfigState = {
  nodes: defaultNodeConfig,
  links: defaultLinkConfig,
  topology: defaultTopologyConfig,
  forces: defaultForceConfig,
};

// ============= STORAGE KEY =============
const STORAGE_KEY = 'graph-config';

// ============= HOOK =============

interface Node {
  id: string;
  name: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: "hierarchy" | "tag" | "backlink" | "semantic";
}

export const useGraphConfig = (nodes: Node[] = [], links: Link[] = []) => {
  const [config, setConfig] = useState<GraphConfigState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultConfig,
          ...parsed,
          nodes: { ...defaultNodeConfig, ...parsed.nodes },
          links: { ...defaultLinkConfig, ...parsed.links },
          topology: { 
            ...defaultTopologyConfig, 
            ...parsed.topology,
            styles: {
              ...defaultTopologyConfig.styles,
              ...parsed.topology?.styles,
            },
          },
          forces: { ...defaultForceConfig, ...parsed.forces },
        };
      } catch (e) {
        console.error('Failed to parse graph config:', e);
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Calculate link statistics
  const stats = useMemo<LinkStats>(() => {
    let hierarchyCount = 0;
    let backlinkCount = 0;
    let tagCount = 0;

    // Count by type
    links.forEach(link => {
      switch (link.type) {
        case "hierarchy":
          hierarchyCount++;
          break;
        case "backlink":
          backlinkCount++;
          break;
        case "tag":
          tagCount++;
          break;
      }
    });

    // Calculate node degrees
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();
    
    nodes.forEach(node => {
      nodeConnections.set(node.id, { inDegree: 0, outDegree: 0 });
    });

    links.forEach(link => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      
      const sourceConn = nodeConnections.get(sourceId);
      const targetConn = nodeConnections.get(targetId);
      
      if (sourceConn) {
        sourceConn.outDegree++;
      }
      if (targetConn) {
        targetConn.inDegree++;
      }
    });

    // Get top hubs (nodes with most connections)
    const topHubs = Array.from(nodeConnections.entries())
      .map(([nodeId, { inDegree, outDegree }]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          nodeId,
          nodeName: node?.name || "Unknown",
          connectionCount: inDegree + outDegree,
          inDegree,
          outDegree,
        };
      })
      .filter(hub => hub.connectionCount > 0)
      .sort((a, b) => b.connectionCount - a.connectionCount)
      .slice(0, 5);

    return {
      hierarchyCount,
      backlinkCount,
      tagCount,
      totalCount: links.length,
      topHubs,
    };
  }, [nodes, links]);

  // Update node config
  const updateNodeConfig = useCallback((updates: Partial<NodeConfig>) => {
    setConfig(prev => ({
      ...prev,
      nodes: { ...prev.nodes, ...updates },
    }));
  }, []);

  // Update link config
  const updateLinkConfig = useCallback((updates: Partial<LinkConfig>) => {
    setConfig(prev => ({
      ...prev,
      links: { ...prev.links, ...updates },
    }));
  }, []);

  // Update topology config
  const updateTopologyConfig = useCallback((updates: Partial<TopologyConfig>) => {
    setConfig(prev => ({
      ...prev,
      topology: { ...prev.topology, ...updates },
    }));
  }, []);

  // Update topology style for a specific link type
  const updateTopologyStyle = useCallback((
    linkType: keyof TopologyConfig["styles"],
    updates: Partial<LinkStyle>
  ) => {
    setConfig(prev => ({
      ...prev,
      topology: {
        ...prev.topology,
        styles: {
          ...prev.topology.styles,
          [linkType]: { ...prev.topology.styles[linkType], ...updates },
        },
      },
    }));
  }, []);

  // Update force config
  const updateForceConfig = useCallback((updates: Partial<ForceConfig>) => {
    setConfig(prev => ({
      ...prev,
      forces: { ...prev.forces, ...updates },
    }));
  }, []);

  // Reset to defaults
  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  // Reset specific section
  const resetNodeConfig = useCallback(() => {
    setConfig(prev => ({ ...prev, nodes: defaultNodeConfig }));
  }, []);

  const resetLinkConfig = useCallback(() => {
    setConfig(prev => ({ ...prev, links: defaultLinkConfig }));
  }, []);

  const resetTopologyConfig = useCallback(() => {
    setConfig(prev => ({ ...prev, topology: defaultTopologyConfig }));
  }, []);

  const resetForceConfig = useCallback(() => {
    setConfig(prev => ({ ...prev, forces: defaultForceConfig }));
  }, []);

  return {
    config,
    stats,
    updateNodeConfig,
    updateLinkConfig,
    updateTopologyConfig,
    updateTopologyStyle,
    updateForceConfig,
    resetConfig,
    resetNodeConfig,
    resetLinkConfig,
    resetTopologyConfig,
    resetForceConfig,
  };
};

export { defaultConfig, defaultNodeConfig, defaultLinkConfig, defaultTopologyConfig, defaultForceConfig };
