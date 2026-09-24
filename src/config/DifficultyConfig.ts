/**
 * VOIDRUSH — difficulty curve configuration.
 *
 * A single normalised scalar `d` drives speed weighting, spacing, gap size,
 * rotation, oscillation, obstacle-type probability and visual intensity
 * simultaneously. Difficulty is never expressed by speed alone.
 */

import type { DifficultyTier, ObstacleType } from '../types';
import { frozen } from './frozen';
import { lerp } from '../utils/MathUtils';

export const DIFFICULTY = frozen({
  /** `d` saturates after this many seconds of survival. */
  RAMP_SECONDS: 150,

  /**
   * [PRD] Phase boundaries, in seconds of survival.
   * INTRO 0-20, BUILD 20-60, INTENSE 60-120, OVERLOAD 120+.
   */
  TIER_BUILD_AT: 20,
  TIER_INTENSE_AT: 60,
  TIER_OVERLOAD_AT: 120,

  /**
   * Seconds of travel between consecutive obstacles. Spacing is derived as
   * `speed * gapSeconds`, which is what the PRD asks for: spacing computed from
   * player speed and required reaction time rather than a fixed distance.
   */
  GAP_SECONDS_START: 0.95,
  GAP_SECONDS_END: 0.62,
  /** [PRD] Initial minimum spacing 25-35 units; never below the floor. */
  SPACING_MIN: 26,
  SPACING_MAX: 140,

  /** Opening half-extent across the run. */
  OPENING_HALF_START: 5,
  OPENING_HALF_END: 2.6,

  /** Extra clearance the reachability validator demands beyond the player radius. */
  REACH_MARGIN_START: 1.4,
  REACH_MARGIN_END: 0.9,

  /** Radians per second for rotating obstacles. */
  ROTATION_SPEED_START: 0.35,
  ROTATION_SPEED_END: 1.4,

  /**
   * Oscillation of moving gates. Frequency is derived from the peak speed
   * rather than set directly: an opening that slides faster than the player can
   * chase it is not a difficulty setting, it is an unwinnable obstacle. Peak
   * speed stays well under MOVEMENT.MAX_LATERAL_SPEED at every difficulty.
   */
  OSCILLATION_AMPLITUDE_START: 1.5,
  OSCILLATION_AMPLITUDE_END: 5,
  OSCILLATION_PEAK_SPEED_START: 2.5,
  OSCILLATION_PEAK_SPEED_END: 6,

  /** Drives palette intensity, bloom weighting and HUD de-emphasis. */
  VISUAL_INTENSITY_START: 0.15,
  VISUAL_INTENSITY_END: 1,

  /*
   * Overdrive: difficulty past the end of the main ramp.
   *
   * Forward speed stays capped at SPEED.MAX, and gaps, spacing and margins
   * stay where the ramp left them, because those are what bound human
   * reaction. What keeps rising, for as long as the run lasts, is how fast
   * obstacles turn and slide, plus the overload colour pulse.
   *
   * overdrive(t) = 1 - exp(-(t - RAMP_SECONDS) / OVERDRIVE_TAU)
   *
   * That curve increases at every moment and never stops increasing, but it
   * approaches a ceiling. Every added rate is chosen so the ceiling itself is
   * still provably passable: slides stay below the slowest player setting
   * (MOVEMENT.MAX_LATERAL_SPEED x SENSITIVITY_MIN = 8.4 u/s), and spinning
   * bodies shed spokes or fall back to a proven gate if a sector would sweep
   * too fast. The reachability validator still vets every obstacle.
   */
  OVERDRIVE_TAU: 150,
  /** Added rad/s for rotating obstacles at full overdrive. */
  ROTATION_SPEED_OVERDRIVE: 0.8,
  /** Added u/s peak slide for moving gates at full overdrive. */
  OSCILLATION_PEAK_SPEED_OVERDRIVE: 2,
});

/** [PRD 16] Rotation rate for rotating obstacles. Shared by the curve and the archetypes. */
export function rotationSpeedFor(d: number, overdrive = 0): number {
  return (
    lerp(DIFFICULTY.ROTATION_SPEED_START, DIFFICULTY.ROTATION_SPEED_END, d) +
    overdrive * DIFFICULTY.ROTATION_SPEED_OVERDRIVE
  );
}

/** Peak slide speed of a moving gate's opening. Shared by the curve and the archetype. */
export function oscillationPeakSpeedFor(d: number, overdrive = 0): number {
  return (
    lerp(DIFFICULTY.OSCILLATION_PEAK_SPEED_START, DIFFICULTY.OSCILLATION_PEAK_SPEED_END, d) +
    overdrive * DIFFICULTY.OSCILLATION_PEAK_SPEED_OVERDRIVE
  );
}

/**
 * Obstacle type availability and relative weight per phase.
 *
 * [PRD Phase 1 — INTRO, 0-20 s] static obstacles only, widest gaps, no rotation,
 * so the player can learn the controls without a tutorial.
 * [PRD Phase 2 — BUILD] introduces moving and rotating obstacles.
 * [PRD Phase 3 — INTENSE] introduces combinations.
 */
export const TYPE_WEIGHTS: Readonly<Record<DifficultyTier, ReadonlyArray<readonly [ObstacleType, number]>>> =
  Object.freeze({
    INTRO: Object.freeze([
      ['STATIC_GATE', 5],
      ['RING', 3],
      ['CROSS', 2],
    ] as ReadonlyArray<readonly [ObstacleType, number]>),
    BUILD: Object.freeze([
      ['STATIC_GATE', 3],
      ['RING', 2],
      ['CROSS', 2],
      ['BULLSEYE', 2],
      ['MOVING_GATE', 3],
      ['ROTATING_CROSS', 2],
      ['ROTATING_RING', 2],
      ['FAN', 2],
      ['CAGE', 2],
    ] as ReadonlyArray<readonly [ObstacleType, number]>),
    INTENSE: Object.freeze([
      ['STATIC_GATE', 2],
      ['RING', 1],
      ['CROSS', 1],
      ['BULLSEYE', 2],
      ['MOVING_GATE', 3],
      ['ROTATING_CROSS', 3],
      ['ROTATING_RING', 3],
      ['FAN', 3],
      ['CAGE', 3],
      ['COMBINATION', 3],
    ] as ReadonlyArray<readonly [ObstacleType, number]>),
    OVERLOAD: Object.freeze([
      ['STATIC_GATE', 1],
      ['RING', 1],
      ['CROSS', 1],
      ['BULLSEYE', 2],
      ['MOVING_GATE', 3],
      ['ROTATING_CROSS', 3],
      ['ROTATING_RING', 3],
      ['FAN', 4],
      ['CAGE', 3],
      ['COMBINATION', 5],
    ] as ReadonlyArray<readonly [ObstacleType, number]>),
  });

/** Sub-types a combination obstacle may stack. Combinations never nest. */
export const COMBINATION_MEMBERS: ReadonlyArray<ObstacleType> = Object.freeze([
  'STATIC_GATE',
  'RING',
  'CROSS',
  'MOVING_GATE',
  'ROTATING_CROSS',
  'ROTATING_RING',
  'FAN',
]);
