/**
 * Pause behaviour, pooling, tunnel continuity and obstacle geometry integrity.
 */

import { describe, expect, it } from 'vitest';
import { OBSTACLE, SPEED, WORLD } from '../src/config/GameConfig';
import { Game, stepsForSeconds } from '../src/game/Game';
import { stepPlayer, createPlayer, effectiveLateralSpeed } from '../src/game/Player';
import { MOVEMENT } from '../src/config/GameConfig';
import { CombinationObstacle } from '../src/obstacles/CombinationObstacle';
import { ALL_OBSTACLE_TYPES, ObstacleFactory } from '../src/obstacles/ObstacleFactory';
import { COVER_DISC, COVER_SQUARE } from '../src/obstacles/shapes';
import { blockSeparation, generateSegmentPattern, hashPattern } from '../src/world/TunnelGenerator';
import { Tunnel } from '../src/world/Tunnel';
import { Rng } from '../src/utils/Random';
import type { CollisionVolume, InputState } from '../src/types';
import { AutopilotBot, DT, makeGenerator, runBot } from './helpers';

describe('pause', () => {
  it('changes nothing while the engine is not stepped', () => {
    const game = new Game({ seed: 11 });
    game.startRun(11);
    const bot = new AutopilotBot(11);
    runBot(game, bot, 8);

    const before = game.snapshot();
    const zPositions = game.world.active.map((o) => o.z);
    const score = game.score.score;

    // Pausing is implemented by not stepping — the loop's `shouldStep` gate is
    // the only thing that advances the world — so the state must be inert while
    // no step is issued, however much wall-clock time passes.
    expect(game.snapshot()).toBe(before);
    expect(game.world.active.map((o) => o.z)).toEqual(zPositions);
    expect(game.score.score).toBe(score);

    // And one step later it is not inert, which proves the check has teeth.
    game.step(DT, { up: false, down: false, left: false, right: false });
    expect(game.snapshot()).not.toBe(before);
  });

  it('resumes from exactly where it left off', () => {
    const input: InputState = { up: false, down: false, left: false, right: false };
    const a = new Game({ seed: 5 });
    a.startRun(5);
    const b = new Game({ seed: 5 });
    b.startRun(5);

    for (let i = 0; i < 400; i += 1) a.step(DT, input);
    // b takes the same number of steps, with an arbitrary "pause" in the middle.
    for (let i = 0; i < 200; i += 1) b.step(DT, input);
    for (let i = 0; i < 200; i += 1) b.step(DT, input);

    expect(b.snapshot()).toBe(a.snapshot());
  });

  it('freezes the simulation during the impact sequence', () => {
    const game = new Game({ seed: 3 });
    game.startRun(3);
    const input: InputState = { up: false, down: false, left: false, right: false };
    // Fly straight until something is hit.
    let guard = 0;
    while (game.phase === 'FLYING' && guard < stepsForSeconds(120)) {
      game.step(DT, input);
      guard += 1;
    }
    expect(game.phase).toBe('IMPACT');

    const frozenZ = game.world.active.map((o) => o.z);
    const frozenScore = game.score.score;
    const frozenTime = game.time;
    game.step(DT, input);
    game.step(DT, input);

    expect(game.world.active.map((o) => o.z)).toEqual(frozenZ);
    expect(game.score.score).toBe(frozenScore);
    expect(game.time).toBe(frozenTime);
  });

  it('leaves the impact sequence for the results screen after the PRD window', () => {
    const game = new Game({ seed: 3 });
    let ended = false;
    game.setHooks({ onRunEnded: () => (ended = true) });
    game.startRun(3);
    const input: InputState = { up: false, down: false, left: false, right: false };
    let guard = 0;
    while (game.phase === 'FLYING' && guard < stepsForSeconds(120)) {
      game.step(DT, input);
      guard += 1;
    }
    for (let i = 0; i < stepsForSeconds(1.2); i += 1) game.step(DT, input);
    expect(ended).toBe(true);
    expect(game.phase).toBe('ENDED');
  });
});

