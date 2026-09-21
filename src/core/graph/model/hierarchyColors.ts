/**
 * Hierarchy level colouring — pure resolver shared by nodes, links, glow,
 * arrows, particles, fishbone decorations and the on-canvas legend.
 *
 * No canvas and no React: everything here is deterministic and testable.
 */

export type HierarchyOverflow = 'loop' | 'gradient';
export type HierarchyLinkColorMode = 'parent' | 'child' | 'level';
export type HierarchyPresetId =
  | 'classic'
  | 'mono-blue'
  | 'dark-friendly'
  | 'warm'
  | 'cool'
  | 'custom';

export interface HierarchyColorConfig {
  /** When false every consumer keeps its existing (pre-hierarchy) colours. */
  enabled: boolean;
  preset: HierarchyPresetId;
  /** Explicit colours for level 0..n-1; levels beyond follow `overflow`. */
  levelColors: string[];
  overflow: HierarchyOverflow;
  linkColorMode: HierarchyLinkColorMode;
  /** Per-level link opacity, only used by the `level` link mode. */
  levelOpacity: number[];
}

export interface HierarchyPreset {
  id: Exclude<HierarchyPresetId, 'custom'>;
  label: string;
  description: string;
  colors: string[];
}

export const HIERARCHY_PRESETS: HierarchyPreset[] = [
  {
    id: 'classic',
    label: 'Classic Categorical',
    description: 'Distinct hue per level',
    colors: [
      'hsl(262, 76%, 62%)',
      'hsl(199, 89%, 52%)',
      'hsl(150, 62%, 45%)',
      'hsl(45, 93%, 55%)',
      'hsl(15, 86%, 60%)',
      'hsl(330, 74%, 60%)',
    ],
  },
  {
    id: 'mono-blue',
    label: 'Monochromatic Blue',
    description: 'One hue, deepening levels',
    colors: [
      'hsl(214, 90%, 72%)',
      'hsl(214, 86%, 63%)',
      'hsl(214, 82%, 54%)',
      'hsl(214, 78%, 45%)',
      'hsl(214, 74%, 36%)',
      'hsl(214, 70%, 28%)',
    ],
  },
  {
    id: 'dark-friendly',
    label: 'Dark Mode Friendly',
    description: 'High contrast on dark canvases',
    colors: [
      'hsl(190, 95%, 68%)',
      'hsl(265, 90%, 74%)',
      'hsl(145, 70%, 62%)',
      'hsl(45, 96%, 68%)',
      'hsl(8, 88%, 68%)',
      'hsl(320, 82%, 72%)',
    ],
  },
  {
    id: 'warm',
    label: 'Warm Tones',
    description: 'Amber through crimson',
    colors: [
      'hsl(45, 95%, 60%)',
      'hsl(32, 92%, 56%)',
      'hsl(20, 88%, 55%)',
      'hsl(8, 82%, 55%)',
      'hsl(352, 76%, 54%)',
      'hsl(338, 70%, 50%)',
    ],
  },
  {
    id: 'cool',
    label: 'Cool Tones',
    description: 'Teal through indigo',
    colors: [
      'hsl(168, 72%, 52%)',
      'hsl(188, 78%, 52%)',
      'hsl(205, 82%, 56%)',
      'hsl(224, 78%, 62%)',
      'hsl(250, 72%, 64%)',
      'hsl(272, 66%, 62%)',
    ],
  },
];

export const presetById = (id: HierarchyPresetId): HierarchyPreset | undefined =>
  HIERARCHY_PRESETS.find((preset) => preset.id === id);

export const defaultHierarchyColorConfig: HierarchyColorConfig = {
  enabled: false,
  preset: 'classic',
  levelColors: [...HIERARCHY_PRESETS[0].colors],
  overflow: 'loop',
  linkColorMode: 'parent',
  levelOpacity: [0.9, 0.8, 0.7, 0.6, 0.5, 0.45],
};

