/**
 * VOIDRUSH — resolved gameplay palettes.
 *
 * The design system specifies saturated environment tones, and it also demands
 * that obstacles stay readable against the tunnel. Those two requirements pull
 * against each other: bright cyan walls behind a red obstacle give barely 2:1
 * contrast.
 *
 * The resolution follows Design.md's own colour hierarchy — "dark environment,
 * then coloured tunnel, then bright obstacle". The tunnel *base* is derived by
 * darkening the palette's depth tone until it clears the contrast threshold
 * numerically, while the doc-specified saturated tone survives at full strength
 * on accent blocks, lighting and fog. Nothing here is judged by eye.
 *
 * This module imports no Three.js, so the contrast rule is testable in Node.
 */

import { PALETTES, VISUAL, type PaletteSpec } from '../config/VisualConfig';
import { brightenForContrast, contrastRatio, lerpColor, scaleColor } from '../utils/Color';
import type { DifficultyTier } from '../types';
import { TIER_PALETTE } from '../config/VisualConfig';

/** A palette after the readability rule has been applied. */
export interface ResolvedPalette {
  readonly id: string;
  readonly name: string;
  /** Scene background and fog. */
  readonly background: number;
  /** Tunnel wall blocks. Darkened until obstacles clear the contrast bar. */
  readonly tunnelBase: number;
  /** Emissive tunnel accent blocks; the doc's saturated environment tone. */
  readonly tunnelAccent: number;
  readonly obstaclePrimary: number;
  readonly obstacleSecondary: number;
  /** Gap boundary / emissive highlight. */
  readonly obstacleAccent: number;
  /** Measured contrast of the primary obstacle tone against the tunnel base. */
  readonly measuredContrast: number;
}

function resolve(spec: PaletteSpec): ResolvedPalette {
  // The tunnel keeps the document's depth hue, darkened by a fixed amount so
  // the environment reads as "dark, coloured" rather than being pushed to black.
  const tunnelBase = scaleColor(spec.depth, VISUAL.TUNNEL_BASE_DARKEN);

  // Every obstacle tone is then lifted until it clears the readability bar
  // against that tunnel.
  const lift = (tone: number): number =>
    brightenForContrast(tone, tunnelBase, VISUAL.TARGET_OBSTACLE_CONTRAST);

  const obstaclePrimary = lift(spec.obstaclePrimary);

  return {
    id: spec.id,
    name: spec.name,
    background: scaleColor(tunnelBase, VISUAL.BACKGROUND_DARKEN),
    tunnelBase,
    tunnelAccent: spec.environment,
    obstaclePrimary,
    obstacleSecondary: lift(spec.obstacleSecondary),
    obstacleAccent: lift(spec.emissive),
    measuredContrast: contrastRatio(obstaclePrimary, tunnelBase),
  };
}

export const RESOLVED_PALETTES: ReadonlyArray<ResolvedPalette> = Object.freeze(
  PALETTES.map(resolve),
);

export function paletteForTier(tier: DifficultyTier): ResolvedPalette {
  return RESOLVED_PALETTES[TIER_PALETTE[tier]] ?? RESOLVED_PALETTES[0]!;
}

/** A palette part-way between two others, for the three-second cross-fade. */
export function blendPalettes(
  from: ResolvedPalette,
  to: ResolvedPalette,
  t: number,
): ResolvedPalette {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return {
    id: `${from.id}->${to.id}`,
    name: to.name,
    background: lerpColor(from.background, to.background, t),
    tunnelBase: lerpColor(from.tunnelBase, to.tunnelBase, t),
    tunnelAccent: lerpColor(from.tunnelAccent, to.tunnelAccent, t),
    obstaclePrimary: lerpColor(from.obstaclePrimary, to.obstaclePrimary, t),
    obstacleSecondary: lerpColor(from.obstacleSecondary, to.obstacleSecondary, t),
    obstacleAccent: lerpColor(from.obstacleAccent, to.obstacleAccent, t),
    measuredContrast: Math.min(from.measuredContrast, to.measuredContrast),
  };
}
