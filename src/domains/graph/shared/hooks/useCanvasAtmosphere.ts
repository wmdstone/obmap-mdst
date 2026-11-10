import { useCallback, useEffect, useRef } from 'react';
import type { GraphConfigState } from '@/domains/graph/shared/stores/useGraphStore';
import type { LayoutMode, RenderNode } from '@/domains/graph/shared/utils/graph.types';
import type { GraphTheme } from '@/domains/graph/shared/utils/theme';
import { drawCosmicAtmosphere } from '@/domains/graph/shared/utils/cosmicAtmosphere';
import { drawDecorations } from '@/domains/graph/shared/utils/drawDecorations';
import { resolveHierarchyLinkPaint } from '@/domains/graph/shared/utils/hierarchyColors';
import { prefersReducedMotion } from '@/domains/graph/shared/utils/transitionController';

const dashFor = (style: string | undefined, width: number): number[] => {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [1, width * 2];
  return [];
};

export interface UseCanvasAtmosphereOptions {
  graphConfig: GraphConfigState;
  layoutMode: LayoutMode;
  decorations: unknown[];
  theme: GraphTheme;
  projection: {
    byId: Map<string, RenderNode>;
  };
  zoomOutRendering: string;
  size: { width: number; height: number };
  zoomRef: React.MutableRefObject<number>;
}

export function useCanvasAtmosphere({
  graphConfig,
  layoutMode,
  decorations,
  theme,
  projection,
  zoomOutRendering,
  size,
  zoomRef,
}: UseCanvasAtmosphereOptions) {
  const particleProgress = useRef(0);
  const particleStartedAt = useRef(performance.now());
  const glowPhase = useRef(0);
  const glowStartedAt = useRef(performance.now());

  const particlesActive = graphConfig.links.showParticles && graphConfig.links.particles > 0;
  const glowAnimated =
    graphConfig.nodes.glow && graphConfig.nodes.glowSpeed > 0 && !prefersReducedMotion();
  const cosmicActive = ((graphConfig as any).atmosphere?.cosmicParticles ?? 35) > 0;
  const autoPauseRedraw = !particlesActive && !glowAnimated && !cosmicActive;

  useEffect(() => {
    glowStartedAt.current = performance.now();
    glowPhase.current = 0;
  }, [graphConfig.nodes.glow, graphConfig.nodes.glowSpeed]);

  const renderDecorations = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      zoomRef.current = globalScale;

      // 1. Living Canvas Atmosphere (Cosmic Dust & Nebula Grid)
      const atmosphere = (graphConfig as any).atmosphere ?? { cosmicParticles: 35, cosmicSpeed: 1 };
      const canvasW = ctx.canvas?.width || size.width;
      const canvasH = ctx.canvas?.height || size.height;
      if (atmosphere.cosmicParticles > 0 && canvasW > 0 && canvasH > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawCosmicAtmosphere(ctx, canvasW, canvasH, performance.now() / 1000, {
          intensity: atmosphere.cosmicParticles,
          speed: atmosphere.cosmicSpeed ?? 1.0,
        });
        ctx.restore();
      }

      // 2. Link flow particles & node glow phases
      if (particlesActive) {
        particleProgress.current =
          ((performance.now() - particleStartedAt.current) * graphConfig.links.particleSpeed) / 100;
      }
      glowPhase.current = glowAnimated
        ? ((performance.now() - glowStartedAt.current) / 2400) * graphConfig.nodes.glowSpeed
        : 0.25;

      // 3. Fishbone & hierarchy layout decorations
      if (layoutMode === 'fishbone' && !graphConfig.topology.showHierarchy) return;
      const hierarchy = graphConfig.topology.styles.hierarchy;
      const levels = graphConfig.hierarchy;
      drawDecorations(
        ctx,
        decorations as any,
        theme,
        globalScale,
        {
          color: hierarchy.color || theme.link,
          opacity: hierarchy.opacity,
          width: hierarchy.width,
          dash: dashFor(hierarchy.lineStyle, hierarchy.width),
        },
        levels.enabled
          ? (decoration) => {
              const sourceDepth =
                projection.byId.get((decoration as { sourceId?: string }).sourceId ?? '')?.depth;
              const targetDepth = projection.byId.get(decoration.targetId ?? '')?.depth;
              if (sourceDepth === undefined && targetDepth === undefined) return null;
              return resolveHierarchyLinkPaint(
                sourceDepth ?? targetDepth ?? 0,
                targetDepth ?? sourceDepth ?? 0,
                levels
              );
            }
          : undefined,
        zoomOutRendering === 'full-detail'
      );
    },
    [
      decorations,
      theme,
      layoutMode,
      particlesActive,
      glowAnimated,
      graphConfig.nodes.glowSpeed,
      graphConfig.links.particleSpeed,
      graphConfig.topology.showHierarchy,
      graphConfig.topology.styles.hierarchy,
      graphConfig.hierarchy,
      projection,
      zoomOutRendering,
      (graphConfig as any).atmosphere,
      size.width,
      size.height,
      zoomRef,
    ]
  );

  return {
    particleProgress,
    glowPhase,
    particlesActive,
    glowAnimated,
    cosmicActive,
    autoPauseRedraw,
    renderDecorations,
  };
}