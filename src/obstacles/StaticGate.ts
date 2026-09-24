/**
 * O1 — Static Gate. A slab spanning the cross-section with a rectangular hole.
 * The simplest archetype and the guaranteed-safe fallback shape.
 */

import { OBSTACLE } from '../config/GameConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import { FRAME_OUTER, addSlabWithRectHole, openingLimitInBox } from './shapes';

export class StaticGate extends BaseObstacle {
  readonly type: ObstacleType = 'STATIC_GATE';

  protected build(config: ObstacleSpawnConfig, _rng: RngLike): void {
    const half = Math.min(config.openingHalf, openingLimitInBox(config.targetX, config.targetY));
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    addSlabWithRectHole(
      this.parts,
      config.targetX,
      config.targetY,
      half,
      half,
      // The slab runs out to the widest tunnel wall; it covers the reachable
      // box with room to spare.
      FRAME_OUTER,
      OBSTACLE.DEPTH_HALF,
      'primary',
      'accent',
    );

    this.openings.push({
      cx: config.targetX,
      cy: config.targetY,
      hx: half,
      hy: half,
      shape: 'rect',
      spins: false,
    });
    this.plannedHalf = half;
  }
}
