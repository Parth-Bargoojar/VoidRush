/**
 * VOIDRUSH — lifetime statistics persistence.
 *
 * [TRD] Key `voidrush-stats`, with the exact schema the documents specify.
 * Negative, fractional, missing or wrong-typed values all fall back to zero.
 */

import type { PersistedStats } from '../types';
import { parseJson, readNumber, readRaw, writeRaw } from './Storage';

export const STATS_KEY = 'voidrush-stats';

export const DEFAULT_STATS: Readonly<PersistedStats> = Object.freeze({
  bestScore: 0,
  bestTime: 0,
  bestCombo: 0,
  bestSpeed: 0,
  totalRuns: 0,
  totalObstaclesPassed: 0,
  totalNearMisses: 0,
});

function nonNegative(source: unknown, key: keyof PersistedStats): number {
  const value = readNumber(source, key, 0);
  return value > 0 ? value : 0;
}

export function normaliseStats(input: unknown): PersistedStats {
  return {
    bestScore: Math.floor(nonNegative(input, 'bestScore')),
    bestTime: nonNegative(input, 'bestTime'),
    bestCombo: Math.floor(nonNegative(input, 'bestCombo')),
    bestSpeed: nonNegative(input, 'bestSpeed'),
    totalRuns: Math.floor(nonNegative(input, 'totalRuns')),
    totalObstaclesPassed: Math.floor(nonNegative(input, 'totalObstaclesPassed')),
    totalNearMisses: Math.floor(nonNegative(input, 'totalNearMisses')),
  };
}

export function loadStats(): PersistedStats {
  return normaliseStats(parseJson(readRaw(STATS_KEY)));
}

export function saveStats(stats: PersistedStats): boolean {
  return writeRaw(STATS_KEY, JSON.stringify(normaliseStats(stats)));
}
