/**
 * Hook khusus kalkulasi graph data & auto-links untuk GraphCanvas.
 * Hanya me-recompute data graf saat diperlukan oleh tab graf yang sedang aktif.
 */
import { useMemo, useEffect } from "react";
import { useNodeStore, useGraphStore, type GraphData } from "@/shared/stores";
import { useIndexedNodes, useMetadataVersion } from "@/domains/metadata/useMetadataCache";
import { metadataCache } from "@/domains/metadata/MetadataCache";
import { useAutoLinks } from "@/domains/graph/shared/hooks/useAutoLinks";
import { useFeatureEnabled } from "@/domains/settings/plugins/useFeatureEnabled";
import type { GraphConfigState } from "@/domains/graph/shared/stores/useGraphStore";

export function useGraphData(graphConfig: GraphConfigState): GraphData {
  const nodes = useNodeStore((s) => s.nodes);
  const indexedNodes = useIndexedNodes(nodes);
  const metadataVersion = useMetadataVersion();
  const autoLinksEnabled = useFeatureEnabled("auto-links");

  const resolvedLinks = useMemo(
    () => metadataCache.resolvedLinks,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadataVersion, indexedNodes],
  );

  const autoLinks = useAutoLinks(
    indexedNodes,
    {
      hierarchy: autoLinksEnabled && graphConfig.topology.showHierarchy,
      tags: autoLinksEnabled && graphConfig.topology.showTags,
      backlinks: autoLinksEnabled && graphConfig.topology.showBacklinks,
      tagThreshold: graphConfig.topology.tagThreshold,
    },
    resolvedLinks,
  );

  const computeStats = useGraphStore((s) => s.computeStats);
  useEffect(() => {
    computeStats(indexedNodes, autoLinks);
  }, [indexedNodes, autoLinks, computeStats]);

  return useMemo<GraphData>(
    () => ({
      nodes: indexedNodes,
      links: autoLinks.map((link) => ({
        source: link.source,
        target: link.target,
        type: link.type,
      })),
    }),
    [indexedNodes, autoLinks],
  );
}