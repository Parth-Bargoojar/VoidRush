/**
 * VOIDRUSH — obstacle interface and shared base implementation.
 *
 * An obstacle is pure data plus pure functions of absolute simulation time. It
 * holds no Three.js objects, which is what lets the whole simulation run
 * head-less in tests and in the soak harness.
 *
 * All motion is a closed-form function of time rather than an integration, so
 * the generator can ask "where will this opening be when the player arrives?"
 * and get an exact answer.
 */

import { OBSTACLE } from '../config/GameConfig';
import { OBSTACLE_WEIGHTS } from '../config/ScoreConfig';
import { pointToBoxDistance } from '../utils/MathUtils';
import type {
  CollisionVolume,
  ObstacleLifecycle,
  ObstaclePart,
  ObstacleSpawnConfig,
  ObstacleTransform,
  ObstacleType,
  Opening,
  RngLike,
} from '../types';

/** An opening expressed in obstacle-local space. */
export interface LocalOpening {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  shape: 'rect' | 'circle';
  /** True when the opening orbits with the spinning body. */
  spins: boolean;
}

/**
 * Lets a combination obstacle build its own sub-layers without importing the
 * factory, which would otherwise create an import cycle.
 */
export interface ObstacleSource {
  acquire(type: ObstacleType): BaseObstacle;
  release(obstacle: BaseObstacle): void;
}

export interface Obstacle {
  readonly type: ObstacleType;
  readonly difficultyWeight: number;
  id: number;
  z: number;
  state: ObstacleLifecycle;
  /** Half-depth along Z of the whole body, including combination layers. */
  readonly depthHalf: number;
  spawn(config: ObstacleSpawnConfig, rng: RngLike): void;
  update(dt: number, time: number): void;
  getSolidVolumes(out: CollisionVolume[], time: number, zAt?: number): number;
  getOpenings(time: number): Opening[];
  reset(): void;
}

export abstract class BaseObstacle implements Obstacle {
  abstract readonly type: ObstacleType;

  id = 0;
  z = 0;
  state: ObstacleLifecycle = 'IDLE';

  /** Local-space solid boxes. Also the exact source of the rendered geometry. */
  readonly parts: ObstaclePart[] = [];
  /** Local-space traversable regions. */
  readonly openings: LocalOpening[] = [];

  /** Spin about Z: theta(t) = spinPhase + spinRate * t. */
  spinRate = 0;
  spinPhase = 0;

  /** Lateral oscillation: offset(t) = axis * amp * sin(2*pi*freq*t + phase). */
  oscAmplitude = 0;
  oscFrequency = 0;
  oscPhase = 0;
  oscAxisX = 0;
  oscAxisY = 0;

  /** Absolute simulation time at which this body reaches z = 0. */
  tCross = 0;
  /**
   * Accumulated run distance at which this body reaches z = 0. Position is
   * derived from this rather than integrated, so an obstacle's Z is an exact
   * function of simulation time and cannot drift from the generator's plan.
   */
  zeroDistance = 0;
  /** The opening the generator committed to; the next obstacle chains from it. */
  plannedX = 0;
  plannedY = 0;
  plannedHalf = 0;

  /** Minimum surface-to-surface distance observed while crossing the player. */
  minSurfaceDistance = Number.POSITIVE_INFINITY;
  nearMissAwarded = false;
  hasCollided = false;

  private depth = OBSTACLE.DEPTH_HALF;

  get depthHalf(): number {
    return this.depth;
  }

  protected setDepthHalf(value: number): void {
    this.depth = value;
  }

  get difficultyWeight(): number {
    return OBSTACLE_WEIGHTS[this.type];
  }

  /** Builds the body. Implementations only append to `parts` and `openings`. */
  protected abstract build(config: ObstacleSpawnConfig, rng: RngLike): void;

  spawn(config: ObstacleSpawnConfig, rng: RngLike): void {
    this.reset();
    this.id = config.id;
    this.z = config.z;
    this.tCross = config.tCross;
    this.plannedX = config.targetX;
    this.plannedY = config.targetY;
    this.plannedHalf = config.openingHalf;
    this.build(config, rng);
    this.state = 'APPROACHING';
  }

  reset(): void {
    this.parts.length = 0;
    this.openings.length = 0;
    this.spinRate = 0;
    this.spinPhase = 0;
    this.oscAmplitude = 0;
    this.oscFrequency = 0;
    this.oscPhase = 0;
    this.oscAxisX = 0;
    this.oscAxisY = 0;
    this.minSurfaceDistance = Number.POSITIVE_INFINITY;
    this.nearMissAwarded = false;
    this.hasCollided = false;
    this.state = 'IDLE';
    this.depth = OBSTACLE.DEPTH_HALF;
    this.id = 0;
    this.zeroDistance = 0;
    this.tCross = 0;
    this.z = 0;
  }

