/**
 * Combination — two or three archetypes stacked 12-24 units apart in Z whose
 * openings must be *jointly* reachable.
 *
 * Each layer's opening is sampled inside the reach budget of the layer before
 * it, using the same conservative envelope the top-level generator uses. At
 * high speed the layers converge on a single line, which is exactly the
 * intended feel: a corridor you must hold rather than three separate dodges.
 */

import { COMBINATION_MEMBERS } from '../config/DifficultyConfig';
import { GENERATION, MOVEMENT, OBSTACLE } from '../config/GameConfig';
import { clamp } from '../utils/MathUtils';
import type { CollisionVolume, ObstacleSpawnConfig, ObstacleType, Opening, RngLike } from '../types';
import { BaseObstacle, type ObstacleSource, type RenderBody } from './Obstacle';
import { OPENING_BOUND } from './shapes';

export interface CombinationLayer {
  obstacle: BaseObstacle;
  /** Offset along Z from the combination origin. Positive is nearer the player. */
  zOffset: number;
  /** Absolute simulation time at which this layer reaches z = 0. */
  tCross: number;
}

export class CombinationObstacle extends BaseObstacle {
  readonly type: ObstacleType = 'COMBINATION';

  readonly layers: CombinationLayer[] = [];
  private readonly source: ObstacleSource;
  private readonly scratch: CollisionVolume[] = [];

  constructor(source: ObstacleSource) {
    super();
    this.source = source;
  }

  protected build(config: ObstacleSpawnConfig, rng: RngLike): void {
    const count = rng.int(OBSTACLE.COMBINATION_LAYERS_MIN, OBSTACLE.COMBINATION_LAYERS_MAX + 1);

    // Lay the gaps out symmetrically so the body's z-slab is centred on `z`.
    const gaps: number[] = [];
    for (let i = 0; i < count - 1; i += 1) {
      gaps.push(rng.range(OBSTACLE.COMBINATION_GAP_MIN, OBSTACLE.COMBINATION_GAP_MAX));
    }
    const span = gaps.reduce((a, b) => a + b, 0);
    this.setDepthHalf(span / 2 + OBSTACLE.CAGE_DEPTH_HALF);

    let offset = span / 2;
    let targetX = config.targetX;
    let targetY = config.targetY;

    for (let i = 0; i < count; i += 1) {
      const tCross = config.tCross - offset / Math.max(config.speed, 1);
      const type = rng.pick(COMBINATION_MEMBERS);
      const obstacle = this.source.acquire(type);

      obstacle.spawn(
        {
          id: config.id * OBSTACLE.COMBINATION_ID_STRIDE + i,
          z: 0,
          tCross,
          targetX,
          targetY,
          openingHalf: config.openingHalf,
          difficulty: config.difficulty,
          overdrive: config.overdrive ?? 0,
          speed: config.speed,
        },
        rng,
      );

      this.layers.push({ obstacle, zOffset: offset, tCross });

      // Walk the target to the next layer inside that layer's reach budget.
      const gap = gaps[i];
      if (gap !== undefined) {
        const travel = gap / Math.max(config.speed, 1);
        const reach =
          MOVEMENT.MAX_LATERAL_SPEED *
          Math.max(0, travel - GENERATION.REACH_TAU_CHARGE * MOVEMENT.TAU) *
          GENERATION.REACH_SAFETY;
        const bound = OPENING_BOUND - config.openingHalf;
        targetX = clamp(targetX + rng.range(-reach, reach), -bound, bound);
        targetY = clamp(targetY + rng.range(-reach, reach), -bound, bound);
        offset -= gap;
      }
    }

    // The next obstacle chains from where the player exits this one.
    const last = this.layers[this.layers.length - 1];
    if (last) {
      this.plannedX = last.obstacle.plannedX;
      this.plannedY = last.obstacle.plannedY;
      this.plannedHalf = last.obstacle.plannedHalf;
    }
  }

  override reset(): void {
    for (const layer of this.layers) {
      this.source.release(layer.obstacle);
    }
    this.layers.length = 0;
    super.reset();
  }

  override getSolidVolumes(out: CollisionVolume[], time: number, zAt?: number): number {
    const baseZ = zAt ?? this.z;
    let written = 0;
    for (const layer of this.layers) {
      const count = layer.obstacle.getSolidVolumes(this.scratch, time, baseZ + layer.zOffset);
      for (let i = 0; i < count; i += 1) {
        const src = this.scratch[i]!;
        let slot = out[written];
        if (slot === undefined) {
          slot = { cx: 0, cy: 0, cz: 0, hx: 0, hy: 0, hz: 0, rot: 0 };
          out[written] = slot;
        }
        slot.cx = src.cx;
        slot.cy = src.cy;
        slot.cz = src.cz;
        slot.hx = src.hx;
        slot.hy = src.hy;
        slot.hz = src.hz;
        slot.rot = src.rot;
        written += 1;
      }
    }
    return written;
  }

  /** The opening of the layer the player meets first. */
  override getOpenings(t: number): Opening[] {
    const first = this.layers[0];
    return first ? first.obstacle.getOpenings(t) : [];
  }

  override get partCount(): number {
    let total = 0;
    for (const layer of this.layers) total += layer.obstacle.partCount;
    return total;
  }

  /** Each layer spins and slides on its own, so each is its own render body. */
  override renderBodies(out: RenderBody[]): number {
    for (let i = 0; i < this.layers.length; i += 1) {
      const layer = this.layers[i]!;
      let slot = out[i];
      if (slot === undefined) {
        slot = { source: layer.obstacle, zOffset: layer.zOffset };
        out[i] = slot;
      } else {
        slot.source = layer.obstacle;
        slot.zOffset = layer.zOffset;
      }
    }
    return this.layers.length;
  }
}
