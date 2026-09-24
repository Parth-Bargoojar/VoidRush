/**
 * VOIDRUSH — constrained obstacle generation.
 *
 * [PRD 18] Generation is constrained, not random. The generator samples the
 * next opening *inside* the player's proven reach envelope and then hands the
 * result to the independent validator; nothing reaches the world unproven.
 * Sampling inside the envelope rather than rejecting outside it is why the
 * fallback rate stays near zero instead of climbing with difficulty.
 *
 * [PRD 21] If every candidate fails, a guaranteed-safe fallback is emitted: a
 * static gate with the widest legal opening, centred exactly where the player
 * already is.
 */

import { TYPE_WEIGHTS } from '../config/DifficultyConfig';
import { GENERATION, MOVEMENT, WORLD } from '../config/GameConfig';
import type { DifficultyManager } from '../game/DifficultyManager';
import { createDifficultyState } from '../game/DifficultyManager';
import type { ObstacleFactory } from '../obstacles/ObstacleFactory';
import type { BaseObstacle } from '../obstacles/Obstacle';
import {
  validateReachability,
  type ReachabilityRequest,
} from '../obstacles/ReachabilityValidator';
import { OPENING_BOUND } from '../obstacles/shapes';
import { weightedPick } from '../utils/Random';
import { clamp } from '../utils/MathUtils';
import type { DifficultyState, ObstacleType, RngLike } from '../types';

export interface GenerationStats {
  generated: number;
  fallbacks: number;
  attempts: number;
  byType: Map<ObstacleType, number>;
}

export class ObstacleGenerator {
  private readonly factory: ObstacleFactory;
  private readonly difficulty: DifficultyManager;
  private readonly scratchDifficulty: DifficultyState = createDifficultyState();

  private rng: RngLike;
  private lateralSpeed = MOVEMENT.MAX_LATERAL_SPEED;

  /** Where the player provably is after the last committed obstacle. */
  private prevX = 0;
  private prevY = 0;
  private prevTCross = 0;
  /** Accumulated distance at which the next obstacle should reach z = 0. */
  private nextZeroDistance = 0;
  private nextId = 1;

  readonly stats: GenerationStats = {
    generated: 0,
    fallbacks: 0,
    attempts: 0,
    byType: new Map<ObstacleType, number>(),
  };

  /**
   * The envelope the most recent obstacle was proved against, and whether the
   * safe fallback had to be used. Exposed so tests can re-run the proof
   * independently rather than taking the generator's word for it.
   */
  lastRequest: ReachabilityRequest | null = null;
  lastUsedFallback = false;

  constructor(factory: ObstacleFactory, difficulty: DifficultyManager, rng: RngLike) {
    this.factory = factory;
    this.difficulty = difficulty;
    this.rng = rng;
  }

  reset(rng: RngLike, lateralSpeed: number): void {
    this.rng = rng;
    this.lateralSpeed = lateralSpeed;
    this.prevX = 0;
    this.prevY = 0;
    this.prevTCross = 0;
    // The first obstacle is a full spacing beyond the spawn plane, so the run
    // opens with clear air rather than an immediate wall.
    this.nextZeroDistance = Math.abs(WORLD.SPAWN_Z);
    this.nextId = 1;
    this.stats.generated = 0;
    this.stats.fallbacks = 0;
    this.stats.attempts = 0;
    this.stats.byType.clear();
  }

  /** Distance at which the next obstacle will reach the player. */
  get pendingZeroDistance(): number {
    return this.nextZeroDistance;
  }

  /**
   * Updates the reach envelope mid-run. Lowering the sensitivity setting during
   * a run makes the player slower than the generator assumed, which would leave
   * already-planned obstacles unreachable, so the envelope has to follow it.
   */
  setLateralSpeed(lateralSpeed: number): void {
    this.lateralSpeed = lateralSpeed;
  }

  get currentLateralSpeed(): number {
    return this.lateralSpeed;
  }

