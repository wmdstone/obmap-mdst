/**
 * cosmicAtmosphere.ts - High-Performance Living Canvas Atmosphere Engine
 * 
 * Draws deterministic drifting cosmic dust, twinkling stars, and cyber grid nebulae
 * directly into the background of ForceGraph2D with zero external dependencies.
 */

export interface CosmicAtmosphereConfig {
  /** 0 = Off, 50 = Subtle Star Dust, 100 = Cyber Grid Nebula */
  intensity: number;
  /** Speed multiplier for particle drift (default: 1.0) */
  speed?: number;
}

interface StarParticle {
  xNorm: number;
  yNorm: number;
  size: number;
  twinklePhase: number;
  twinkleSpeed: number;
  driftSpeedX: number;
  driftSpeedY: number;
  baseAlpha: number;
  hue: number;
}

// Generate seeded deterministic starfield (120 particles)
const STAR_COUNT = 120;
const STARS: StarParticle[] = (() => {
  const stars: StarParticle[] = [];
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      xNorm: pseudoRand(),
      yNorm: pseudoRand(),
      size: 0.75 + pseudoRand() * 1.75,
      twinklePhase: pseudoRand() * Math.PI * 2,
      twinkleSpeed: 0.8 + pseudoRand() * 2.2,
      driftSpeedX: (pseudoRand() - 0.5) * 0.015,
      driftSpeedY: (pseudoRand() - 0.5) * 0.015,
      baseAlpha: 0.25 + pseudoRand() * 0.65,
      hue: pseudoRand() > 0.7 ? (pseudoRand() > 0.5 ? 190 : 270) : 0, // Cool cyan or cosmic violet
    });
  }
  return stars;
})();

/**
 * Draws the living canvas atmosphere (Cosmic Dust & Nebula Grid)
 * @param ctx 2D Canvas context (transformed to viewport screen coordinates)
 * @param width Viewport width in screen pixels
 * @param height Viewport height in screen pixels
 * @param time Current timestamp in seconds (e.g. performance.now() / 1000)
 * @param config Atmosphere configuration
 */
export function drawCosmicAtmosphere(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  config: CosmicAtmosphereConfig
): void {
  const intensity = Math.max(0, Math.min(100, config.intensity));
  if (intensity <= 0 || width <= 0 || height <= 0) return;

  const speed = config.speed ?? 1.0;
  const factor = intensity / 100;

  ctx.save();

  // 1. NEBULA GLOW AURA (Subtle ambient cloud gradients for intensity >= 25)
  if (intensity >= 25) {
    const nebulaAlpha = (factor - 0.25) * 0.18;
    const cx1 = width * (0.3 + 0.1 * Math.sin(time * 0.15 * speed));
    const cy1 = height * (0.35 + 0.1 * Math.cos(time * 0.12 * speed));
    const r1 = Math.max(width, height) * 0.55;

    const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
    g1.addColorStop(0, `hsla(260, 80%, 45%, ${nebulaAlpha * 0.9})`);
    g1.addColorStop(0.5, `hsla(220, 70%, 35%, ${nebulaAlpha * 0.4})`);
    g1.addColorStop(1, 'hsla(240, 50%, 10%, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    // Second nebula pocket (Cyan/Teal)
    if (intensity >= 60) {
      const cx2 = width * (0.7 - 0.1 * Math.cos(time * 0.18 * speed));
      const cy2 = height * (0.65 + 0.08 * Math.sin(time * 0.14 * speed));
      const r2 = Math.max(width, height) * 0.45;

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, `hsla(185, 85%, 40%, ${nebulaAlpha * 0.65})`);
      g2.addColorStop(1, 'hsla(195, 60%, 15%, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. CYBER GRID (For high intensity: 60..100)
  if (intensity >= 55) {
    const gridAlpha = (factor - 0.55) * 0.14;
    const gridSize = 64;
    const offsetX = (time * 6 * speed) % gridSize;
    const offsetY = (time * 4 * speed) % gridSize;

    ctx.strokeStyle = `hsla(210, 80%, 65%, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  // 3. COSMIC PARTICLES & STAR DUST (Twinkling & Smooth Drifting)
  const activeStarCount = Math.floor(STAR_COUNT * (0.35 + factor * 0.65));

  for (let i = 0; i < activeStarCount; i++) {
    const star = STARS[i];

    // Smooth looping coordinate drift
    let px = ((star.xNorm + star.driftSpeedX * time * speed) % 1) * width;
    let py = ((star.yNorm + star.driftSpeedY * time * speed) % 1) * height;
    if (px < 0) px += width;
    if (py < 0) py += height;

    // Breathing twinkle pulse
    const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed * speed + star.twinklePhase);
    const alpha = star.baseAlpha * factor * twinkle;

    if (alpha <= 0.02) continue;

    ctx.beginPath();
    ctx.arc(px, py, star.size, 0, Math.PI * 2);

    if (star.hue > 0) {
      ctx.fillStyle = `hsla(${star.hue}, 85%, 75%, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    }
    ctx.fill();

    // Subtle soft halo for larger prominent stars
    if (star.size > 1.8 && alpha > 0.3) {
      ctx.beginPath();
      ctx.arc(px, py, star.size * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${star.hue || 210}, 80%, 70%, ${alpha * 0.25})`;
      ctx.fill();
    }
  }

  ctx.restore();
}