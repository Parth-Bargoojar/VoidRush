/**
 * VOIDRUSH — the moving world.
 *
 * Owns the tunnel, the live obstacles and the generator. The player never
 * translates in Z: the world advances toward the camera, and every object's Z
 * is derived from the run's accumulated distance rather than integrated, so a
 * paused or slowed frame can never desynchronise it from the generator's plan.
 */

import { WORLD } from '../config/GameConfig';
import { sweepObstacle } from '../game/CollisionSystem';
import type { DifficultyManager } from '../game/DifficultyManager';
import type { ObstacleFactory } from '../obstacles/ObstacleFactory';
import type { BaseObstacle } from '../obstacles/Obstacle';
import type { ObstacleType, Player, RngLike } from '../types';
import { ObstacleGenerator } from './ObstacleGenerator';
import { Tunnel } from './Tunnel';

export type WorldEventKind = 'CLEAR' | 'COLLIDE';

export interface WorldEvent {
  kind: WorldEventKind;
  type: ObstacleType;
  obstacleId: number;
  /** Closest surface-to-surface approach recorded while crossing. */
  minSurfaceDistance: number;
}

/** Reusable event slots, so a step allocates nothing. */
const EVENT_CAPACITY = 32;

export class WorldManager {
  readonly tunnel: Tunnel;
  readonly active: BaseObstacle[] = [];
  readonly generator: ObstacleGenerator;

  private readonly factory: ObstacleFactory;
  private readonly events: WorldEvent[] = [];
  private eventCount = 0;

  constructor(factory: ObstacleFactory, difficulty: DifficultyManager, rng: RngLike) {
    this.factory = factory;
    this.tunnel = new Tunnel(difficulty);
    this.generator = new ObstacleGenerator(factory, difficulty, rng);
    for (let i = 0; i < EVENT_CAPACITY; i += 1) {
      this.events.push({ kind: 'CLEAR', type: 'STATIC_GATE', obstacleId: 0, minSurfaceDistance: 0 });
    }
  }

  /** `menu` builds the calm opening tunnel used behind the main menu. */
  reset(seed: number, rng: RngLike, lateralSpeed: number, menu = false): void {
    for (const obstacle of this.active) this.factory.release(obstacle);
    this.active.length = 0;
    this.eventCount = 0;
    this.tunnel.reset(seed, menu);
    this.generator.reset(rng, lateralSpeed);
  }

  /** Events produced by the most recent step. Valid until the next step. */
  get stepEvents(): readonly WorldEvent[] {
    return this.events.slice(0, this.eventCount);
  }

  get eventCountThisStep(): number {
    return this.eventCount;
  }

  eventAt(index: number): WorldEvent {
    return this.events[index]!;
  }

  private pushEvent(
    kind: WorldEventKind,
    type: ObstacleType,
    obstacleId: number,
    minSurfaceDistance: number,
  ): void {
    if (this.eventCount >= EVENT_CAPACITY) return;
    const slot = this.events[this.eventCount]!;
    slot.kind = kind;
    slot.type = type;
    slot.obstacleId = obstacleId;
    slot.minSurfaceDistance = minSurfaceDistance;
    this.eventCount += 1;
  }

  /**
   * Advances the world by one fixed step.
   *
   * `distancePrev`/`distanceCur` bracket the step, and `tPrev`/`tCur` are the
   * matching simulation times; both are needed because obstacle motion and
   * obstacle position are separate closed-form functions of time.
   */
  step(
    distancePrev: number,
    distanceCur: number,
    tPrev: number,
    tCur: number,
    player: Player,
  ): void {
    this.eventCount = 0;
    this.tunnel.update(distanceCur);
    this.spawnDue(distanceCur);

    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const obstacle = this.active[i]!;
      const zPrev = distancePrev - obstacle.zeroDistance;
      const zCur = distanceCur - obstacle.zeroDistance;
      obstacle.z = zCur;

      if (obstacle.state === 'APPROACHING') {
        const sweep = sweepObstacle(obstacle, player, zPrev, zCur, tPrev, tCur);
        if (sweep.crossed && sweep.minSurfaceDistance < obstacle.minSurfaceDistance) {
          obstacle.minSurfaceDistance = sweep.minSurfaceDistance;
        }
        if (sweep.collided) {
          obstacle.hasCollided = true;
          this.pushEvent('COLLIDE', obstacle.type, obstacle.id, sweep.minSurfaceDistance);
          continue;
        }
        // Cleared once the trailing face is behind the player.
        if (zCur - obstacle.depthHalf > WORLD.CLEAR_Z) {
          obstacle.state = 'CLEARED';
          this.pushEvent('CLEAR', obstacle.type, obstacle.id, obstacle.minSurfaceDistance);
        }
      }

      if (zCur - obstacle.depthHalf > WORLD.DESPAWN_Z) {
        this.active.splice(i, 1);
        this.factory.release(obstacle);
      }
    }
  }

  /**
   * Generates ahead of the spawn plane. Generation happens before an obstacle
   * is visible, never inside the frustum.
   */
  private spawnDue(distance: number): void {
    let guard = 0;
    while (
      this.active.length < WORLD.MAX_ACTIVE_OBSTACLES &&
      this.generator.pendingZeroDistance - distance <= Math.abs(WORLD.SPAWN_Z) &&
      guard < WORLD.MAX_ACTIVE_OBSTACLES
    ) {
      const obstacle = this.generator.generate();
      obstacle.z = distance - obstacle.zeroDistance;
      this.active.push(obstacle);
      guard += 1;
    }
  }

  get activeCount(): number {
    return this.active.length;
  }

  /** Total solid boxes across every live obstacle. Used by budget assertions. */
  get activePartCount(): number {
    let total = 0;
    for (const obstacle of this.active) total += obstacle.partCount;
    return total;
  }
}
