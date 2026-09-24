/**
 * O4 — Bullseye. Concentric rings: a solid core, a passable annular band, and a
 * solid outer field. The player threads the band rather than the centre.
 */

import { OBSTACLE } from '../config/GameConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import {
  COVER_SQUARE,
  FRAME_OUTER,
  addGridWithCircularHole,
  addSquareFrame,
  addVoxelBand,
  openingLimitInBox,
} from './shapes';

export class Bullseye extends BaseObstacle {
  readonly type: ObstacleType = 'BULLSEYE';

  protected build(config: ObstacleSpawnConfig, _rng: RngLike): void {
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    const angle = Math.atan2(config.targetY, config.targetX);
    let half = config.openingHalf;
    // The band must clear the solid core, so the opening sits at a minimum radius.
    let radius = Math.max(Math.hypot(config.targetX, config.targetY), half + OBSTACLE.BULLSEYE_CORE);

    let cx = Math.cos(angle) * radius;
    let cy = Math.sin(angle) * radius;
    half = Math.min(half, openingLimitInBox(cx, cy));

    // Re-seat the radius once the opening has been trimmed to fit the box.
    radius = Math.max(radius, half + OBSTACLE.BULLSEYE_CORE);
    cx = Math.cos(angle) * radius;
    cy = Math.sin(angle) * radius;
    half = Math.min(half, openingLimitInBox(cx, cy));

    const inner = radius - half;
    const outer = radius + half;

    addVoxelBand(this.parts, 0, inner, OBSTACLE.CELL, 0, 0, 0, OBSTACLE.DEPTH_HALF, false, 'secondary', 'accent');
    addGridWithCircularHole(
      this.parts,
      COVER_SQUARE,
      OBSTACLE.CELL,
      0,
      0,
      outer,
      OBSTACLE.DEPTH_HALF,
      'primary',
      'accent',
    );
    addSquareFrame(this.parts, COVER_SQUARE, FRAME_OUTER, OBSTACLE.DEPTH_HALF, 'primary');

    this.openings.push({ cx, cy, hx: half, hy: half, shape: 'circle', spins: false });
    this.plannedX = cx;
    this.plannedY = cy;
    this.plannedHalf = half;
  }
}
