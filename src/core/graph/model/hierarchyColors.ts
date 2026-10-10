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
  | 'neon'
  | 'pastel'
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
    id: 'neon',
    label: 'Dark Neon Cyber',
    description: 'High intensity glowing neons',
    colors: [
      'hsl(48, 100%, 55%)',  // Gold / Amber root
      'hsl(190, 100%, 55%)', // Electric Cyan
      'hsl(285, 100%, 65%)', // Neon Magenta/Purple
      'hsl(140, 100%, 55%)', // Vivid Green
      'hsl(15, 100%, 60%)',  // Blaze Orange
      'hsl(330, 100%, 60%)', // Hot Pink
    ],
  },
  {
    id: 'pastel',
    label: 'Pastel Palette',
    description: 'Soft, elegant low-strain hues',
    colors: [
      'hsl(42, 85%, 70%)',
      'hsl(205, 75%, 72%)',
      'hsl(155, 60%, 68%)',
      'hsl(275, 65%, 75%)',
      'hsl(15, 80%, 74%)',
      'hsl(340, 70%, 74%)',
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

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function parseHsl(color: string): Hsl | null {
  const hsl = color
    .trim()
    .match(/hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/i);
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

export const formatHsl = ({ h, s, l }: Hsl) =>
  `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

/**
 * 1-Click Harmony Generator: Golden ratio hue wheel rotation
 */
export function generateHarmonyPalette(baseColor = 'hsl(45, 95%, 60%)', count = 6): string[] {
  const parsed = parseHsl(baseColor) || { h: 45, s: 95, l: 60 };
  const goldenRatio = 137.50776405; // degrees
  const palette: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (parsed.h + i * goldenRatio) % 360;
    const sat = clamp(parsed.s + (i % 2 === 0 ? 5 : -5), 60, 95);
    const light = clamp(parsed.l + (i % 2 === 0 ? 0 : 5), 45, 68);
    palette.push(formatHsl({ h: hue, s: sat, l: light }));
  }
  return palette;
}

/**
 * Applies dynamic color spread & saturation shift across level colors.
 */
export function transformPaletteSpreadAndSaturation(
  colors: string[],
  spreadFactor: number, // 0.5 to 2.0 (1.0 = normal)
  saturationShift: number // -50 to +50 (0 = neutral)
): string[] {
  if (!colors.length) return colors;
  const firstHsl = parseHsl(colors[0]) || { h: 45, s: 80, l: 55 };

  return colors.map((col, idx) => {
    const hsl = parseHsl(col);
    if (!hsl) return col;
    if (idx === 0) {
      return formatHsl({
        h: hsl.h,
        s: clamp(hsl.s + saturationShift, 10, 100),
        l: hsl.l,
      });
    }
    const diff = (hsl.h - firstHsl.h + 360) % 360;
    const scaledDiff = (diff * spreadFactor) % 360;
    const newHue = (firstHsl.h + scaledDiff) % 360;
    const newSat = clamp(hsl.s + saturationShift, 10, 100);
    return formatHsl({ h: newHue, s: newSat, l: hsl.l });
  });
}

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

export function resolveLevelColor(depth: number, config: HierarchyColorConfig): string {
  const palette = paletteOf(config);
  const level = Math.max(0, Math.floor(depth));
  if (level < palette.length) return palette[level];
  if (config.overflow === 'loop') return palette[level % palette.length];
  return gradientStep(palette[palette.length - 1], level - palette.length + 1);
}

export function resolveLevelOpacity(depth: number, config: HierarchyColorConfig): number {
  const list = config.levelOpacity;
  if (!list.length) return 1;
  const level = Math.max(0, Math.floor(depth));
  return clamp(list[level] ?? list[list.length - 1], 0, 1);
}

export interface HierarchyLinkPaint {
  color: string;
  opacity?: number;
}

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

export function uniqueDepths(nodes: { depth: number }[]): number[] {
  const set = new Set<number>();
  for (const node of nodes) set.add(Math.max(0, Math.floor(node.depth)));
  return [...set].sort((a, b) => a - b);
}

/**
 * Merges any (possibly legacy/partial/invalid) stored hierarchy config onto
 * the defaults so consumers never see `undefined` or malformed fields.
 */
export function mergeHierarchyColorConfig(
  raw?: Partial<HierarchyColorConfig> | null
): HierarchyColorConfig {
  if (!raw) return { ...defaultHierarchyColorConfig };
  const validPreset =
    raw.preset === 'custom' || presetById(raw.preset as HierarchyPresetId)
      ? raw.preset
      : defaultHierarchyColorConfig.preset;
  const validOverflow =
    raw.overflow === 'gradient' || raw.overflow === 'loop'
      ? raw.overflow
      : defaultHierarchyColorConfig.overflow;
  const validLinkMode =
    raw.linkColorMode === 'parent' ||
    raw.linkColorMode === 'child' ||
    raw.linkColorMode === 'level'
      ? raw.linkColorMode
      : defaultHierarchyColorConfig.linkColorMode;
  const levelColors =
    Array.isArray(raw.levelColors) && raw.levelColors.length > 0
      ? raw.levelColors
      : [...defaultHierarchyColorConfig.levelColors];

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaultHierarchyColorConfig.enabled,
    preset: validPreset,
    levelColors,
    overflow: validOverflow,
    linkColorMode: validLinkMode,
    levelOpacity: Array.isArray(raw.levelOpacity) && raw.levelOpacity.length > 0
      ? raw.levelOpacity
      : [...defaultHierarchyColorConfig.levelOpacity],
  };
}
