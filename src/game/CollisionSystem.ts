/**
 * VOIDRUSH — swept collision and near-miss measurement.
 *
 * At 120 units/s and a 120 Hz step the player advances a full unit relative to
 * an obstacle every step, so a naive per-frame point test can pass straight
 * through thin geometry. Instead, for each step we solve the sub-interval
 * during which the plane z = 0 lies inside the obstacle's Z slab, and sample
 * entry, midpoint and exit — interpolating the player's position and evaluating
 * the obstacle's own transform (rotation and oscillation included) at each
 * sub-time.
 *
 * Combined with the 4-unit minimum part depth, tunnelling is not possible.
 */

import { COLLISION, WORLD } from '../config/GameConfig';
import type { NearMissTier, Player } from '../types';
import type { BaseObstacle } from '../obstacles/Obstacle';

export interface SweepResult {
  collided: boolean;
  /** Smallest surface-to-surface distance seen during this step. */
  minSurfaceDistance: number;
  /** True when the obstacle's slab overlapped the player plane at all. */
  crossed: boolean;
}

const RESULT: SweepResult = { collided: false, minSurfaceDistance: Infinity, crossed: false };

/**
 * Tests one obstacle against the player's movement across a single fixed step.
 *
 * `zPrev` / `zCur` are the obstacle origin's Z at the start and end of the step,
 * `tPrev` / `tCur` the corresponding simulation times.
 */
export function sweepObstacle(
  obstacle: BaseObstacle,
  player: Player,
  zPrev: number,
  zCur: number,
  tPrev: number,
  tCur: number,
): SweepResult {
  RESULT.collided = false;
  RESULT.minSurfaceDistance = Number.POSITIVE_INFINITY;
  RESULT.crossed = false;

  const depth = obstacle.depthHalf;
  const dz = zCur - zPrev;

  // Solve for the sub-interval [a, b] of this step during which |z(u)| <= depth.
  let a: number;
  let b: number;
  if (Math.abs(dz) < 1e-9) {
    if (Math.abs(zPrev) > depth) return RESULT;
    a = 0;
    b = 1;
  } else {
    const u0 = (-depth - zPrev) / dz;
    const u1 = (depth - zPrev) / dz;
    a = Math.max(0, Math.min(u0, u1));
    b = Math.min(1, Math.max(u0, u1));
    if (a > b) return RESULT;
  }

  RESULT.crossed = true;
  const samples = COLLISION.SWEEP_SAMPLES;
  for (let i = 0; i < samples; i += 1) {
    const u = samples === 1 ? a : a + ((b - a) * i) / (samples - 1);
    const px = player.prevX + (player.x - player.prevX) * u;
    const py = player.prevY + (player.y - player.prevY) * u;
    const t = tPrev + (tCur - tPrev) * u;
    const z = zPrev + dz * u;

    const distance = obstacle.distanceToSolid(px, py, 0, t, z);
    const surface = distance - WORLD.PLAYER_RADIUS;
    if (surface < RESULT.minSurfaceDistance) RESULT.minSurfaceDistance = surface;
    if (surface < 0) {
      RESULT.collided = true;
      return RESULT;
    }
  }
  return RESULT;
}

/**
 * [PRD 15] Near-miss tier from the closest approach recorded while crossing.
 * A collision is not a near miss, so negative distances score nothing.
 */
export function nearMissTier(minSurfaceDistance: number): NearMissTier {
  if (minSurfaceDistance < 0) return 'NONE';
  if (minSurfaceDistance <= COLLISION.NEAR_MISS_EXTREME) return 'EXTREME';
  if (minSurfaceDistance <= COLLISION.NEAR_MISS_NEAR) return 'NEAR';
  if (minSurfaceDistance <= COLLISION.NEAR_MISS_CLOSE) return 'CLOSE';
  return 'NONE';
}
