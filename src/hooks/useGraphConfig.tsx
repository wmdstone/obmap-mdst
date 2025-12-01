/**
 * useGraphConfig Hook - Centralized graph configuration state
 * 
 * Manages node styling, link styling, and force engine settings
 * for react-force-graph 2D/3D rendering modes
 */

import { useState, useCallback, useEffect } from 'react';

// ============= TYPE DEFINITIONS =============

export interface NodeConfig {
  // Dimensions & Fidelity
  relSize: number;          // nodeRelSize (default: 4)
  resolution: number;       // nodeResolution (3D geometry detail)
  
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

export interface GraphConfigState {
  // Render Mode
  dimensions: 2 | 3;        // numDimensions
  
  // Section Configs
  nodes: NodeConfig;
  links: LinkConfig;
  forces: ForceConfig;
}

// ============= DEFAULTS =============

const defaultNodeConfig: NodeConfig = {
  relSize: 6,
  resolution: 8,
  visible: true,
  opacity: 1.0,
  autoColorBy: 'type',
  folderColor: 'hsl(48, 100%, 60%)',
  fileColor: 'hsl(270, 70%, 65%)',
  selectedColor: 'hsl(270, 80%, 70%)',
  labelField: 'name',
  showLabels: true,
  labelSize: 12,
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
  dimensions: 2,
  nodes: defaultNodeConfig,
  links: defaultLinkConfig,
  forces: defaultForceConfig,
};

// ============= STORAGE KEY =============
const STORAGE_KEY = 'graph-config';

// ============= HOOK =============

export const useGraphConfig = () => {
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

  // Update dimension mode
  const setDimensions = useCallback((dims: 2 | 3) => {
    setConfig(prev => ({ ...prev, dimensions: dims }));
  }, []);

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

  const resetForceConfig = useCallback(() => {
    setConfig(prev => ({ ...prev, forces: defaultForceConfig }));
  }, []);

  return {
    config,
    setDimensions,
    updateNodeConfig,
    updateLinkConfig,
    updateForceConfig,
    resetConfig,
    resetNodeConfig,
    resetLinkConfig,
    resetForceConfig,
  };
};

export { defaultConfig, defaultNodeConfig, defaultLinkConfig, defaultForceConfig };
