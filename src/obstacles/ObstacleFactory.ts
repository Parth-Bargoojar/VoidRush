/**
 * VOIDRUSH — obstacle construction.
 *
 * Every obstacle in the game comes from here. The game loop never branches on
 * obstacle type: it only ever sees the `Obstacle` interface.
 */

import type { ObstacleType } from '../types';
import { Bullseye } from './Bullseye';
import { Cage } from './Cage';
import { CombinationObstacle } from './CombinationObstacle';
import { Cross } from './Cross';
import { Fan } from './Fan';
import { MovingGate } from './MovingGate';
import type { BaseObstacle, ObstacleSource } from './Obstacle';
import { ObstaclePool } from './ObstaclePool';
import { Ring } from './Ring';
import { RotatingCross } from './RotatingCross';
import { RotatingRing } from './RotatingRing';
import { StaticGate } from './StaticGate';

export class ObstacleFactory implements ObstacleSource {
  private readonly pool: ObstaclePool;

  constructor() {
    this.pool = new ObstaclePool({
      STATIC_GATE: () => new StaticGate(),
      CROSS: () => new Cross(),
      RING: () => new Ring(),
      BULLSEYE: () => new Bullseye(),
      MOVING_GATE: () => new MovingGate(),
      ROTATING_RING: () => new RotatingRing(),
      ROTATING_CROSS: () => new RotatingCross(),
      FAN: () => new Fan(),
      CAGE: () => new Cage(),
      // Combinations build their own sub-layers through this same factory.
      COMBINATION: () => new CombinationObstacle(this),
    });
  }

  acquire(type: ObstacleType): BaseObstacle {
    return this.pool.acquire(type);
  }

  release(obstacle: BaseObstacle): void {
    this.pool.release(obstacle);
  }

  /** Total instances ever constructed. Stable after warm-up. */
  get createdCount(): number {
    return this.pool.createdCount;
  }
}

/** Every archetype the generator may choose from. */
export const ALL_OBSTACLE_TYPES: ReadonlyArray<ObstacleType> = Object.freeze([
  'STATIC_GATE',
  'CROSS',
  'RING',
  'BULLSEYE',
  'MOVING_GATE',
  'ROTATING_RING',
  'ROTATING_CROSS',
  'FAN',
  'CAGE',
  'COMBINATION',
]);
