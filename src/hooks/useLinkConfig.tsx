import { useState, useMemo, useCallback } from "react";

export interface LinkStyle {
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  width: number;
}

export interface LinkConfigState {
  // Topology controls
  showHierarchy: boolean;
  showBacklinks: boolean;
  showTags: boolean;
  tagThreshold: number;
  
  // Visual styling per link type
  styles: {
    hierarchy: LinkStyle;
    backlink: LinkStyle;
    tag: LinkStyle;
    semantic: LinkStyle;
  };
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

const DEFAULT_CONFIG: LinkConfigState = {
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

interface Node {
  id: string;
  name: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: "hierarchy" | "tag" | "backlink" | "semantic";
}

export function useLinkConfig(nodes: Node[], links: Link[]) {
  const [config, setConfig] = useState<LinkConfigState>(DEFAULT_CONFIG);

  const updateConfig = useCallback((updates: Partial<LinkConfigState>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const updateStyle = useCallback((
    linkType: keyof LinkConfigState["styles"],
    updates: Partial<LinkStyle>
  ) => {
    setConfig(prev => ({
      ...prev,
      styles: {
        ...prev.styles,
        [linkType]: { ...prev.styles[linkType], ...updates },
      },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

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

  return {
    config,
    stats,
    updateConfig,
    updateStyle,
    resetConfig,
  };
}

export type { LinkConfigState as LinkConfig };
