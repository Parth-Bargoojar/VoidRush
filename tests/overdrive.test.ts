/**
 * Difficulty past 150 s ("overdrive") and survival milestone scoring.
 *
 * Speed stays capped; rotation and sliding keep rising for as long as the run
 * lasts; every obstacle generated deep into overdrive is still proved
 * passable; and surviving longer multiplies what the player earns.
 */

import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../src/config/DifficultyConfig';
import { MOVEMENT, SPEED } from '../src/config/GameConfig';
import { SURVIVAL_MILESTONES } from '../src/config/ScoreConfig';
import { DifficultyManager, createDifficultyState } from '../src/game/DifficultyManager';
import { Game } from '../src/game/Game';
import {
  createScoreState,
  registerClear,
  registerNearMiss,
  survivalMilestoneAt,
  updateSurvivalMultiplier,
} from '../src/game/ScoreSystem';
import { CombinationObstacle } from '../src/obstacles/CombinationObstacle';
import { validateReachability } from '../src/obstacles/ReachabilityValidator';
import { AutopilotBot, makeGenerator, runBot } from './helpers';

const manager = new DifficultyManager();

describe('difficulty overdrive past 150 s', () => {
  it('is zero through the main ramp and rises for ever after', () => {
    expect(manager.overdriveAt(0)).toBe(0);
    expect(manager.overdriveAt(DIFFICULTY.RAMP_SECONDS)).toBe(0);
    let previous = 0;
    for (let t = DIFFICULTY.RAMP_SECONDS + 1; t <= 3000; t += 1) {
      const value = manager.overdriveAt(t);
      expect(value, `overdrive at ${t}s`).toBeGreaterThan(previous);
      expect(value).toBeLessThan(1);
      previous = value;
    }
  });

  it('keeps forward speed capped while rotation and sliding keep climbing', () => {
    const at150 = manager.stateAt(150, createDifficultyState());
    const at300 = manager.stateAt(300, createDifficultyState());
    const at900 = manager.stateAt(900, createDifficultyState());
    expect(at300.speed).toBe(SPEED.MAX);
    expect(at900.speed).toBe(SPEED.MAX);
    expect(at300.rotationSpeed).toBeGreaterThan(at150.rotationSpeed);
    expect(at900.rotationSpeed).toBeGreaterThan(at300.rotationSpeed);
    expect(at300.oscillationFrequency).toBeGreaterThan(at150.oscillationFrequency);
    expect(at900.oscillationFrequency).toBeGreaterThan(at300.oscillationFrequency);
    // Reaction-bound values stay where the ramp left them.
    expect(at900.openingHalf).toBe(at150.openingHalf);
    expect(at900.spacing).toBe(at150.spacing);
  });

  it('never slides an opening faster than the slowest player setting can chase', () => {
    const slowestPlayer = MOVEMENT.MAX_LATERAL_SPEED * MOVEMENT.SENSITIVITY_MIN;
    for (const t of [150, 300, 1000, 100_000]) {
      const state = manager.stateAt(t, createDifficultyState());
      const peakSlide = state.oscillationAmplitude * Math.PI * 2 * state.oscillationFrequency;
      expect(peakSlide, `peak slide at ${t}s`).toBeLessThan(slowestPlayer);
    }
  });

  it('proves every obstacle passable deep into overdrive', () => {
    let total = 0;
    let deep = 0;
    let fallbacks = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const { generator, factory } = makeGenerator(seed * 31337);
      // Generate until the crossing time is ten minutes in.
      for (let i = 0; i < 20_000; i += 1) {
        const obstacle = generator.generate();
        const proof = validateReachability(obstacle, obstacle.tCross, generator.lastRequest!);
        expect(proof.ok, `seed ${seed} obstacle ${i} at ${obstacle.tCross.toFixed(1)}s`).toBe(
          true,
        );
        if (generator.lastUsedFallback) fallbacks += 1;
        if (obstacle.tCross > 300) deep += 1;
        total += 1;
        const done = obstacle.tCross > 600;
        factory.release(obstacle);
        if (done) break;
      }
    }
    expect(deep).toBeGreaterThan(3000);
    expect(fallbacks / total).toBeLessThan(0.02);
  });
});

describe('planning after a combination', () => {
  it('plans the next obstacle from the last layer, not the combination centre', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20 && checked < 25; seed += 1) {
      const { generator, factory } = makeGenerator(seed * 977);
      let previous: { lastLayerTCross: number } | null = null;
      for (let i = 0; i < 600; i += 1) {
        const obstacle = generator.generate();
        if (previous) {
          // The player leaves a combination at its last layer, which crosses
          // after the combination's centre; that is the time to plan from.
          expect(generator.lastRequest!.prevTCross).toBeCloseTo(previous.lastLayerTCross, 9);
          checked += 1;
          previous = null;
        }
        if (obstacle instanceof CombinationObstacle) {
          const last = obstacle.layers[obstacle.layers.length - 1]!;
          expect(last.tCross).toBeGreaterThan(obstacle.tCross);
          previous = { lastLayerTCross: last.tCross };
        }
        factory.release(obstacle);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(25);
  });
});

describe('survival milestone scoring', () => {
  it('follows the milestone table', () => {
    const expected: Array<[number, number]> = [
      [0, 1], [59.9, 1],
      [60, 1.5], [119.9, 1.5],
      [120, 2], [179.9, 2],
      [180, 3], [10_000, 3],
    ];
    for (const [seconds, multiplier] of expected) {
      expect(survivalMilestoneAt(seconds).multiplier, `at ${seconds}s`).toBe(multiplier);
    }
    expect(survivalMilestoneAt(200).label).toBe('OVERLOAD SURVIVOR');
    expect(SURVIVAL_MILESTONES[0]!.multiplier).toBe(1);
  });

  it('multiplies obstacle clears and near misses on top of the combo', () => {
    const state = createScoreState();
    expect(updateSurvivalMultiplier(state, 61)?.multiplier).toBe(1.5);
    // Reaching the same milestone again is not a new event.
    expect(updateSurvivalMultiplier(state, 62)).toBeNull();
    expect(registerClear(state, 'STATIC_GATE').points).toBe(150);
    expect(registerNearMiss(state, 'NEAR')).toBe(750);

    updateSurvivalMultiplier(state, 181);
    expect(registerClear(state, 'STATIC_GATE').points).toBe(300);
  });

  it('leaves the first minute on the PRD base scoring', () => {
    const state = createScoreState();
    updateSurvivalMultiplier(state, 30);
    expect(state.survivalMultiplier).toBe(1);
    expect(registerClear(state, 'STATIC_GATE').points).toBe(100);
  });

  it('announces each milestone once during a live run and resets on restart', () => {
    const reached: number[] = [];
    const game = new Game({
      seed: 3,
      hooks: { onSurvivalMilestone: (multiplier) => reached.push(multiplier) },
    });
    game.startRun(3);
    // The precise bot comfortably survives past the first two milestones.
    const result = runBot(game, new AutopilotBot(3, 0.05, 0, 0), 130);
    expect(result.crashed).toBe(false);
    expect(reached).toEqual([1.5, 2]);
    expect(game.score.survivalMultiplier).toBe(2);

    game.startRun(4);
    expect(game.score.survivalMultiplier).toBe(1);
  });
});
