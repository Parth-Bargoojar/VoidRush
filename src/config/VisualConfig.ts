/**
 * VOIDRUSH — visual configuration.
 *
 * Palette hexes are taken verbatim from CONTEXT.md section 8 / Design.md
 * section 3. CONTEXT.md is the highest-precedence document, so where PRD 23 and
 * Design 3 disagree about palette ordering and about Palette B's dark tone,
 * CONTEXT.md's version is used.
 */

import type { DifficultyTier } from '../types';
import { frozen } from './frozen';

/** One gameplay palette, in the roles the renderer consumes. */
export interface PaletteSpec {
  readonly id: string;
  readonly name: string;
  /** Deep tone used as the tunnel base and the scene background/fog. */
  readonly depth: number;
  /** Saturated environment tone used for tunnel accent blocks. */
  readonly environment: number;
  /** Primary obstacle colour. */
  readonly obstaclePrimary: number;
  /** Secondary obstacle geometry. */
  readonly obstacleSecondary: number;
  /** Emissive highlight / gap boundary. */
  readonly emissive: number;
}

/** [CONTEXT 8] Palette A — Blue/Yellow. The default palette. */
const PALETTE_A: PaletteSpec = Object.freeze({
  id: 'A',
  name: 'BLUE / YELLOW',
  depth: 0x0b2a4a,
  environment: 0x1769aa,
  obstaclePrimary: 0xf2c230,
  obstacleSecondary: 0xc87816,
  emissive: 0xffe66d,
});

/** [CONTEXT 8] Palette B — Cyan/Red. */
const PALETTE_B: PaletteSpec = Object.freeze({
  id: 'B',
  name: 'CYAN / RED',
  depth: 0x064b59,
  environment: 0x13cfe3,
  obstaclePrimary: 0xff5260,
  obstacleSecondary: 0xe63946,
  emissive: 0xe8e8e8,
});

/**
 * [CONTEXT 8] Palette C — Purple/Magenta. Magenta is the obstacle tone, Blue is
 * secondary geometry and Bright Magenta is the emissive highlight, exactly as
 * the document assigns them.
 */
const PALETTE_C: PaletteSpec = Object.freeze({
  id: 'C',
  name: 'PURPLE / MAGENTA',
  depth: 0x24103f,
  environment: 0x7136d9,
  obstaclePrimary: 0xd629c9,
  obstacleSecondary: 0x3155e7,
  emissive: 0xff58e7,
});

/**
 * [CONTEXT 8] Palette D — Red Overload. Reserved for high-intensity gameplay.
 * The document lists only four tones here, so Crimson doubles as the secondary
 * geometry colour and Pink serves as the highlight.
 */
const PALETTE_D: PaletteSpec = Object.freeze({
  id: 'D',
  name: 'RED OVERLOAD',
  depth: 0x09090b,
  environment: 0xc9182b,
  obstaclePrimary: 0xf02d3a,
  obstacleSecondary: 0xc9182b,
  emissive: 0xff6b7a,
});

export const PALETTES: ReadonlyArray<PaletteSpec> = Object.freeze([
  PALETTE_A,
  PALETTE_B,
  PALETTE_C,
  PALETTE_D,
]);

/** Which palette each difficulty phase uses. Transitions lerp over 3 seconds. */
export const TIER_PALETTE: Readonly<Record<DifficultyTier, number>> = Object.freeze({
  INTRO: 0,
  BUILD: 1,
  INTENSE: 2,
  OVERLOAD: 3,
});

