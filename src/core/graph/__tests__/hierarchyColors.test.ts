import { describe, expect, it } from 'vitest';
import {
  HIERARCHY_PRESETS,
  defaultHierarchyColorConfig,
  mergeHierarchyColorConfig,
  presetById,
  resolveHierarchyLinkPaint,
  resolveLevelColor,
  resolveLevelOpacity,
  uniqueDepths,
  type HierarchyColorConfig,
} from '../model/hierarchyColors';

const cfg = (over: Partial<HierarchyColorConfig> = {}): HierarchyColorConfig => ({
  ...defaultHierarchyColorConfig,
  levelColors: ['#ff0000', '#00ff00', '#0000ff'],
  levelOpacity: [0.9, 0.6, 0.3],
  ...over,
});

describe('presets', () => {
  it('exposes the five documented palettes', () => {
    expect(HIERARCHY_PRESETS.map((p) => p.id)).toEqual([
      'classic',
      'mono-blue',
      'dark-friendly',
      'warm',
      'cool',
    ]);
    for (const preset of HIERARCHY_PRESETS) {
      expect(preset.colors.length).toBeGreaterThanOrEqual(6);
      expect(presetById(preset.id)).toBe(preset);
    }
  });

  it('has no preset entry for custom', () => {
    expect(presetById('custom')).toBeUndefined();
  });
});

describe('resolveLevelColor', () => {
  it('maps root and children to their palette entries', () => {
    expect(resolveLevelColor(0, cfg())).toBe('#ff0000');
    expect(resolveLevelColor(2, cfg())).toBe('#0000ff');
  });

  it('loops beyond the palette', () => {
    const c = cfg({ overflow: 'loop' });
    expect(resolveLevelColor(3, c)).toBe('#ff0000');
    expect(resolveLevelColor(7, c)).toBe('#00ff00');
  });

  it('extends deterministically in gradient mode', () => {
    const c = cfg({ overflow: 'gradient' });
    const level3 = resolveLevelColor(3, c);
    expect(level3).not.toBe('#0000ff');
    expect(level3).toBe(resolveLevelColor(3, c));
    expect(resolveLevelColor(4, c)).not.toBe(level3);
    expect(level3).toMatch(/^hsl\(/);
  });

  it('clamps negative and fractional depths to a level', () => {
    expect(resolveLevelColor(-2, cfg())).toBe('#ff0000');
    expect(resolveLevelColor(1.8, cfg())).toBe('#00ff00');
  });
});

describe('link colour modes', () => {
  it('parent match uses the source depth', () => {
    expect(resolveHierarchyLinkPaint(0, 1, cfg({ linkColorMode: 'parent' }))).toEqual({
      color: '#ff0000',
    });
  });

  it('child match uses the target depth', () => {
    expect(resolveHierarchyLinkPaint(0, 1, cfg({ linkColorMode: 'child' }))).toEqual({
      color: '#00ff00',
    });
  });

  it('level specific adds the per-level opacity', () => {
    expect(resolveHierarchyLinkPaint(1, 2, cfg({ linkColorMode: 'level' }))).toEqual({
      color: '#0000ff',
      opacity: 0.3,
    });
  });
});

describe('resolveLevelOpacity', () => {
  it('falls back to the last configured level', () => {
    expect(resolveLevelOpacity(1, cfg())).toBe(0.6);
    expect(resolveLevelOpacity(9, cfg())).toBe(0.3);
  });
});

describe('uniqueDepths', () => {
  it('returns sorted unique depths', () => {
    expect(uniqueDepths([{ depth: 2 }, { depth: 0 }, { depth: 2 }, { depth: 1 }])).toEqual([0, 1, 2]);
  });
});

describe('mergeHierarchyColorConfig', () => {
  it('returns defaults for legacy configs without hierarchy data', () => {
    expect(mergeHierarchyColorConfig(undefined)).toEqual(defaultHierarchyColorConfig);
    expect(mergeHierarchyColorConfig({})).toEqual(defaultHierarchyColorConfig);
  });

  it('keeps valid stored values and repairs invalid ones', () => {
    const merged = mergeHierarchyColorConfig({
      enabled: true,
      preset: 'warm',
      levelColors: ['#123456'],
      overflow: 'gradient',
      linkColorMode: 'level',
      levelOpacity: [0.5],
    });
    expect(merged.enabled).toBe(true);
    expect(merged.preset).toBe('warm');
    expect(merged.levelColors).toEqual(['#123456']);
    expect(merged.overflow).toBe('gradient');
    expect(merged.linkColorMode).toBe('level');
    expect(merged.levelOpacity).toEqual([0.5]);

    const repaired = mergeHierarchyColorConfig({
      preset: 'nope',
      overflow: 'nope',
      linkColorMode: 'nope',
      levelColors: [],
    } as never);
    expect(repaired.preset).toBe(defaultHierarchyColorConfig.preset);
    expect(repaired.overflow).toBe('loop');
    expect(repaired.linkColorMode).toBe('parent');
    expect(repaired.levelColors).toEqual(defaultHierarchyColorConfig.levelColors);
  });
});