describe('object pooling', () => {
  it('keeps obstacle and segment counts bounded over a long run', () => {
    const game = new Game({ seed: 909 });
    game.startRun(909);
    const bot = new AutopilotBot(909, 0.15, 0, 0);
    const result = runBot(game, bot, 240, { restartOnCrash: true });

    expect(result.maxActive).toBeLessThanOrEqual(WORLD.MAX_ACTIVE_OBSTACLES);
    expect(game.world.tunnel.segmentCount).toBe(WORLD.SEGMENT_COUNT);
    // Instances are bounded by live obstacles plus combination sub-layers.
    const bound =
      WORLD.MAX_ACTIVE_OBSTACLES * (1 + OBSTACLE.COMBINATION_LAYERS_MAX) +
      OBSTACLE.COMBINATION_LAYERS_MAX +
      2;
    expect(game.factory.createdCount).toBeLessThanOrEqual(bound);
  });

  it('recycles obstacles rather than allocating new ones', () => {
    const { generator, factory } = makeGenerator(77);
    for (let i = 0; i < 300; i += 1) {
      factory.release(generator.generate());
    }
    // Released immediately each time, so a handful of instances suffice.
    expect(factory.createdCount).toBeLessThan(20);
  });

  it('resets an obstacle completely when it returns to the pool', () => {
    const factory = new ObstacleFactory();
    const obstacle = factory.acquire('MOVING_GATE');
    obstacle.spawn(
      {
        id: 42,
        z: -100,
        tCross: 5,
        targetX: 2,
        targetY: 3,
        openingHalf: 4,
        difficulty: 0.5,
        speed: 60,
      },
      new Rng(1),
    );
    expect(obstacle.parts.length).toBeGreaterThan(0);
    factory.release(obstacle);
    expect(obstacle.parts.length).toBe(0);
    expect(obstacle.openings.length).toBe(0);
    expect(obstacle.id).toBe(0);
    expect(obstacle.state).toBe('IDLE');
    expect(obstacle.oscAmplitude).toBe(0);
  });

  it('returns combination sub-layers to the pool', () => {
    const factory = new ObstacleFactory();
    const combination = factory.acquire('COMBINATION') as CombinationObstacle;
    combination.spawn(
      {
        id: 1,
        z: -200,
        tCross: 80,
        targetX: 0,
        targetY: 0,
        openingHalf: 3,
        difficulty: 0.6,
        speed: 90,
      },
      new Rng(9),
    );
    expect(combination.layers.length).toBeGreaterThanOrEqual(OBSTACLE.COMBINATION_LAYERS_MIN);
    const before = factory.createdCount;
    factory.release(combination);
    expect(combination.layers.length).toBe(0);
    // Releasing then rebuilding reuses the same sub-layer instances.
    const again = factory.acquire('COMBINATION') as CombinationObstacle;
    again.spawn(
      {
        id: 2,
        z: -200,
        tCross: 80,
        targetX: 0,
        targetY: 0,
        openingHalf: 3,
        difficulty: 0.6,
        speed: 90,
      },
      new Rng(9),
    );
    expect(factory.createdCount).toBe(before);
  });
});

describe('tunnel', () => {
  it('holds a fixed segment count and recycles rather than allocating', () => {
    const tunnel = new Tunnel();
    tunnel.reset(1234);
    expect(tunnel.segmentCount).toBe(WORLD.SEGMENT_COUNT);
    for (let distance = 0; distance < 20_000; distance += 20) {
      tunnel.update(distance);
      expect(tunnel.segmentCount).toBe(WORLD.SEGMENT_COUNT);
    }
    expect(tunnel.recycleCount).toBeGreaterThan(400);
  });

  it('always covers the span between the spawn plane and the despawn plane', () => {
    const tunnel = new Tunnel();
    tunnel.reset(99);
    for (let distance = 0; distance < 5000; distance += 7) {
      tunnel.update(distance);
      let nearest = -Infinity;
      let farthest = Infinity;
      for (const segment of tunnel.segments) {
        nearest = Math.max(nearest, segment.zAt(distance));
        farthest = Math.min(farthest, segment.zAt(distance) - WORLD.SEGMENT_LENGTH);
      }
      expect(nearest).toBeGreaterThanOrEqual(WORLD.DESPAWN_Z);
      expect(farthest).toBeLessThanOrEqual(WORLD.SPAWN_Z);
    }
  });

  it('does not repeat its pattern within three minutes at maximum speed', () => {
    // Three minutes at top speed, expressed in segments.
    const distance = SPEED.MAX * 180;
    const segments = Math.ceil(distance / WORLD.SEGMENT_LENGTH);
    const hashes = new Set<number>();
    const pattern: ReturnType<typeof generateSegmentPattern> = [];
    for (let i = 0; i < segments; i += 1) {
      generateSegmentPattern(4242, i, pattern);
      hashes.add(hashPattern(pattern));
    }
    expect(segments).toBeGreaterThan(400);
    expect(hashes.size).toBe(segments);
  });

  it('builds blocks that stay clear of the player clamp box', () => {
    const pattern: ReturnType<typeof generateSegmentPattern> = [];
    // Early, mid-run and late segments: rectangular, then rolled and chamfered.
    for (const index of [3, 60, 400]) {
      generateSegmentPattern(7, index, pattern);
      expect(pattern.length).toBeGreaterThan(0);
      for (const block of pattern) {
        // A block may protrude inward, but never into the player's reachable
        // box. Separating-axis distance, so rotated blocks are judged by their
        // true footprint. tests/tunnel.test.ts sweeps many more seeds.
        expect(blockSeparation(block, WORLD.PLAYER_CLAMP + WORLD.PLAYER_RADIUS)).toBeGreaterThanOrEqual(
          -1e-6,
        );
      }
    }
  });
});