export const VISUAL = frozen({
  /** Seconds a palette cross-fade takes. */
  PALETTE_LERP_SECONDS: 3,
  /**
   * Minimum luminance contrast between obstacle geometry and the tunnel base.
   * Checked numerically by tests, not by eye. The tunnel base is darkened
   * automatically until this holds.
   */
  MIN_OBSTACLE_CONTRAST: 4.5,
  /** Headroom applied when darkening, so the assertion is not borderline. */
  TARGET_OBSTACLE_CONTRAST: 5,
  /**
   * Multiplier applied to the depth tone to get the tunnel base.
   * Dark enough to read as "dark environment", bright enough that the voxel
   * walls are actually visible once lit.
   */
  TUNNEL_BASE_DARKEN: 0.9,
  /**
   * The background and fog sit well below the tunnel. They were originally much
   * closer, which made the wall blocks nearly invisible: they were the same
   * tone as the void behind them, so only the bright accent blocks read.
   */
  BACKGROUND_DARKEN: 0.3,
  /** Fraction of tunnel blocks that use the bright accent tone. */
  ACCENT_BLOCK_FRACTION: 0.09,

  BLOOM_STRENGTH: 0.7,
  BLOOM_RADIUS: 0.5,
  /**
   * High enough that obstacle edges glow but do not blob. The edge texture's
   * rim samples at full instance colour and so crosses this; the face interior
   * sits at OBSTACLE_FACE_INTERIOR of it, which for the darker obstacle tones
   * falls back under the threshold, so the glow concentrates on the outline.
   */
  BLOOM_THRESHOLD: 0.72,

  /*
   * Obstacle face treatment (see Materials.ts). Obstacles are unlit, so these
   * factors are the only shading they get. All are linear multipliers on the
   * instance colour.
   */
  /**
   * Brightness of a face's interior relative to its glowing rim. Bounded below
   * by readability: the dimmest resolved obstacle tone needs about 0.85 of its
   * value to keep MIN_OBSTACLE_CONTRAST against the tunnel base, which tests
   * assert for the camera-facing face.
   */
  OBSTACLE_FACE_INTERIOR: 0.86,
  /** Side faces (normal across the view direction) relative to the front face. */
  OBSTACLE_SIDE_SHADE: 0.72,
  /** Added on faces pointing up in view space and removed on those pointing down. */
  OBSTACLE_TOP_LIFT: 0.08,

  VIGNETTE_STRENGTH: 0.32,
  GRADE_SATURATION: 1.12,
  GRADE_CONTRAST: 1.06,

  /**
   * [PRD 26] Chromatic aberration is optional and edge-only. It begins once
   * the effective visual intensity (difficulty × the Visual intensity setting)
   * passes this point.
   */
  CHROMATIC_ABERRATION_FROM_INTENSITY: 0.6,
  CHROMATIC_ABERRATION_MAX: 0.0022,

  /**
   * [PRD 17 / 16] Effects scale with difficulty: INTRO asks for "minimal visual
   * effects" and INTENSE / OVERLOAD for "more aggressive" ones. Bloom and
   * vignette run from these floors at zero intensity up to full strength at
   * maximum intensity, so the look builds with the run instead of starting at
   * its peak.
   */
  BLOOM_INTENSITY_FLOOR: 0.55,
  VIGNETTE_INTENSITY_FLOOR: 0.6,

  /*
   * [PRD 11] Collision feedback: after the ~100 ms hit-stop the frame warps,
   * splits its colour channels and drains of colour, then fades toward black
   * as the results screen takes over. Values are shader-space amounts.
   */
  /** Whole-screen channel split at the moment of impact. */
  IMPACT_ABERRATION: 0.018,
  /** Amplitude of the radial ripple, in UV units. */
  IMPACT_WARP: 0.01,
  /** Ripple rings across the screen radius. */
  IMPACT_WARP_FREQUENCY: 38,
  /** How far the frame desaturates at peak distortion (0 keeps full colour). */
  IMPACT_DESATURATE: 0.7,
  /** Additive white flash during the hit-stop. */
  IMPACT_FLASH: 0.35,
  /** Fraction of the feedback sequence after which the fade begins. */
  IMPACT_FADE_FROM: 0.45,
  /** Final darkening held behind the results screen (1 would be black). */
  IMPACT_FADE_TO: 0.7,

  /*
   * Overload colour pulse, driven by difficulty overdrive (past 150 s). A
   * rhythmic swell in brightness and saturation across the whole frame. Kept
   * well under 3 Hz, the WCAG general-flash threshold, and scaled by both the
   * Effects intensity and Visual intensity settings.
   */
  OVERLOAD_PULSE_BRIGHTNESS: 0.14,
  OVERLOAD_PULSE_SATURATION: 0.35,
  OVERLOAD_PULSE_HZ_MIN: 0.8,
  OVERLOAD_PULSE_HZ_MAX: 2,

  /** Menu background runs the tunnel at reduced intensity. [Design 10] 20-30%. */
  MENU_SPEED_FACTOR: 0.25,

  /**
   * Ambient / key light intensities.
   *
   * Obstacles are unlit, so lighting only shapes the tunnel. The total is kept
   * near 1.0 on a typical wall so the rendered tunnel does not come out
   * brighter than the base colour the contrast check is computed against.
   */
  AMBIENT_INTENSITY: 0.85,
  HEMISPHERE_INTENSITY: 0.3,
  KEY_INTENSITY: 0.5,
  /**
   * Point lights use decay 0. Three.js defaults to physically correct decay,
   * where intensity falls with the square of distance — at tunnel scale that
   * left these contributing essentially nothing and the walls rendered black.
   */
  POINT_INTENSITY: 0.45,
  POINT_DECAY: 0,
  POINT_DISTANCE: 260,

  /** HUD de-emphasis at high difficulty. */
  HUD_MIN_OPACITY: 0.55,
});

/**
 * [TRD Quality Scaling] Low reduces bloom and effects; Ultra is the maximum
 * supported quality. Gameplay is identical at every level: these values only
 * reach the post-processing chain.
 */
export const QUALITY_BLOOM = Object.freeze({
  /** Bloom strength multiplier per quality level. */
  strength: Object.freeze({ low: 0.7, medium: 1, high: 1, ultra: 1.1 }),
  /** Bloom render-target resolution, as a fraction of the canvas. */
  resolution: Object.freeze({ low: 0.5, medium: 0.75, high: 1, ultra: 1 }),
});
