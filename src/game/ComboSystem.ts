/**
 * VOIDRUSH — combo multiplier.
 *
 * [PRD 14] Tiered thresholds: 0-2 clears give x1, 3-5 give x2, and so on to the
 * configured cap. Near misses do not break the combo, and it does not decay
 * with time — only a collision ends it, and a collision ends the run.
 */

import { COMBO } from '../config/ScoreConfig';

/** The multiplier awarded for `consecutiveClears` successful passes. */
export function comboMultiplier(consecutiveClears: number): number {
  let multiplier = 1;
  for (const threshold of COMBO.THRESHOLDS) {
    if (consecutiveClears >= threshold.clears) multiplier = threshold.multiplier;
  }
  return Math.min(multiplier, COMBO.MAX_MULTIPLIER);
}

/** True when this clear pushes the player into a new multiplier tier. */
export function isComboMilestone(previousClears: number, nextClears: number): boolean {
  return comboMultiplier(nextClears) > comboMultiplier(previousClears);
}