describe('obstacle geometry integrity', () => {
  it('emits a collision volume for every solid part, and nothing else', () => {
    const factory = new ObstacleFactory();
    const out: CollisionVolume[] = [];
    for (const type of ALL_OBSTACLE_TYPES) {
      const obstacle = factory.acquire(type);
      obstacle.spawn(
        {
          id: 1,
          z: 0,
          tCross: 30,
          targetX: 2.5,
          targetY: -1.5,
          openingHalf: 3.2,
          difficulty: 0.7,
          speed: 90,
        },
        new Rng(20260812),
      );
      const count = obstacle.getSolidVolumes(out, 30, 0);
      // The renderer is driven from exactly this list, so a mesh without a
      // volume, or a volume without a mesh, cannot exist.
      expect(count, `${type} volume count`).toBe(obstacle.partCount);
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i += 1) {
        const volume = out[i]!;
        expect(volume.hx).toBeGreaterThan(0);
        expect(volume.hy).toBeGreaterThan(0);
        expect(volume.hz * 2).toBeGreaterThanOrEqual(WORLD.MIN_PART_DEPTH - 1e-9);
        expect(Number.isFinite(volume.cx)).toBe(true);
        expect(Number.isFinite(volume.cy)).toBe(true);
        expect(Number.isFinite(volume.cz)).toBe(true);
      }
      factory.release(obstacle);
    }
  });

  it('covers the whole reachable cross-section for every archetype', () => {
    const factory = new ObstacleFactory();
    for (const type of ALL_OBSTACLE_TYPES) {
      const obstacle = factory.acquire(type);
      obstacle.spawn(
        {
          id: 1,
          z: 0,
          tCross: 40,
          targetX: 0,
          targetY: 0,
          openingHalf: 2.6,
          difficulty: 1,
          speed: SPEED.MAX,
        },
        new Rng(31),
      );

      // Every part must sit inside the coverage envelope the archetype claims.
      const limit = obstacle.parts.some((p) => p.spins) ? COVER_DISC + 2 : COVER_SQUARE + 12;
      for (const part of obstacle.parts) {
        expect(Math.hypot(part.ox, part.oy), `${type} part out of envelope`).toBeLessThanOrEqual(
          limit * Math.SQRT2 + 1,
        );
      }
      factory.release(obstacle);
    }
  });

  it('exposes at least one opening for every archetype', () => {
    const factory = new ObstacleFactory();
    for (const type of ALL_OBSTACLE_TYPES) {
      const obstacle = factory.acquire(type);
      obstacle.spawn(
        {
          id: 1,
          z: 0,
          tCross: 25,
          targetX: 1,
          targetY: 1,
          openingHalf: 4,
          difficulty: 0.3,
          speed: 60,
        },
        new Rng(5),
      );
      const openings = obstacle.getOpenings(25);
      expect(openings.length, `${type} has no openings`).toBeGreaterThan(0);
      expect(openings[0]!.hx).toBeGreaterThan(WORLD.PLAYER_RADIUS);
      factory.release(obstacle);
    }
  });

  it('moves obstacles as a pure function of simulation time', () => {
    const factory = new ObstacleFactory();
    const obstacle = factory.acquire('ROTATING_RING');
    obstacle.spawn(
      {
        id: 1,
        z: 0,
        tCross: 50,
        targetX: 4,
        targetY: 2,
        openingHalf: 3,
        difficulty: 0.8,
        speed: 100,
      },
      new Rng(6),
    );
    // Asked twice for the same instant, it answers identically; asked for a
    // different instant, it has moved.
    const a = obstacle.getOpenings(50);
    const b = obstacle.getOpenings(50);
    const later = obstacle.getOpenings(50.5);
    expect(a).toEqual(b);
    expect(later[0]!.cx).not.toBeCloseTo(a[0]!.cx, 6);
    factory.release(obstacle);
  });

  it('places a rotating opening on its target at the crossing time', () => {
    const factory = new ObstacleFactory();
    for (const type of ['ROTATING_RING', 'ROTATING_CROSS', 'FAN'] as const) {
      const obstacle = factory.acquire(type);
      obstacle.spawn(
        {
          id: 1,
          z: 0,
          tCross: 77.5,
          targetX: 3,
          targetY: -4,
          openingHalf: 3,
          difficulty: 0.5,
          speed: 90,
        },
        new Rng(12),
      );
      const opening = obstacle.getOpenings(77.5)[0]!;
      // The archetype may push the opening out to a workable radius, but its
      // bearing must be the one the generator asked for.
      const wantAngle = Math.atan2(-4, 3);
      const gotAngle = Math.atan2(opening.cy, opening.cx);
      expect(Math.abs(Math.atan2(Math.sin(gotAngle - wantAngle), Math.cos(gotAngle - wantAngle))))
        .toBeLessThan(1e-6);
      factory.release(obstacle);
    }
  });
});