  /** Advances the body. Position in Z is owned by the world manager. */
  update(_dt: number, _time: number): void {
    // Motion is closed-form in `transformAt`; nothing to integrate.
  }

  /** The rigid transform of the spinning body at absolute time `t`. */
  transformAt(t: number, out: ObstacleTransform): ObstacleTransform {
    out.theta = this.spinPhase + this.spinRate * t;
    if (this.oscAmplitude !== 0) {
      const s = Math.sin(Math.PI * 2 * this.oscFrequency * t + this.oscPhase);
      out.tx = this.oscAxisX * this.oscAmplitude * s;
      out.ty = this.oscAxisY * this.oscAmplitude * s;
    } else {
      out.tx = 0;
      out.ty = 0;
    }
    return out;
  }

  /**
   * Writes world-space collision volumes into `out` and returns how many were
   * written. `out` is reused by the caller, so this allocates nothing.
   */
  getSolidVolumes(out: CollisionVolume[], time: number, zAt?: number): number {
    const tr = this.transformAt(time, SCRATCH_TRANSFORM);
    const baseZ = zAt ?? this.z;
    const cos = Math.cos(tr.theta);
    const sin = Math.sin(tr.theta);

    for (let i = 0; i < this.parts.length; i += 1) {
      const p = this.parts[i]!;
      let cx: number;
      let cy: number;
      let rot: number;
      if (p.spins) {
        cx = p.ox * cos - p.oy * sin + tr.tx;
        cy = p.ox * sin + p.oy * cos + tr.ty;
        rot = tr.theta;
      } else {
        cx = p.ox + tr.tx;
        cy = p.oy + tr.ty;
        rot = 0;
      }
      let slot = out[i];
      if (slot === undefined) {
        slot = { cx: 0, cy: 0, cz: 0, hx: 0, hy: 0, hz: 0, rot: 0 };
        out[i] = slot;
      }
      slot.cx = cx;
      slot.cy = cy;
      slot.cz = baseZ + p.oz;
      slot.hx = p.hx;
      slot.hy = p.hy;
      slot.hz = p.hz;
      slot.rot = rot;
    }
    return this.parts.length;
  }

  /** World-space openings at absolute time `t`. */
  getOpenings(t: number): Opening[] {
    const tr = this.transformAt(t, SCRATCH_TRANSFORM);
    const cos = Math.cos(tr.theta);
    const sin = Math.sin(tr.theta);
    const result: Opening[] = [];
    for (const o of this.openings) {
      if (o.spins) {
        result.push({
          cx: o.cx * cos - o.cy * sin + tr.tx,
          cy: o.cx * sin + o.cy * cos + tr.ty,
          hx: o.hx,
          hy: o.hy,
          shape: o.shape,
        });
      } else {
        result.push({ cx: o.cx + tr.tx, cy: o.cy + tr.ty, hx: o.hx, hy: o.hy, shape: o.shape });
      }
    }
    return result;
  }

  /**
   * Smallest surface-to-surface distance between a point and this body's solid
   * geometry at time `t`. Negative means the point is inside a solid.
   *
   * This is the primitive behind both collision and the reachability proof: the
   * generator uses it to verify an opening against the real geometry rather
   * than against an analytic approximation of it.
   */
  distanceToSolid(px: number, py: number, pz: number, t: number, zAt?: number): number {
    const count = this.getSolidVolumes(SCRATCH_VOLUMES, t, zAt);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i += 1) {
      const v = SCRATCH_VOLUMES[i]!;
      const d = pointToBoxDistance(px, py, pz, v.cx, v.cy, v.cz, v.hx, v.hy, v.hz, v.rot);
      if (d < best) best = d;
      if (best < 0) return best;
    }
    return best;
  }

  /** Total number of solid boxes, used by pooling and budget assertions. */
  get partCount(): number {
    return this.parts.length;
  }

  /**
   * The independently-moving bodies this obstacle is made of. Plain archetypes
   * are a single body; a combination reports one per layer. The renderer drives
   * one mesh pair per body, so a whole obstacle costs one transform update per
   * frame rather than one per box.
   */
  renderBodies(out: RenderBody[]): number {
    let slot = out[0];
    if (slot === undefined) {
      slot = { source: this, zOffset: 0 };
      out[0] = slot;
    } else {
      slot.source = this;
      slot.zOffset = 0;
    }
    return 1;
  }
}

/** One rigidly-moving piece of an obstacle. */
export interface RenderBody {
  source: BaseObstacle;
  zOffset: number;
}

const SCRATCH_TRANSFORM: ObstacleTransform = { tx: 0, ty: 0, theta: 0 };
const SCRATCH_VOLUMES: CollisionVolume[] = [];
