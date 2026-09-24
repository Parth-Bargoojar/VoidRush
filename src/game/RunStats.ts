/**
 * VOIDRUSH — run statistics and their persistence shape.
 */

import type { PersistedStats, RunStats, ScoreState } from '../types';

export function buildRunStats(
  score: ScoreState,
  timeSeconds: number,
  topSpeed: number,
  bestScore: number,
): RunStats {
  return {
    score: Math.round(score.score),
    timeSeconds,
    maxCombo: score.maxCombo,
    obstaclesCleared: score.obstaclesCleared,
    nearMisses: score.nearMisses,
    topSpeed,
    isNewBest: Math.round(score.score) > bestScore,
  };
}

/** Folds a finished run into the persisted lifetime totals. */
export function mergeStats(previous: PersistedStats, run: RunStats): PersistedStats {
  return {
    bestScore: Math.max(previous.bestScore, run.score),
    bestTime: Math.max(previous.bestTime, run.timeSeconds),
    bestCombo: Math.max(previous.bestCombo, run.maxCombo),
    bestSpeed: Math.max(previous.bestSpeed, run.topSpeed),
    totalRuns: previous.totalRuns + 1,
    totalObstaclesPassed: previous.totalObstaclesPassed + run.obstaclesCleared,
    totalNearMisses: previous.totalNearMisses + run.nearMisses,
  };
}