/* ------------------------------ colour maths ------------------------------ */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function parseHsl(color: string): Hsl | null {
  const hsl = color
    .trim()
    .match(/hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/i);
  if (hsl) {
    return { h: Number(hsl[1]), s: Number(hsl[2]), l: Number(hsl[3]) };
  }
  const hex = color.trim().match(/^#?([\da-f]{6})$/i);
  if (!hex) return null;
  const int = parseInt(hex[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

const formatHsl = ({ h, s, l }: Hsl) =>
  `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

/**
 * Deterministic extension of the palette: lightness alternates lighter/darker
 * around the last palette colour so the result stays readable on light and
 * dark canvases alike.
 */
function gradientStep(base: string, step: number): string {
  const hsl = parseHsl(base);
  if (!hsl) return base;
  const magnitude = Math.ceil(step / 2) * 9;
  const direction = step % 2 === 1 ? 1 : -1;
  return formatHsl({
    h: (hsl.h + direction * Math.ceil(step / 2) * 4 + 360) % 360,
    s: clamp(hsl.s - Math.ceil(step / 2) * 3, 25, 100),
    l: clamp(hsl.l + direction * magnitude, 30, 76),
  });
}

/* -------------------------------- resolvers ------------------------------- */

export function paletteOf(config: HierarchyColorConfig): string[] {
  if (config.levelColors.length) return config.levelColors;
  const preset = presetById(config.preset);
  return preset ? preset.colors : HIERARCHY_PRESETS[0].colors;
}

/** Colour for a hierarchy depth (0 = root), honouring the overflow strategy. */
export function resolveLevelColor(depth: number, config: HierarchyColorConfig): string {
  const palette = paletteOf(config);
  const level = Math.max(0, Math.floor(depth));
  if (level < palette.length) return palette[level];
  if (config.overflow === 'loop') return palette[level % palette.length];
  return gradientStep(palette[palette.length - 1], level - palette.length + 1);
}

/** Per-level opacity for the Level Specific link mode. */
export function resolveLevelOpacity(depth: number, config: HierarchyColorConfig): number {
  const list = config.levelOpacity;
  if (!list.length) return 1;
  const level = Math.max(0, Math.floor(depth));
  return clamp(list[level] ?? list[list.length - 1], 0, 1);
}

export interface HierarchyLinkPaint {
  color: string;
  /** Present only for the Level Specific mode; otherwise the type style wins. */
  opacity?: number;
}

/** Stroke/arrow/particle paint for a hierarchy link between two depths. */
export function resolveHierarchyLinkPaint(
  sourceDepth: number,
  targetDepth: number,
  config: HierarchyColorConfig
): HierarchyLinkPaint {
  if (config.linkColorMode === 'child') {
    return { color: resolveLevelColor(targetDepth, config) };
  }
  if (config.linkColorMode === 'level') {
    return {
      color: resolveLevelColor(targetDepth, config),
      opacity: resolveLevelOpacity(targetDepth, config),
    };
  }
  return { color: resolveLevelColor(sourceDepth, config) };
}

/** Sorted unique depths actually present in the projected graph. */
export function uniqueDepths(nodes: { depth: number }[]): number[] {
  const set = new Set<number>();
  for (const node of nodes) set.add(Math.max(0, Math.floor(node.depth)));
  return [...set].sort((a, b) => a - b);
}

/** Merge persisted (possibly older) config onto the current defaults. */
export function mergeHierarchyColorConfig(
  value: Partial<HierarchyColorConfig> | null | undefined
): HierarchyColorConfig {
  const base = defaultHierarchyColorConfig;
  if (!value) return { ...base, levelColors: [...base.levelColors], levelOpacity: [...base.levelOpacity] };
  const levelColors = Array.isArray(value.levelColors) && value.levelColors.length
    ? value.levelColors.filter((color) => typeof color === 'string' && color.trim().length > 0)
    : [...base.levelColors];
  const levelOpacity = Array.isArray(value.levelOpacity) && value.levelOpacity.length
    ? value.levelOpacity.filter((item) => typeof item === 'number' && Number.isFinite(item))
    : [...base.levelOpacity];
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : base.enabled,
    preset: value.preset && (value.preset === 'custom' || presetById(value.preset))
      ? value.preset
      : base.preset,
    levelColors: levelColors.length ? levelColors : [...base.levelColors],
    overflow: value.overflow === 'gradient' ? 'gradient' : 'loop',
    linkColorMode:
      value.linkColorMode === 'child' || value.linkColorMode === 'level'
        ? value.linkColorMode
        : 'parent',
    levelOpacity: levelOpacity.length ? levelOpacity : [...base.levelOpacity],
  };
}
