/**
 * VOIDRUSH — scoring, combo and near-miss configuration.
 *
 * [PRD 13] base obstacle score +100, scaled by a difficulty multiplier and the
 * combo multiplier. [PRD 14] combo is tiered and caps at x6 for the MVP, with
 * the cap left configurable so it can be raised later. [PRD 15] near miss pays
 * +250 / +500 / +1000 by proximity tier.
 */

import type { NearMissTier, ObstacleType } from '../types';
import { frozen } from './frozen';

export const SCORE = frozen({
  /** [PRD] Base obstacle score. */
  BASE_OBSTACLE: 100,
  /** Passive survival trickle, never multiplied. */
  SURVIVAL_PER_SECOND: 2,
});

/**
 * [PRD 13] "Higher difficulty increases the base reward." Expressed as a
 * per-archetype weight, since harder archetypes only appear at higher
 * difficulty.
 */
export const OBSTACLE_WEIGHTS: Readonly<Record<ObstacleType, number>> = Object.freeze({
  STATIC_GATE: 1,
  RING: 1.1,
  CROSS: 1.15,
  BULLSEYE: 1.25,
  MOVING_GATE: 1.3,
  ROTATING_RING: 1.35,
  ROTATING_CROSS: 1.4,
  FAN: 1.5,
  CAGE: 1.6,
  COMBINATION: 1.9,
});

/**
 * [PRD 14] Combo thresholds. `consecutiveClears` at or above the threshold
 * yields the paired multiplier. Ordered ascending.
 */
export const COMBO = frozen({
  /**
   * [PRD] Maximum MVP multiplier is x6. The build directive asks for x10; the
   * PRD wins on precedence and explicitly requires the cap to be configurable,
   * so this single constant raises it.
   */
  MAX_MULTIPLIER: 6,
  THRESHOLDS: Object.freeze([
    Object.freeze({ clears: 0, multiplier: 1 }),
    Object.freeze({ clears: 3, multiplier: 2 }),
    Object.freeze({ clears: 6, multiplier: 3 }),
    Object.freeze({ clears: 10, multiplier: 4 }),
    Object.freeze({ clears: 15, multiplier: 5 }),
    Object.freeze({ clears: 20, multiplier: 6 }),
    Object.freeze({ clears: 26, multiplier: 7 }),
    Object.freeze({ clears: 33, multiplier: 8 }),
    Object.freeze({ clears: 41, multiplier: 9 }),
    Object.freeze({ clears: 50, multiplier: 10 }),
  ]),
});

/** [PRD 15] Near-miss reward per proximity tier, before the combo multiplier. */
export const NEAR_MISS_REWARD: Readonly<Record<NearMissTier, number>> = Object.freeze({
  NONE: 0,
  CLOSE: 250,
  NEAR: 500,
  EXTREME: 1000,
});

/**
 * Survival milestones. Surviving longer multiplies every point earned from
 * then on: obstacle clears, near misses and the survival trickle. It stacks
 * with the combo multiplier. Ordered ascending by `from` (seconds).
 */
export interface SurvivalMilestone {
  readonly from: number;
  readonly multiplier: number;
  /** Announced on the HUD when the milestone is reached. */
  readonly label: string;
}

export const SURVIVAL_MILESTONES: ReadonlyArray<SurvivalMilestone> = Object.freeze([
  Object.freeze({ from: 0, multiplier: 1, label: 'BASE' }),
  Object.freeze({ from: 60, multiplier: 1.5, label: 'SURVIVAL BONUS' }),
  Object.freeze({ from: 120, multiplier: 2, label: 'SURVIVAL BONUS' }),
  Object.freeze({ from: 180, multiplier: 3, label: 'OVERLOAD SURVIVOR' }),
]);

export const HUD_EVENTS = frozen({
  /** [PRD 15 / Design 10] Maximum simultaneous notifications. */
  MAX_VISIBLE: 4,
  /** [PRD 15] Notifications disappear after approximately 1.5 s. */
  LIFETIME_SECONDS: 1.5,
});
