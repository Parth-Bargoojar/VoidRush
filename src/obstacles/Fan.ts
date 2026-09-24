/**
 * O5 — Fan. Three to six blades turning about Z at a rate that scales with
 * difficulty. Narrower sectors than the cross, so the gap sweeps faster.
 */

import { rotationSpeedFor } from '../config/DifficultyConfig';
import { OBSTACLE } from '../config/GameConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { SpokedObstacle } from './Cross';

export class Fan extends SpokedObstacle {
  readonly type: ObstacleType = 'FAN';

  protected spokeCount(config: ObstacleSpawnConfig, rng: RngLike): number {
    // More blades as the run gets harder, within the archetype's 3-6 range.
    const span = OBSTACLE.FAN_BLADES_MAX - OBSTACLE.FAN_BLADES_MIN;
    const bias = Math.round(config.difficulty * span);
    const low = OBSTACLE.FAN_BLADES_MIN;
    const high = Math.min(OBSTACLE.FAN_BLADES_MAX, low + bias + 1);
    return rng.int(low, high + 1);
  }

  protected spinSpeed(config: ObstacleSpawnConfig, rng: RngLike): number {
    const rate =
      rotationSpeedFor(config.difficulty, config.overdrive) * OBSTACLE.FAN_SPIN_FACTOR;
    return rng.chance(0.5) ? rate : -rate;
  }
}
