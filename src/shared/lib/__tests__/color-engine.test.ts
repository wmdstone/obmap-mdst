import { describe, expect, it } from 'vitest';
import {
  colorWithOpacity,
  formatHsl,
  parseHex,
  parseHsl,
  resolveColor,
  rgbToHsl,
} from '@/shared/lib/color-engine';

describe('color-engine', () => {
  describe('parseHex and rgbToHsl', () => {
    it('parses standard 6-digit hex colors', () => {
      expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseHex('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(parseHex('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('parses 3-digit shorthand hex colors', () => {
      expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('returns null for invalid hex values', () => {
      expect(parseHex('invalid')).toBeNull();
      expect(parseHex('#12345')).toBeNull();
    });

    it('converts rgb to hsl correctly', () => {
      expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
      expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 });
      expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
    });
  });

  describe('parseHsl and formatHsl', () => {
    it('parses comma-separated hsl syntax', () => {
      expect(parseHsl('hsl(210, 50%, 60%)')).toEqual({ h: 210, s: 50, l: 60 });
    });

    it('parses space-separated modern hsl syntax', () => {
      expect(parseHsl('hsl(180 70% 40%)')).toEqual({ h: 180, s: 70, l: 40 });
    });

    it('parses bare space-separated hsl values', () => {
      expect(parseHsl('210 50% 60%')).toEqual({ h: 210, s: 50, l: 60 });
    });

    it('parses hex colors as Hsl fallback', () => {
      const red = parseHsl('#ff0000');
      expect(red).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('formats Hsl object back to valid string', () => {
      expect(formatHsl({ h: 210.4, s: 49.6, l: 60 })).toBe('hsl(210, 50%, 60%)');
    });
  });

  describe('colorWithOpacity', () => {
    it('applies opacity to HSL values', () => {
      expect(colorWithOpacity('hsl(210, 50%, 60%)', 0.5)).toBe('hsl(210 50% 60% / 0.5)');
    });

    it('applies opacity to HEX values producing rgba', () => {
      expect(colorWithOpacity('#ff0000', 0.8)).toBe('rgba(255, 0, 0, 0.8)');
      expect(colorWithOpacity('#f00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('applies opacity to RGB values producing rgba', () => {
      expect(colorWithOpacity('rgb(100, 150, 200)', 0.4)).toBe('rgba(100, 150, 200, 0.4)');
    });

    it('clamps opacity to 0..1 range', () => {
      expect(colorWithOpacity('#ff0000', -0.5)).toBe('rgba(255, 0, 0, 0)');
      expect(colorWithOpacity('#ff0000', 1.5)).toBe('rgba(255, 0, 0, 1)');
    });
  });

  describe('resolveColor', () => {
    it('returns raw color as-is when no var() is present', () => {
      expect(resolveColor('#123456')).toBe('#123456');
      expect(resolveColor('hsl(200, 80%, 50%)')).toBe('hsl(200, 80%, 50%)');
    });
  });
});