  /**
   * Builds and proves the next obstacle in the sequence, advancing the planner.
   */
  generate(): BaseObstacle {
    const zeroDistance = this.nextZeroDistance;
    const tCross = this.difficulty.timeAtDistance(zeroDistance);
    const state = this.difficulty.stateAt(tCross, this.scratchDifficulty);

    const request: ReachabilityRequest = {
      prevX: this.prevX,
      prevY: this.prevY,
      prevTCross: this.prevTCross,
      lateralSpeed: this.lateralSpeed,
      tau: MOVEMENT.TAU,
      reachMargin: state.reachMargin,
    };

    this.lastRequest = request;
    this.lastUsedFallback = false;

    const table = TYPE_WEIGHTS[state.tier];
    let exitTCross = tCross;
    let committed: BaseObstacle | null = null;

    for (let attempt = 0; attempt < GENERATION.MAX_ATTEMPTS; attempt += 1) {
      this.stats.attempts += 1;
      const type = weightedPick(this.rng, table);
      const candidate = this.buildCandidate(type, zeroDistance, tCross, state);
      const proof = validateReachability(candidate, tCross, request);
      if (proof.ok) {
        this.prevX = proof.exitX;
        exitTCross = proof.exitTCross;
        this.prevY = proof.exitY;
        committed = candidate;
        break;
      }
      this.factory.release(candidate);
    }

    if (!committed) {
      committed = this.buildFallback(zeroDistance, tCross, state);
      const proof = validateReachability(committed, tCross, request);
      this.prevX = proof.ok ? proof.exitX : committed.plannedX;
      exitTCross = proof.ok ? proof.exitTCross : tCross;
      this.prevY = proof.ok ? proof.exitY : committed.plannedY;
      this.lastUsedFallback = true;
      this.stats.fallbacks += 1;
    }

    // The next obstacle is planned from when the player actually leaves this
    // one: for a combination that is its last layer, after its centre.
    this.prevTCross = exitTCross;
    this.nextZeroDistance = zeroDistance + state.spacing;
    this.stats.generated += 1;
    this.stats.byType.set(committed.type, (this.stats.byType.get(committed.type) ?? 0) + 1);

    return committed;
  }

  /** Samples a target inside the reach envelope and builds that archetype. */
  private buildCandidate(
    type: ObstacleType,
    zeroDistance: number,
    tCross: number,
    state: DifficultyState,
  ): BaseObstacle {
    const travel = tCross - this.prevTCross;
    const usable = Math.max(0, travel - GENERATION.REACH_TAU_CHARGE * MOVEMENT.TAU);
    const budget = this.lateralSpeed * usable * GENERATION.REACH_SAFETY;
    const bound = Math.max(0, OPENING_BOUND - state.openingHalf);

    const targetX = this.sampleAxis(this.prevX, budget, bound);
    const targetY = this.sampleAxis(this.prevY, budget, bound);

    const obstacle = this.factory.acquire(type);
    obstacle.spawn(
      {
        id: this.nextId,
        z: WORLD.SPAWN_Z,
        tCross,
        targetX,
        targetY,
        openingHalf: state.openingHalf,
        difficulty: state.d,
        overdrive: state.overdrive,
        speed: state.speed,
      },
      this.rng,
    );
    this.nextId += 1;
    obstacle.zeroDistance = zeroDistance;
    return obstacle;
  }

  /** [PRD 21] The guaranteed-safe shape: widest gap, centred where the player is. */
  private buildFallback(
    zeroDistance: number,
    tCross: number,
    state: DifficultyState,
  ): BaseObstacle {
    const bound = Math.max(0, OPENING_BOUND - state.openingHalf);
    const obstacle = this.factory.acquire('STATIC_GATE');
    obstacle.spawn(
      {
        id: this.nextId,
        z: WORLD.SPAWN_Z,
        tCross,
        targetX: clamp(this.prevX, -bound, bound),
        targetY: clamp(this.prevY, -bound, bound),
        openingHalf: state.openingHalf,
        difficulty: state.d,
        overdrive: state.overdrive,
        speed: state.speed,
      },
      this.rng,
    );
    this.nextId += 1;
    obstacle.zeroDistance = zeroDistance;
    return obstacle;
  }

  private sampleAxis(centre: number, budget: number, bound: number): number {
    const low = Math.max(-bound, centre - budget);
    const high = Math.min(bound, centre + budget);
    if (low >= high) return clamp(centre, -bound, bound);
    return this.rng.range(low, high);
  }

  get fallbackRate(): number {
    return this.stats.generated === 0 ? 0 : this.stats.fallbacks / this.stats.generated;
  }
}
