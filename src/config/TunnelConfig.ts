/**
 * VOIDRUSH — procedural tunnel variation.
 *
 * [PRD 6] The tunnel varies in width, height, cross-section (rectangular,
 * polygonal, irregular), rotation about the forward axis, voxel layout, wall
 * pattern and light position. [PRD 16 / 17] Width follows difficulty: a large
 * tunnel in INTRO narrowing as the run intensifies, with geometric variation
 * introduced in the INTENSE phase.
 *
 * The tunnel is decorative and never collidable, and the player's clamp box
 * does not change with it. Every value here is bounded so that no wall block,
 * at any width, roll or roughness, can intrude into the box the player can
 * reach. That is what keeps the reachability proof independent of the tunnel.
 */

import type { DifficultyTier } from '../types';
import { COLLISION, WORLD } from './GameConfig';
import { frozen } from './frozen';

/** Half-size of the square no wall block may enter: the reachable box plus a hair. */
const SAFE_HALF = WORLD.PLAYER_CLAMP + WORLD.PLAYER_RADIUS + 0.2;

const ROLL_MAX = (14 * Math.PI) / 180;

export const TUNNEL = frozen({
  SAFE_HALF,

  /**
   * Profile keyframes are spaced this many segments apart; between keyframes
   * every dimension ramps linearly, so changes are progressive [PRD 6].
   */
  SECTION_SEGMENTS: 3,

  /**
   * [PRD 16 / 17] Base half-extent of the tunnel across the run: large in
   * INTRO, narrowing toward the end of the difficulty ramp. Mirrors the
   * TRD's `tunnelWidth` difficulty output.
   */
  WIDTH_START: 14.5,
  WIDTH_END: 12.4,

  /** [PRD 6] Narrow / standard / wide (or tall) variants sit this far apart. */
  VARIANT_STEP: 1.5,
  /** No keyframe is narrower than this: full-protrusion blocks still clear SAFE_HALF. */
  HALF_MIN: WORLD.TUNNEL_HALF_WIDTH,
  HALF_MAX: 16,

  /** [PRD 6] Gradual rotation about the forward axis, from INTENSE onward. */
  ROLL_MAX,

  /** Extra inward protrusion an irregular cross-section may add to a block. */
  IRREGULAR_PROTRUSION: 1.8,
  /** Fraction of irregular blocks pushed to full protrusion as pillars. */
  IRREGULAR_PILLAR_CHANCE: 0.08,
  /** Clearance a polygonal chamfer keeps beyond the minimum it could sit at. */
  CHAMFER_MARGIN: 0.6,

  /*
   * Wall rhythm. Rings, ribs and guide-rail dashes all count the same run-wide
   * row number and share a beat of four rows, so the speed markers stay in
   * step when the wall pattern changes between sections.
   */
  /** Rows between accent rings in the RINGS wall pattern: every other beat. */
  RING_INTERVAL: 8,
  /** Rows between structural ribs in the RIBS wall pattern: every beat. */
  RIB_INTERVAL: 4,
  /** Rows in one guide-rail period along the tunnel corners. */
  GUIDE_RAIL_PERIOD: 4,
  /** Lit rows at the start of each guide-rail period; the rest are the gap. */
  GUIDE_RAIL_DASH: 3,
  /** Protrusion used between ribs, so the ribs read. */
  RIB_FLAT_PROTRUSION: 0.25,

  /** [PRD 6] Point lights move within this fraction of the tunnel half-extent. */
  LIGHT_OFFSET_FRACTION: 0.55,

  /**
   * Largest half-extent any row can reach once the safety guard has widened
   * it for roll and roughness. Sizes instance buffers and the obstacle frame.
   */
  HALF_CAP: Math.max(
    16,
    SAFE_HALF * (Math.cos(ROLL_MAX) + Math.sin(ROLL_MAX)) +
      WORLD.BLOCK_PROTRUSION +
      1.8,
  ),

  /**
   * Upper bound on blocks per segment, used to size instance buffers. Tests
   * assert generation never reaches it across seeds and difficulties.
   */
  MAX_BLOCKS_PER_SEGMENT: 1100,

  /**
   * Spinning obstacles carry a static frame starting here. It lies beyond the
   * reachable box plus the widest near-miss threshold, so a player hugging the
   * boundary can never score a near miss off a frame they cannot reach.
   */
  SPIN_FRAME_INNER: WORLD.PLAYER_CLAMP + WORLD.PLAYER_RADIUS + COLLISION.NEAR_MISS_CLOSE + 0.1,
});

/**
 * Obstacles extend to the widest wall the tunnel can present, so that no
 * section ever shows open air around an obstacle that the player cannot use.
 * Where the tunnel is narrower the excess sits behind the wall blocks.
 */
export const OBSTACLE_FRAME_OUTER =
  TUNNEL.HALF_CAP * (Math.cos(TUNNEL.ROLL_MAX) + Math.sin(TUNNEL.ROLL_MAX)) + 1;

/** Frames sit fractionally proud of the body so overlapping faces never z-fight. */
export const OBSTACLE_FRAME_DEPTH_FACTOR = 1.04;

export type CrossSection = 'RECT' | 'POLYGONAL' | 'IRREGULAR';
export type WallPattern = 'SCATTER' | 'RINGS' | 'STRIPES' | 'RIBS';

export const WALL_PATTERNS: ReadonlyArray<WallPattern> = Object.freeze([
  'SCATTER',
  'RINGS',
  'STRIPES',
  'RIBS',
]);

/**
 * [PRD 17] Geometric variation (width/height variants, cross-section, roll)
 * begins with INTENSE, which lists "tunnel variation". Earlier phases keep the
 * large rectangular tunnel; voxel layout and wall pattern vary throughout.
 */
export const TIER_ALLOWS_SHAPE_VARIATION: Readonly<Record<DifficultyTier, boolean>> =
  Object.freeze({
    INTRO: false,
    BUILD: false,
    INTENSE: true,
    OVERLOAD: true,
  });

/** Relative weights of the cross-sections once variation is allowed. */
export const CROSS_SECTION_WEIGHTS: ReadonlyArray<readonly [CrossSection, number]> =
  Object.freeze([
    ['RECT', 2],
    ['POLYGONAL', 2],
    ['IRREGULAR', 2],
  ] as ReadonlyArray<readonly [CrossSection, number]>);
