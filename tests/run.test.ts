/**
 * Whole-run properties: variety, near-miss rate and playability, measured on a
 * single continuous run rather than on isolated components.
 */

import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../src/config/DifficultyConfig';
import { WORLD } from '../src/config/GameConfig';
import { Game, stepsForSeconds } from '../src/game/Game';
import { DifficultyManager } from '../src/game/DifficultyManager';
import type { InputState, ObstacleType } from '../src/types';
import { AutopilotBot, DT } from './helpers';

/** Runs a bot that never crashes, so a full three minutes is observed. */
function surviveRun(seed: number, seconds: number) {
  const game = new Game({ seed });
  game.startRun(seed);
  const bot = new AutopilotBot(seed, 0.15, 0, 0);
  const difficulty = new DifficultyManager();
  const input: InputState = { up: false, down: false, left: false, right: false };

  const typesSeen = new Set<ObstacleType>();
  let midClears = 0;
  let midNearMisses = 0;
  let maxActive = 0;

  const steps = stepsForSeconds(seconds);
  for (let i = 0; i < steps; i += 1) {
    bot.input(game, input);
    game.step(DT, input);
    if (game.phase !== 'FLYING') break;

    for (const obstacle of game.world.active) typesSeen.add(obstacle.type);
    maxActive = Math.max(maxActive, game.world.activeCount);

    const tier = difficulty.tierAt(game.time);
    for (let e = 0; e < game.world.eventCountThisStep; e += 1) {
      const event = game.world.eventAt(e);
      if (event.kind !== 'CLEAR') continue;
      if (tier === 'BUILD' || tier === 'INTENSE') {
        midClears += 1;
        if (event.minSurfaceDistance >= 0 && event.minSurfaceDistance <= 1.5) midNearMisses += 1;
      }
    }
  }

  return { game, typesSeen, midClears, midNearMisses, maxActive };
}

describe('a single three-minute run', () => {
  it('spawns every obstacle archetype', () => {
    const { typesSeen, game } = surviveRun(20260812, 180);
    expect(game.time).toBeGreaterThan(175);

    const expected: ObstacleType[] = [
      'STATIC_GATE',
      'CROSS',
      'RING',
      'BULLSEYE',
      'MOVING_GATE',
      'ROTATING_RING',
      'ROTATING_CROSS',
      'FAN',
      'CAGE',
      'COMBINATION',
    ];
    for (const type of expected) {
      expect(typesSeen.has(type), `${type} never appeared in a 3-minute run`).toBe(true);
    }
  });

  it('is survivable end to end by an autopilot', () => {
    const { game } = surviveRun(4242, 180);
    expect(game.phase).toBe('FLYING');
    expect(game.score.obstaclesCleared).toBeGreaterThan(50);
    expect(game.score.maxCombo).toBeGreaterThan(1);
  });

  it('keeps the active obstacle count inside the cap throughout', () => {
    const { maxActive } = surviveRun(777, 180);
    expect(maxActive).toBeLessThanOrEqual(WORLD.MAX_ACTIVE_OBSTACLES);
  });

  it('holds the near-miss rate inside the 15-35% band at mid difficulty', () => {
    // Averaged across seeds: a single run is a small sample at this rate.
    let clears = 0;
    let nearMisses = 0;
    for (const seed of [11, 2027, 30011, 555, 98765]) {
      const game = new Game({ seed });
      game.startRun(seed);
      // The human-like profile: aims into the gap, not at its exact centre.
      const bot = new AutopilotBot(seed ^ 0x5f3759df, 0.15, 0.25, 0.7);
      const difficulty = new DifficultyManager();
      const input: InputState = { up: false, down: false, left: false, right: false };

      const steps = stepsForSeconds(150);
      for (let i = 0; i < steps; i += 1) {
        bot.input(game, input);
        game.step(DT, input);
        if (game.phase !== 'FLYING') break;
        const tier = difficulty.tierAt(game.time);
        if (tier !== 'BUILD' && tier !== 'INTENSE') continue;
        for (let e = 0; e < game.world.eventCountThisStep; e += 1) {
          const event = game.world.eventAt(e);
          if (event.kind !== 'CLEAR') continue;
          clears += 1;
          if (event.minSurfaceDistance >= 0 && event.minSurfaceDistance <= 1.5) nearMisses += 1;
        }
      }
    }

    expect(clears).toBeGreaterThan(100);
    const rate = nearMisses / clears;
    expect(rate, `near-miss rate ${(rate * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.15);
    expect(rate, `near-miss rate ${(rate * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.35);
  });

  it('holds the simulation step under the 4 ms frame budget at maximum difficulty', () => {
    const game = new Game({ seed: 5150 });
    game.startRun(5150);
    const bot = new AutopilotBot(5150, 0.15, 0, 0);
    const input: InputState = { up: false, down: false, left: false, right: false };

    // Warm up to saturated difficulty first.
    const warmup = stepsForSeconds(DIFFICULTY.RAMP_SECONDS);
    for (let i = 0; i < warmup; i += 1) {
      bot.input(game, input);
      game.step(DT, input);
    }
    expect(game.phase).toBe('FLYING');

    const samples: number[] = [];
    for (let i = 0; i < stepsForSeconds(30); i += 1) {
      bot.input(game, input);
      const start = performance.now();
      game.step(DT, input);
      samples.push(performance.now() - start);
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)]!;
    expect(mean, `mean step ${mean.toFixed(4)} ms`).toBeLessThan(4);
    expect(p99, `p99 step ${p99.toFixed(4)} ms`).toBeLessThan(4);
  });
});
