/**
 * O8 — Rotating Cross. A four-arm body turning about Z; the passable sector
 * sweeps, so the generator solves the spin phase from the crossing time.
 */

import { rotationSpeedFor } from '../config/DifficultyConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { SpokedObstacle } from './Cross';

export class RotatingCross extends SpokedObstacle {
  readonly type: ObstacleType = 'ROTATING_CROSS';

  protected spokeCount(): number {
    return 4;
  }

  protected spinSpeed(config: ObstacleSpawnConfig, rng: RngLike): number {
    const rate = rotationSpeedFor(config.difficulty, config.overdrive);
    return rng.chance(0.5) ? rate : -rate;
  }
}
