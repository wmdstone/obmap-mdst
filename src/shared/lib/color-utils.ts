/**
 * Color Utilities - CSS variable resolution and color manipulation
 * 
 * Extracted from NetworkGraph for reuse across components
 */

/**
 * Resolve CSS variable colors to actual HSL values for canvas rendering
 */
export function resolveColor(color: string): string {
	// If it's already a resolved HSL/HSLA value (no CSS variables), return as-is
	if (!color.includes('var(')) {
		return color;
	}

	// Extract the CSS variable name
	const varMatch = color.match(/var\(--([^)]+)\)/);
	if (!varMatch) return color;

	const varName = varMatch[1];

	// Get the computed value from CSS
	const computedValue = getComputedStyle(document.documentElement)
		.getPropertyValue(`--${varName}`)
		.trim();

	if (!computedValue) return color;

	// Replace the var() with the actual value
	return color.replace(`var(--${varName})`, computedValue);
}

/**
 * Convert color to HSLA with opacity for canvas
 */
export function colorWithOpacity(color: string, opacity: number): string {
	const resolved = resolveColor(color);

	// If already hsla, adjust opacity
	if (resolved.startsWith('hsla(')) {
		return resolved.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
	}

	// If hsl, convert to hsla
	if (resolved.startsWith('hsl(')) {
		return resolved.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
	}

	// If it's just HSL values without the function wrapper (from CSS var)
	const hslMatch = resolved.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
	if (hslMatch) {
		return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${opacity})`;
	}

	// Return as-is if we can't parse it
	return resolved;
}

