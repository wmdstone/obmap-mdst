/** Resolves graph config into concrete canvas colors, once per render pass. */

import { colorWithOpacity, resolveColor } from '@/shared/lib/color-utils';
import type { GraphConfigState } from '@/shared/stores/useGraphStore';
import type { RenderNode } from '../model/graphTypes';
import {
  resolveLevelColor,
  type HierarchyColorConfig,
} from '../model/hierarchyColors';

export interface GraphTheme {
  folder: string;
  file: string;
  selected: string;
  label: string;
  labelBackground: string;
  labelBackgroundEnabled: boolean;
  link: string;
  linkOpacity: number;
  decoration: string;
  card: string;
  cardBorder: string;
  nodeOpacity: number;
  autoColorBy: GraphConfigState['nodes']['autoColorBy'];
  labelSize: number;
  hierarchy: HierarchyColorConfig;
}

export function buildTheme(config: GraphConfigState): GraphTheme {
  return {
    folder: resolveColor(config.nodes.folderColor),
    file: resolveColor(config.nodes.fileColor),
    selected: resolveColor(config.nodes.selectedColor),
    label: resolveColor(config.nodes.labelColor),
    labelBackground: resolveColor(config.nodes.labelBackgroundColor),
    labelBackgroundEnabled: config.nodes.labelBackground,
    link: resolveColor(config.links.color),
    linkOpacity: config.links.opacity,
    decoration: resolveColor(config.links.color),
    card: resolveColor('hsl(var(--card))'),
    cardBorder: resolveColor('hsl(var(--border))'),
    nodeOpacity: config.nodes.opacity,
    autoColorBy: config.nodes.autoColorBy,
    labelSize: config.nodes.labelSize,
    hierarchy: config.hierarchy,
  };
}

export function accentFor(node: RenderNode, theme: GraphTheme, selected: boolean): string {
  if (selected) return theme.selected;
  // Hierarchy colouring wins over autoColorBy, but keeps the selected accent.
  if (theme.hierarchy?.enabled) return resolveLevelColor(node.depth, theme.hierarchy);
  if (theme.autoColorBy === 'depth') return `hsl(${(node.depth * 40) % 360}, 70%, 55%)`;
  if (theme.autoColorBy === 'tags' && node.tags.length) {
    const hash = node.tags[0]
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return `hsl(${hash % 360}, 70%, 55%)`;
  }
  return node.type === 'folder' ? theme.folder : theme.file;
}

export const dim = (color: string, amount: number) => colorWithOpacity(color, amount);
