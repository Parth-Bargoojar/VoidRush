/**
 * O3 — Ring. A voxelised wall with a circular passage through it, rendered as
 * concentric rims so it reads as a ring rather than a punched plate.
 *
 * The wall spans the whole cross-section: a ring that stopped short of the
 * tunnel walls could simply be flown around, which would make the reachability
 * proof meaningless.
 */

import { OBSTACLE } from '../config/GameConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import {
  COVER_SQUARE,
  FRAME_OUTER,
  addGridWithCircularHole,
  addSquareFrame,
  openingLimitInBox,
} from './shapes';

export class Ring extends BaseObstacle {
  readonly type: ObstacleType = 'RING';

  protected build(config: ObstacleSpawnConfig, _rng: RngLike): void {
    const radius = Math.min(config.openingHalf, openingLimitInBox(config.targetX, config.targetY));
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    addGridWithCircularHole(
      this.parts,
      COVER_SQUARE,
      OBSTACLE.CELL,
      config.targetX,
      config.targetY,
      radius,
      OBSTACLE.DEPTH_HALF,
      'primary',
      'accent',
    );
    // The voxel grid covers the reachable box; the frame carries it to the wall.
    addSquareFrame(this.parts, COVER_SQUARE, FRAME_OUTER, OBSTACLE.DEPTH_HALF, 'primary');

    this.openings.push({
      cx: config.targetX,
      cy: config.targetY,
      hx: radius,
      hy: radius,
      shape: 'circle',
      spins: false,
    });
    this.plannedHalf = radius;
  }
}