describe('player movement', () => {
  it('responds smoothly without teleporting', () => {
    const player = createPlayer();
    const input: InputState = { up: false, down: false, left: false, right: true };
    stepPlayer(player, input, DT, 1);
    expect(player.x).toBeGreaterThan(0);
    expect(player.x).toBeLessThan(MOVEMENT.MAX_LATERAL_SPEED * DT);
  });

  it('normalises diagonal movement', () => {
    const straight = createPlayer();
    const diagonal = createPlayer();
    for (let i = 0; i < 200; i += 1) {
      stepPlayer(straight, { up: false, down: false, left: false, right: true }, DT, 1);
      stepPlayer(diagonal, { up: true, down: false, left: false, right: true }, DT, 1);
    }
    const straightSpeed = Math.hypot(straight.vx, straight.vy);
    const diagonalSpeed = Math.hypot(diagonal.vx, diagonal.vy);
    expect(diagonalSpeed).toBeLessThanOrEqual(straightSpeed + 1e-9);
  });

  it('clamps to the boundary and zeroes velocity there', () => {
    const player = createPlayer();
    for (let i = 0; i < 2000; i += 1) {
      stepPlayer(player, { up: true, down: false, left: false, right: true }, DT, 1);
    }
    expect(player.x).toBeCloseTo(WORLD.PLAYER_CLAMP, 6);
    expect(player.y).toBeCloseTo(WORLD.PLAYER_CLAMP, 6);
    expect(player.vx).toBe(0);
    expect(player.vy).toBe(0);
  });

  it('scales top speed by the sensitivity setting, within limits', () => {
    expect(effectiveLateralSpeed(1)).toBe(MOVEMENT.MAX_LATERAL_SPEED);
    expect(effectiveLateralSpeed(10)).toBe(
      MOVEMENT.MAX_LATERAL_SPEED * MOVEMENT.SENSITIVITY_MAX,
    );
    expect(effectiveLateralSpeed(0)).toBe(MOVEMENT.MAX_LATERAL_SPEED * MOVEMENT.SENSITIVITY_MIN);
  });

  it('carries a mid-run sensitivity change into the generator', () => {
    // Otherwise the generator would keep planning against a reach the player no
    // longer has, and could commit an obstacle they cannot get to.
    const game = new Game({ seed: 1, sensitivity: 1 });
    game.startRun(1);
    expect(game.world.generator.currentLateralSpeed).toBe(MOVEMENT.MAX_LATERAL_SPEED);

    game.setSensitivity(MOVEMENT.SENSITIVITY_MIN);
    expect(game.world.generator.currentLateralSpeed).toBe(
      MOVEMENT.MAX_LATERAL_SPEED * MOVEMENT.SENSITIVITY_MIN,
    );
  });

  it('records the previous position for the swept collision test', () => {
    const player = createPlayer();
    stepPlayer(player, { up: false, down: false, left: false, right: true }, DT, 1);
    const first = player.x;
    stepPlayer(player, { up: false, down: false, left: false, right: true }, DT, 1);
    expect(player.prevX).toBe(first);
  });
});
