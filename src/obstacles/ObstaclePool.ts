/**
 * VOIDRUSH — per-type obstacle pooling.
 *
 * After warm-up the game allocates no obstacles: every spawn comes from a free
 * list. A stable `createdCount` across a long run is the evidence that the
 * recycling actually works.
 */

import { Pool } from '../utils/Pool';
import type { ObstacleType } from '../types';
import type { BaseObstacle } from './Obstacle';

export class ObstaclePool {
  private readonly pools = new Map<ObstacleType, Pool<BaseObstacle>>();
  private readonly factories: Readonly<Record<ObstacleType, () => BaseObstacle>>;

  constructor(factories: Readonly<Record<ObstacleType, () => BaseObstacle>>) {
    this.factories = factories;
  }

  acquire(type: ObstacleType): BaseObstacle {
    let pool = this.pools.get(type);
    if (!pool) {
      pool = new Pool<BaseObstacle>(this.factories[type]);
      this.pools.set(type, pool);
    }
    return pool.acquire();
  }

  release(obstacle: BaseObstacle): void {
    const type = obstacle.type;
    obstacle.reset();
    let pool = this.pools.get(type);
    if (!pool) {
      pool = new Pool<BaseObstacle>(this.factories[type]);
      this.pools.set(type, pool);
    }
    pool.release(obstacle);
  }

  /** Total obstacle instances ever constructed, across every type. */
  get createdCount(): number {
    let total = 0;
    for (const pool of this.pools.values()) total += pool.createdCount;
    return total;
  }

  createdCountFor(type: ObstacleType): number {
    return this.pools.get(type)?.createdCount ?? 0;
  }
}
