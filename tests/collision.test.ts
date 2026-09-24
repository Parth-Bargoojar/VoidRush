/**
 * Swept collision. The headline case is the tunnelling test: at maximum speed
 * a solid wall must stop the player from every starting position.
 */

import { describe, expect, it } from 'vitest';
import { SPEED, TIMING, WORLD } from '../src/config/GameConfig';
import { sweepObstacle } from '../src/game/CollisionSystem';
import { createPlayer } from '../src/game/Player';
import { StaticGate } from '../src/obstacles/StaticGate';
import { Ring } from '../src/obstacles/Ring';
import { Rng } from '../src/utils/Random';
import type { Player } from '../src/types';

/** A gate with no opening at all: a solid wall across the cross-section. */
function solidWall(): StaticGate {
  const gate = new StaticGate();
  gate.spawn(
    {
      id: 1,
      z: 0,
      tCross: 0,
      targetX: 0,
      targetY: 0,
      openingHalf: 0,
      difficulty: 0,
      speed: SPEED.MAX,
    },
    new Rng(1),
  );
  return gate;
}

/** Flies `player` through the obstacle at `speed`, returning true on impact. */
function flyThrough(obstacle: StaticGate | Ring, player: Player, speed: number): boolean {
  const dt = TIMING.FIXED_DT;
  const step = speed * dt;
  // Start well before the body and run past it.
  for (let z = WORLD.SPAWN_Z; z < WORLD.DESPAWN_Z; z += step) {
    const result = sweepObstacle(obstacle, player, z, z + step, 0, dt);
    if (result.collided) return true;
  }
  return false;
}

describe('swept collision', () => {
  it('registers 200 out of 200 impacts on a solid wall at maximum speed', () => {
    const wall = solidWall();
    const rng = new Rng(20260812);
    let hits = 0;

    for (let i = 0; i < 200; i += 1) {
      const player = createPlayer();
      const x = rng.range(-WORLD.PLAYER_CLAMP, WORLD.PLAYER_CLAMP);
      const y = rng.range(-WORLD.PLAYER_CLAMP, WORLD.PLAYER_CLAMP);
      player.x = x;
      player.y = y;
      player.prevX = x;
      player.prevY = y;
      if (flyThrough(wall, player, SPEED.MAX)) hits += 1;
    }

    expect(hits).toBe(200);
  });

  it('still stops the player when the step is deliberately oversized', () => {
    const wall = solidWall();
    const player = createPlayer();
    // A single step that jumps the entire body: the slab solve must still find
    // the crossing rather than stepping over it.
    const result = sweepObstacle(wall, player, -60, 60, 0, TIMING.FIXED_DT);
    expect(result.crossed).toBe(true);
    expect(result.collided).toBe(true);
  });

  it('lets the player through a real opening', () => {
    const gate = new StaticGate();
    gate.spawn(
      {
        id: 2,
        z: 0,
        tCross: 0,
        targetX: 3,
        targetY: -2,
        openingHalf: 4,
        difficulty: 0,
        speed: SPEED.MAX,
      },
      new Rng(2),
    );
    const player = createPlayer();
    player.x = 3;
    player.y = -2;
    player.prevX = 3;
    player.prevY = -2;
    expect(flyThrough(gate, player, SPEED.MAX)).toBe(false);
  });

  it('reports the closest approach while crossing', () => {
    const gate = new StaticGate();
    gate.spawn(
      {
        id: 3,
        z: 0,
        tCross: 0,
        targetX: 0,
        targetY: 0,
        openingHalf: 3,
        difficulty: 0,
        speed: SPEED.MAX,
      },
      new Rng(3),
    );
    const player = createPlayer();
    // Two units off-centre in a 3-unit half opening leaves one unit of gap,
    // of which the player's own radius consumes 0.6.
    player.x = 2;
    player.prevX = 2;
    const result = sweepObstacle(gate, player, -1, 1, 0, TIMING.FIXED_DT);
    expect(result.crossed).toBe(true);
    expect(result.collided).toBe(false);
    expect(result.minSurfaceDistance).toBeCloseTo(1 - WORLD.PLAYER_RADIUS, 5);
  });

  it('treats an opening edge closer than the player radius as an impact', () => {
    const gate = new StaticGate();
    gate.spawn(
      {
        id: 5,
        z: 0,
        tCross: 0,
        targetX: 0,
        targetY: 0,
        openingHalf: 3,
        difficulty: 0,
        speed: SPEED.MAX,
      },
      new Rng(5),
    );
    const player = createPlayer();
    // 2.5 units off-centre leaves 0.5 units, less than the 0.6 radius.
    player.x = 2.5;
    player.prevX = 2.5;
    expect(sweepObstacle(gate, player, -1, 1, 0, TIMING.FIXED_DT).collided).toBe(true);
  });

  it('ignores obstacles whose slab does not reach the player plane', () => {
    const wall = solidWall();
    const player = createPlayer();
    const result = sweepObstacle(wall, player, -200, -190, 0, TIMING.FIXED_DT);
    expect(result.crossed).toBe(false);
    expect(result.collided).toBe(false);
  });

  it('catches a ring wall at maximum speed from outside its hole', () => {
    const ring = new Ring();
    ring.spawn(
      {
        id: 4,
        z: 0,
        tCross: 0,
        targetX: 0,
        targetY: 0,
        openingHalf: 2.6,
        difficulty: 1,
        speed: SPEED.MAX,
      },
      new Rng(4),
    );
    const rng = new Rng(55);
    let hits = 0;
    let attempts = 0;
    for (let i = 0; i < 200; i += 1) {
      const player = createPlayer();
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(6, WORLD.PLAYER_CLAMP);
      player.x = Math.cos(angle) * radius;
      player.y = Math.sin(angle) * radius;
      player.prevX = player.x;
      player.prevY = player.y;
      if (Math.abs(player.x) > WORLD.PLAYER_CLAMP || Math.abs(player.y) > WORLD.PLAYER_CLAMP) {
        continue;
      }
      attempts += 1;
      if (flyThrough(ring, player, SPEED.MAX)) hits += 1;
    }
    expect(attempts).toBeGreaterThan(100);
    expect(hits).toBe(attempts);
  });
});

describe('minimum part depth', () => {
  it('never emits a solid thinner than the collision-safety floor', () => {
    const gate = solidWall();
    for (const part of gate.parts) {
      expect(part.hz * 2).toBeGreaterThanOrEqual(WORLD.MIN_PART_DEPTH);
    }
  });
});
