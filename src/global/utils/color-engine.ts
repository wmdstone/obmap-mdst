/**
 * Unified Color Engine
 * Mengelola parsing, resolusi CSS variable, manipulasi opacity,
 * dan konversi antar format warna (HEX, HSL, RGB).
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Menyelesaikan CSS variable (misal: var(--primary)) menjadi nilai warna computed.
 * Aman dipanggil di lingkungan SSR maupun browser.
 */
export function resolveColor(color: string): string {
  if (!color || typeof color !== 'string') return '';
  if (!color.includes('var(')) return color;

  const varMatch = color.match(/var\(--([^)]+)\)/);
  if (!varMatch) return color;

  const varName = varMatch[1];

  if (typeof document === 'undefined' || !document.documentElement) {
    return color;
  }

  const computedValue = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${varName}`)
    .trim();

  if (!computedValue) return color;

  return color.replace(`var(--${varName})`, computedValue);
}

/**
 * Parsing string HEX (#fff atau #ffffff) menjadi nilai RGB (0-255).
 */
export function parseHex(color: string): Rgb | null {
  const match = color.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;

  const hex = match[1].length === 3
    ? match[1].split('').map((c) => c + c).join('')
    : match[1];

  const int = parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/**
 * Mengonversi nilai RGB (0-255) ke HSL (H: 0-360, S: 0-100, L: 0-100).
 */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const lNorm = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = lNorm > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
    else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) / 6;
    else h = ((rNorm - gNorm) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(lNorm * 100),
  };
}

/**
 * Parsing string warna HSL atau HEX menjadi objek Hsl { h, s, l }.
 */
export function parseHsl(color: string): Hsl | null {
  if (!color || typeof color !== 'string') return null;

  const trimmed = color.trim();

  // Pola standard HSL/HSLA: hsl(210, 50%, 60%) atau hsl(210 50% 60%)
  const hslMatch = trimmed.match(
    /hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/i
  );
  if (hslMatch) {
    return {
      h: Number(hslMatch[1]),
      s: Number(hslMatch[2]),
      l: Number(hslMatch[3]),
    };
  }

  // Pola bare HSL: "210 50% 60%"
  const bareMatch = trimmed.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
  if (bareMatch) {
    return {
      h: Number(bareMatch[1]),
      s: Number(bareMatch[2]),
      l: Number(bareMatch[3]),
    };
  }

  // Fallback: jika berupa HEX, konversikan via RGB
  const rgb = parseHex(trimmed);
  if (rgb) {
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  }

  return null;
}

/**
 * Format objek Hsl menjadi representasi string CSS hsl(h, s%, l%).
 */
export function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Menyisipkan transparansi (opacity 0..1) ke format warna apapun (HEX, HSL, RGB).
 */
export function colorWithOpacity(color: string, opacity: number): string {
  if (!color) return '';
  const resolved = resolveColor(color).trim();
  const alpha = clamp(opacity, 0, 1);

  // HSL / HSLA
  const hsl = resolved.match(/^hsla?\((.*)\)$/i);
  if (hsl) {
    const [h, s, l] = hsl[1].split(/[\s,/]+/).filter(Boolean);
    if (h !== undefined && s !== undefined && l !== undefined) {
      return `hsl(${h} ${s} ${l} / ${alpha})`;
    }
  }

  // Bare HSL: "210 50% 60%"
  const bareHsl = resolved.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (bareHsl) {
    return `hsl(${bareHsl[1]} ${bareHsl[2]}% ${bareHsl[3]}% / ${alpha})`;
  }

  // HEX: #abc atau #aabbcc
  const rgbFromHex = parseHex(resolved);
  if (rgbFromHex) {
    return `rgba(${rgbFromHex.r}, ${rgbFromHex.g}, ${rgbFromHex.b}, ${alpha})`;
  }

  // RGB / RGBA
  const rgb = resolved.match(/^rgba?\((.*)\)$/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (r !== undefined && g !== undefined && b !== undefined) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return resolved;
}