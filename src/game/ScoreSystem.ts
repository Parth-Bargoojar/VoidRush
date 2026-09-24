/**
 * VOIDRUSH — scoring.
 *
 * [PRD 13] Base +100 per obstacle, scaled by the archetype's difficulty weight
 * and by the combo multiplier. Near misses pay their tier reward, also
 * multiplied. A small unmultiplied trickle rewards raw survival.
 *
 * The multiplier applied to a pass is the one in force *before* that pass, which
 * is what the PRD's worked example shows: three passes at +100, then x2, then
 * +200.
 *
 * Two different numbers come out of a streak and they must not be confused:
 * the combo the player sees is the streak itself (+1 per cleared obstacle),
 * while the score multiplier steps up in tiers and caps at x6.
 */

import {
  COMBO,
  NEAR_MISS_REWARD,
  OBSTACLE_WEIGHTS,
  SCORE,
  SURVIVAL_MILESTONES,
  type SurvivalMilestone,
} from '../config/ScoreConfig';
import { comboMultiplier } from './ComboSystem';
import type { NearMissTier, ObstacleType, ScoreState } from '../types';

export function createScoreState(): ScoreState {
  return {
    score: 0,
    combo: 1,
    consecutiveClears: 0,
    maxCombo: 0,
    obstaclesCleared: 0,
    nearMisses: 0,
    survivalMultiplier: 1,
  };
}

/** The survival milestone in force after `seconds` of survival. */
export function survivalMilestoneAt(seconds: number): SurvivalMilestone {
  let current = SURVIVAL_MILESTONES[0]!;
  for (const milestone of SURVIVAL_MILESTONES) {
    if (seconds >= milestone.from) current = milestone;
  }
  return current;
}

/**
 * Updates the survival multiplier for the current run time. Returns the new
 * milestone when one has just been reached, otherwise null.
 */
export function updateSurvivalMultiplier(
  state: ScoreState,
  seconds: number,
): SurvivalMilestone | null {
  const milestone = survivalMilestoneAt(seconds);
  if (milestone.multiplier === state.survivalMultiplier) return null;
  state.survivalMultiplier = milestone.multiplier;
  return milestone;
}

export function resetScoreState(state: ScoreState): void {
  state.score = 0;
  state.combo = 1;
  state.consecutiveClears = 0;
  state.maxCombo = 0;
  state.obstaclesCleared = 0;
  state.nearMisses = 0;
  state.survivalMultiplier = 1;
}

export interface ClearAward {
  points: number;
  /** The streak after this clear: the combo shown to the player. */
  combo: number;
  /** True every COMBO.NOTIFY_EVERY clears, for the HUD notification. */
  milestone: boolean;
}

/** Awards a successful obstacle pass and advances the combo. */
export function registerClear(state: ScoreState, type: ObstacleType): ClearAward {
  const multiplier = comboMultiplier(state.consecutiveClears);
  const points = Math.round(
    SCORE.BASE_OBSTACLE * OBSTACLE_WEIGHTS[type] * multiplier * state.survivalMultiplier,
  );

  state.score += points;
  state.obstaclesCleared += 1;
  state.consecutiveClears += 1;

  state.combo = comboMultiplier(state.consecutiveClears);
  const streak = state.consecutiveClears;
  if (streak > state.maxCombo) state.maxCombo = streak;

  return { points, combo: streak, milestone: streak % COMBO.NOTIFY_EVERY === 0 };
}

/** [PRD 15] Awards a near miss. At most one per obstacle; the caller enforces that. */
export function registerNearMiss(state: ScoreState, tier: NearMissTier): number {
  if (tier === 'NONE') return 0;
  const points = Math.round(NEAR_MISS_REWARD[tier] * state.combo * state.survivalMultiplier);
  state.score += points;
  state.nearMisses += 1;
  return points;
}

/** Survival trickle. Not combo-multiplied, but scaled by the survival milestone. */
export function registerSurvival(state: ScoreState, dt: number): void {
  state.score += SCORE.SURVIVAL_PER_SECOND * state.survivalMultiplier * dt;
}
