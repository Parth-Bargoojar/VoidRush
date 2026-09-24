/**
 * O — Rotating Ring. A spinning disc with an off-centre circular hole, so the
 * passage orbits the tunnel axis.
 *
 * The body is a disc rather than a square: a square body would expose its
 * corners as it turned, leaving an unplanned way through.
 */

import { rotationSpeedFor } from '../config/DifficultyConfig';
import { GENERATION, OBSTACLE } from '../config/GameConfig';
import { TUNNEL } from '../config/TunnelConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import {
  FRAME_OUTER,
  OPENING_BOUND,
  addSpinningDisc,
  addSquareFrame,
  openingLimitInBox,
} from './shapes';

export class RotatingRing extends BaseObstacle {
  readonly type: ObstacleType = 'ROTATING_RING';

  protected build(config: ObstacleSpawnConfig, rng: RngLike): void {
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    const angle = Math.atan2(config.targetY, config.targetX);
    const minOpen = GENERATION.ABSOLUTE_MIN_OPENING;

    const rate = rotationSpeedFor(config.difficulty, config.overdrive);
    this.spinRate = rng.chance(0.5) ? rate : -rate;

    // The hole orbits at `offset`, so it travels offset*omega. Cap the offset so
    // that what survives the crossing window still fits inside the clamp box.
    const shrinkRate = Math.abs(this.spinRate) * GENERATION.TIMING_WINDOW;
    const bearing = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    const maxOffset = (OPENING_BOUND - minOpen) / (bearing + shrinkRate);
    const offset = Math.min(Math.hypot(config.targetX, config.targetY), maxOffset);

    const cx = Math.cos(angle) * offset;
    const cy = Math.sin(angle) * offset;
    const half = Math.min(
      Math.max(config.openingHalf, minOpen + offset * shrinkRate),
      openingLimitInBox(cx, cy),
    );

    // The hole lives at local (offset, 0); the phase brings it round to `angle`
    // exactly at the crossing time.
    this.spinPhase = angle - this.spinRate * config.tCross;

    addSpinningDisc(this.parts, offset, 0, half, OBSTACLE.DEPTH_HALF, 'primary', 'accent');
    // Static housing out to the tunnel wall; the disc turns beneath it.
    addSquareFrame(
      this.parts,
      TUNNEL.SPIN_FRAME_INNER,
      FRAME_OUTER,
      OBSTACLE.DEPTH_HALF,
      'secondary',
    );

    this.openings.push({
      cx: offset,
      cy: 0,
      hx: half,
      hy: half,
      shape: 'circle',
      spins: true,
    });
    this.plannedX = cx;
    this.plannedY = cy;
    this.plannedHalf = half;
  }
}
