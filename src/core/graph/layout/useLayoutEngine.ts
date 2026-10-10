/**
 * Single entry point for deterministic layout: picks a strategy, runs it in a
 * memo over a stable signature and returns geometry only (never React state).
 */

import { useMemo } from 'react';
import type {
  GraphProjection,
  LayoutContext,
  LayoutGeometry,
  LayoutMode,
  MindmapOrientation,
  NodeMetric,
  SubtreeLayoutMap,
} from '../model/graphTypes';
import { mindmapLayout } from './mindmap';
import { timelineLayout } from './timeline';
import { fishboneLayout } from './fishbone';
import { freeForceLayout } from './freeForce';
import { fruchtermanReingoldLayout, gridLayout, kamadaKawaiLayout } from './networkLayouts';
import { braceMapLayout, orgChartLayout } from './treeLayouts';
import { composeSubtreeLayouts } from './subtreeCompose';

export interface LayoutEngineOptions {
  mode: LayoutMode;
  width: number;
  height: number;
  orientation: MindmapOrientation;
  levelGap: number;
  siblingGap: number;
  laneGap: number;
  ribAngle: number;
  rootId?: string;
  visibleIds: string[];
  nodeMetrics: Map<string, NodeMetric>;
  subtreeOverrides?: SubtreeLayoutMap;
}

export function computeLayout(
  projection: GraphProjection,
  options: LayoutEngineOptions
): LayoutGeometry {
  const context: LayoutContext = {
    width: options.width,
    height: options.height,
    rootId: options.rootId,
    orientation: options.orientation,
    levelGap: options.levelGap,
    siblingGap: options.siblingGap,
    laneGap: options.laneGap,
    ribAngle: options.ribAngle,
    nodeMetrics: options.nodeMetrics,
  };

  const visible = new Set(options.visibleIds);
  const childrenOf = (id: string) =>
    (projection.childrenByParent.get(id) ?? []).filter((child) => visible.has(child));
  const roots = options.visibleIds.filter((id) => {
    const parent = projection.parentByChild.get(id) ?? null;
    return !parent || !visible.has(parent);
  });

  const endpoint = (end: unknown) =>
    typeof end === 'string' ? end : (end as { id?: string } | null)?.id ?? '';
  const network = () => ({
    ids: options.visibleIds,
    edges: projection.links
      .map((link) => [endpoint(link.source), endpoint(link.target)] as [string, string])
      .filter(([a, b]) => visible.has(a) && visible.has(b)),
    context,
  });
  const tree = { ids: options.visibleIds, roots, childrenOf, context };

  let baseGeometry: LayoutGeometry;

  switch (options.mode) {
    case 'fr-standard':
      baseGeometry = fruchtermanReingoldLayout(network(), false);
      break;
    case 'fr-radial':
      baseGeometry = fruchtermanReingoldLayout(network(), true);
      break;
    case 'kamada-kawai':
      baseGeometry = kamadaKawaiLayout(network());
      break;
    case 'grid':
      baseGeometry = gridLayout(network(), (id) => projection.byId.get(id)?.name ?? id);
      break;
    case 'org-chart':
      baseGeometry = orgChartLayout(tree);
      break;
    case 'brace-map':
      baseGeometry = braceMapLayout(tree);
      break;
    case 'timeline':
      baseGeometry = timelineLayout({
        ids: options.visibleIds,
        roots,
        childrenOf,
        parentOf: (id) => projection.parentByChild.get(id) ?? null,
        context,
      });
      break;
    case 'fishbone':
      baseGeometry = fishboneLayout({ ids: options.visibleIds, roots, childrenOf, context });
      break;
    case 'free-force':
      baseGeometry = freeForceLayout();
      break;
    case 'mindmap':
    default:
      baseGeometry = mindmapLayout({ ids: options.visibleIds, roots, childrenOf, context });
      break;
  }

  // Jika ada subtree overrides, gabungkan komposisinya
  if (options.subtreeOverrides && Object.keys(options.subtreeOverrides).length > 0) {
    return composeSubtreeLayouts(
      baseGeometry,
      {
        ...tree,
        projection: {
          byId: projection.byId,
          parentByChild: projection.parentByChild,
        },
      },
      options.subtreeOverrides
    );
  }

  return baseGeometry;
}

export function useLayoutEngine(
  projection: GraphProjection,
  options: LayoutEngineOptions
): LayoutGeometry {
  const signature = [
    options.mode,
    options.orientation,
    options.rootId ?? '',
    Math.round(options.width),
    Math.round(options.height),
    options.levelGap,
    options.siblingGap,
    options.laneGap,
    options.ribAngle.toFixed(3),
    options.visibleIds.join(','),
    projection.links.length,
    JSON.stringify(options.subtreeOverrides ?? {}),
  ].join('|');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => computeLayout(projection, options), [signature, projection]);
}
