/** Background and interaction effects; link flow remains owned by LinkConfig. */
export interface AtmosphereConfig {
  cosmicParticles: number;
  cosmicSpeed: number;
  nodeElevation: boolean;
  elevationIntensity: number;
}

export const defaultAtmosphereConfig: AtmosphereConfig = {
  cosmicParticles: 35,
  cosmicSpeed: 1,
  nodeElevation: true,
  elevationIntensity: 0.6,
};

export const COSMIC_PRESETS = [
  { label: 'Off', intensity: 0 },
  { label: 'Star Dust', intensity: 50 },
  { label: 'Cyber Nebula', intensity: 100 },
] as const;

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function mergeAtmosphereConfig(partial?: Partial<AtmosphereConfig> | null): AtmosphereConfig {
  return {
    cosmicParticles: clamp(partial?.cosmicParticles, 0, 100, defaultAtmosphereConfig.cosmicParticles),
    cosmicSpeed: clamp(partial?.cosmicSpeed, 0.2, 3, defaultAtmosphereConfig.cosmicSpeed),
    nodeElevation: typeof partial?.nodeElevation === 'boolean'
      ? partial.nodeElevation : defaultAtmosphereConfig.nodeElevation,
    elevationIntensity: clamp(partial?.elevationIntensity, 0, 1, defaultAtmosphereConfig.elevationIntensity),
  };
}

export function elevationStrength(config: AtmosphereConfig, active: boolean, dimmed = false): number {
  return config.nodeElevation && active && !dimmed ? config.elevationIntensity : 0;
}