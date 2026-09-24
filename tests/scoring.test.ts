/**
 * Scoring, combo and near-miss maths, including the guarantee that a pooled
 * obstacle cannot score twice.
 */

import { describe, expect, it } from 'vitest';
import { COMBO, NEAR_MISS_REWARD, OBSTACLE_WEIGHTS, SCORE } from '../src/config/ScoreConfig';
import { COLLISION } from '../src/config/GameConfig';
import { comboMultiplier, isComboMilestone } from '../src/game/ComboSystem';
import { nearMissTier } from '../src/game/CollisionSystem';
import {
  createScoreState,
  registerClear,
  registerNearMiss,
  registerSurvival,
  resetScoreState,
} from '../src/game/ScoreSystem';
import { Game, stepsForSeconds } from '../src/game/Game';
import { AutopilotBot, DT, runBot } from './helpers';

describe('combo multiplier', () => {
  it('follows the PRD threshold table', () => {
    const expected: Array<[number, number]> = [
      [0, 1], [1, 1], [2, 1],
      [3, 2], [5, 2],
      [6, 3], [9, 3],
      [10, 4], [14, 4],
      [15, 5], [19, 5],
      [20, 6], [50, 6],
    ];
    for (const [clears, multiplier] of expected) {
      expect(comboMultiplier(clears), `clears=${clears}`).toBe(multiplier);
    }
  });

  it('caps at the configured maximum', () => {
    expect(comboMultiplier(10_000)).toBe(COMBO.MAX_MULTIPLIER);
    // The cap is the only thing standing between the MVP's x6 and a higher cap:
    // the threshold table already reaches x10.
    const uncapped = COMBO.THRESHOLDS[COMBO.THRESHOLDS.length - 1]!.multiplier;
    expect(uncapped).toBe(10);
  });

  it('detects milestone crossings', () => {
    expect(isComboMilestone(2, 3)).toBe(true);
    expect(isComboMilestone(3, 4)).toBe(false);
  });
});

describe('score system', () => {
  it('awards base x weight x the multiplier in force before the pass', () => {
    const state = createScoreState();
    const first = registerClear(state, 'STATIC_GATE');
    expect(first.points).toBe(SCORE.BASE_OBSTACLE * OBSTACLE_WEIGHTS.STATIC_GATE * 1);
    expect(state.score).toBe(first.points);
  });

  it('reproduces the PRD worked example', () => {
    const state = createScoreState();
    // Three passes at x1, then the combo becomes x2 and the fourth pays double.
    expect(registerClear(state, 'STATIC_GATE').points).toBe(100);
    expect(registerClear(state, 'STATIC_GATE').points).toBe(100);
    expect(registerClear(state, 'STATIC_GATE').points).toBe(100);
    expect(state.combo).toBe(2);
    expect(registerClear(state, 'STATIC_GATE').points).toBe(200);
    expect(state.score).toBe(500);
  });

  it('weights harder archetypes more highly', () => {
    const gate = createScoreState();
    const combination = createScoreState();
    registerClear(gate, 'STATIC_GATE');
    registerClear(combination, 'COMBINATION');
    expect(combination.score).toBeGreaterThan(gate.score);
    expect(combination.score).toBe(SCORE.BASE_OBSTACLE * OBSTACLE_WEIGHTS.COMBINATION);
  });

  it('multiplies near misses by the live combo and counts them', () => {
    const state = createScoreState();
    for (let i = 0; i < 3; i += 1) registerClear(state, 'STATIC_GATE');
    expect(state.combo).toBe(2);
    const points = registerNearMiss(state, 'NEAR');
    expect(points).toBe(NEAR_MISS_REWARD.NEAR * 2);
    expect(state.nearMisses).toBe(1);
  });

  it('pays nothing for a NONE tier near miss', () => {
    const state = createScoreState();
    expect(registerNearMiss(state, 'NONE')).toBe(0);
    expect(state.nearMisses).toBe(0);
  });

  it('adds an unmultiplied survival trickle', () => {
    const state = createScoreState();
    for (let i = 0; i < 6; i += 1) registerClear(state, 'STATIC_GATE');
    expect(state.combo).toBe(3);
    const before = state.score;
    registerSurvival(state, 1);
    expect(state.score - before).toBe(SCORE.SURVIVAL_PER_SECOND);
  });

  it('tracks the maximum combo and resets cleanly', () => {
    const state = createScoreState();
    for (let i = 0; i < 21; i += 1) registerClear(state, 'RING');
    expect(state.maxCombo).toBe(6);
    resetScoreState(state);
    expect(state).toEqual(createScoreState());
  });
});

describe('near-miss tiers', () => {
  it('maps distances onto the PRD tiers', () => {
    expect(nearMissTier(-0.1)).toBe('NONE');
    expect(nearMissTier(0)).toBe('EXTREME');
    expect(nearMissTier(COLLISION.NEAR_MISS_EXTREME)).toBe('EXTREME');
    expect(nearMissTier(COLLISION.NEAR_MISS_NEAR)).toBe('NEAR');
    expect(nearMissTier(COLLISION.NEAR_MISS_CLOSE)).toBe('CLOSE');
    expect(nearMissTier(COLLISION.NEAR_MISS_CLOSE + 0.01)).toBe('NONE');
  });
});

describe('no double counting', () => {
  it('scores each obstacle exactly once across a long run', () => {
    const game = new Game({ seed: 31415 });
    game.startRun(31415);
    const bot = new AutopilotBot(31415);
    const scoredIds: number[] = [];

    // Record every clear by watching the world's own event stream.
    const steps = stepsForSeconds(90);
    const input = { up: false, down: false, left: false, right: false };
    for (let i = 0; i < steps && game.phase === 'FLYING'; i += 1) {
      bot.input(game, input);
      game.step(DT, input);
      for (let e = 0; e < game.world.eventCountThisStep; e += 1) {
        const event = game.world.eventAt(e);
        if (event.kind === 'CLEAR') scoredIds.push(event.obstacleId);
      }
    }

    expect(scoredIds.length).toBeGreaterThan(20);
    expect(new Set(scoredIds).size).toBe(scoredIds.length);
    expect(game.score.obstaclesCleared).toBe(scoredIds.length);
  });

  it('never leaves an obstacle in the CLEARED state without consuming it', () => {
    const game = new Game({ seed: 8 });
    game.startRun(8);
    const bot = new AutopilotBot(8);
    runBot(game, bot, 45);
    for (const obstacle of game.world.active) {
      expect(obstacle.state === 'APPROACHING' || obstacle.state === 'CONSUMED').toBe(true);
    }
  });
});
