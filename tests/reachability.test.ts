/**
 * The fairness guarantee: every obstacle the generator commits must be
 * provably passable, and the safe fallback must almost never be needed.
 */

import { describe, expect, it } from 'vitest';
import { GENERATION, MOVEMENT, WORLD } from '../src/config/GameConfig';
import { DifficultyManager } from '../src/game/DifficultyManager';
import { validateReachability } from '../src/obstacles/ReachabilityValidator';
import { OPENING_BOUND } from '../src/obstacles/shapes';
import type { ObstacleType } from '../src/types';
import { makeGenerator } from './helpers';

const SEEDS = 50;
const PER_SEED = 400;

describe('reachability validator', () => {
  it('proves every committed obstacle passable across 20,000 obstacles and 50 seeds', () => {
    let total = 0;
    let fallbacks = 0;
    let unreachable = 0;
    const typeCounts = new Map<ObstacleType, number>();
    const fallbacksByTier = new Map<string, { count: number; total: number }>();
    const difficulty = new DifficultyManager();

    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const { generator, factory } = makeGenerator(seed * 7919);

      for (let i = 0; i < PER_SEED; i += 1) {
        const obstacle = generator.generate();
        const request = generator.lastRequest;
        expect(request).not.toBeNull();

        // Re-run the proof independently rather than trusting the generator.
        const proof = validateReachability(obstacle, obstacle.tCross, request!);
        if (!proof.ok) unreachable += 1;

        const tier = difficulty.tierAt(obstacle.tCross);
        const bucket = fallbacksByTier.get(tier) ?? { count: 0, total: 0 };
        bucket.total += 1;
        if (generator.lastUsedFallback) {
          bucket.count += 1;
          fallbacks += 1;
        }
        fallbacksByTier.set(tier, bucket);

        typeCounts.set(obstacle.type, (typeCounts.get(obstacle.type) ?? 0) + 1);
        total += 1;
        factory.release(obstacle);
      }
    }

    expect(total).toBe(SEEDS * PER_SEED);
    expect(unreachable).toBe(0);
    // Fallback rate under 2% overall and at every difficulty tier.
    expect(fallbacks / total).toBeLessThan(0.02);
    for (const [tier, bucket] of fallbacksByTier) {
      expect(
        bucket.count / bucket.total,
        `fallback rate too high in ${tier}: ${bucket.count}/${bucket.total}`,
      ).toBeLessThan(0.02);
    }

    // Every archetype must actually appear over a sweep this size.
    for (const type of [
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
    ] as ObstacleType[]) {
      expect(typeCounts.get(type) ?? 0, `${type} never generated`).toBeGreaterThan(0);
    }
  });

  it('keeps every opening inside the clamp box, inset by the player radius plus margin', () => {
    const { generator, factory } = makeGenerator(4242);
    for (let i = 0; i < 600; i += 1) {
      const obstacle = generator.generate();
      const proof = validateReachability(obstacle, obstacle.tCross, generator.lastRequest!);
      expect(proof.ok).toBe(true);
      expect(Math.abs(proof.exitX) + proof.exitHalf).toBeLessThanOrEqual(OPENING_BOUND + 1e-6);
      expect(Math.abs(proof.exitY) + proof.exitHalf).toBeLessThanOrEqual(OPENING_BOUND + 1e-6);
      expect(proof.exitHalf).toBeGreaterThanOrEqual(WORLD.PLAYER_RADIUS);
      factory.release(obstacle);
    }
  });

  it('rejects an opening that sits outside the reach envelope', () => {
    const { generator, factory } = makeGenerator(99);
    const obstacle = generator.generate();
    const request = generator.lastRequest!;

    // Same obstacle, but claim the player started from the far corner with no
    // time to cross: the proof must fail.
    const impossible = {
      ...request,
      prevX: -OPENING_BOUND,
      prevY: -OPENING_BOUND,
      prevTCross: obstacle.tCross - 0.001,
    };
    expect(validateReachability(obstacle, obstacle.tCross, impossible).ok).toBe(false);
    factory.release(obstacle);
  });

  it('charges the player two time constants before crediting any travel', () => {
    const { generator, factory } = makeGenerator(7);
    const obstacle = generator.generate();
    const request = generator.lastRequest!;
    const zeroTravel = {
      ...request,
      prevTCross: obstacle.tCross - GENERATION.REACH_TAU_CHARGE * MOVEMENT.TAU,
      prevX: OPENING_BOUND,
      prevY: OPENING_BOUND,
    };
    // With exactly the charge-time available the budget is zero, so an opening
    // anywhere other than the start point is unreachable.
    expect(validateReachability(obstacle, obstacle.tCross, zeroTravel).ok).toBe(false);
    factory.release(obstacle);
  });
});
