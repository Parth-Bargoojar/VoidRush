/**
 * O2 — Cross, and the shared radial-spoke body behind O8 (Rotating Cross) and
 * O5 (Fan).
 *
 * The passable region is the sector between two spokes. Because that sector
 * sweeps as the body turns, the generator never asks "where is the gap now?"
 * but "where will the gap be when the player arrives?" — the spin phase is
 * solved backwards from the crossing time so the sector lands on the target.
 */

import { GENERATION, OBSTACLE } from '../config/GameConfig';
import { TUNNEL } from '../config/TunnelConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import {
  COVER_DISC,
  FRAME_OUTER,
  OPENING_BOUND,
  addArms,
  addHub,
  addSquareFrame,
  armEffectiveHalfThickness,
  openingLimitInBox,
  radiusForSectorOpening,
  sectorOpeningRadius,
} from './shapes';

/** Shared implementation for spoked bodies: cross, rotating cross and fan. */
export abstract class SpokedObstacle extends BaseObstacle {
  /** Preferred number of radial spokes; may be reduced if geometry demands it. */
  protected abstract spokeCount(config: ObstacleSpawnConfig, rng: RngLike): number;
  /** Radians per second. Zero for the static cross. */
  protected abstract spinSpeed(config: ObstacleSpawnConfig, rng: RngLike): number;

  protected build(config: ObstacleSpawnConfig, rng: RngLike): void {
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    const armHalf = OBSTACLE.ARM_HALF_THICKNESS;
    const armEffective = armEffectiveHalfThickness(armHalf);
    const angle = Math.atan2(config.targetY, config.targetX);
    const minOpen = GENERATION.ABSOLUTE_MIN_OPENING;

    const count0 = this.spokeCount(config, rng);
    const spin = this.spinSpeed(config, rng);
    // A sector at radius r sweeps r*omega; across the crossing window that eats
    // r*omega*W off the usable opening, which is why radius cannot simply grow.
    const shrinkRate = Math.abs(spin) * GENERATION.TIMING_WINDOW;

    // How far out the opening centre may sit before the (already shrunk)
    // opening would spill outside the clamp box.
    const bearing = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    const maxRadius = (OPENING_BOUND - minOpen) / (bearing + shrinkRate);

    // Tighter sectors need a larger radius to admit the same circle. Drop spokes
    // until the geometry fits inside the box.
    const radiusNeededFor = (n: number): number => {
      const denom = Math.sin(Math.PI / n) - shrinkRate;
      return denom > 0 ? (minOpen + armEffective) / denom : Number.POSITIVE_INFINITY;
    };
    let count = count0;
    while (count > OBSTACLE.FAN_BLADES_MIN && radiusNeededFor(count) > maxRadius) {
      count -= 1;
    }
    const sectorHalfAngle = Math.PI / count;
    const minRadius = Math.min(radiusNeededFor(count), maxRadius);

    // Sectors widen with radius but the clamp box closes in, so the best
    // opening sits where those two limits meet. Never aim past that point.
    const sweetRadius =
      (OPENING_BOUND + armEffective) /
      Math.max(Math.sin(sectorHalfAngle) - shrinkRate + bearing, 1e-3);
    const wanted = Math.max(config.openingHalf, minOpen);
    const idealRadius = Math.min(
      radiusForSectorOpening(wanted, sectorHalfAngle, armEffective),
      sweetRadius,
    );
    const requested = Math.hypot(config.targetX, config.targetY);
    let radius = Math.max(requested, Math.min(idealRadius, maxRadius));
    radius = Math.min(Math.max(radius, minRadius), Math.max(minRadius, maxRadius));

    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    const shrink = radius * shrinkRate;
    const half = Math.min(
      Math.max(wanted, minOpen + shrink),
      sectorOpeningRadius(radius, sectorHalfAngle, armEffective),
      openingLimitInBox(cx, cy),
    );

    addHub(this.parts, OBSTACLE.HUB_RADIUS, OBSTACLE.DEPTH_HALF, 'secondary');
    addArms(
      this.parts,
      count,
      OBSTACLE.HUB_RADIUS,
      COVER_DISC,
      armHalf,
      OBSTACLE.DEPTH_HALF,
      'primary',
      'accent',
    );
    // A static housing carries the body out to the tunnel wall. It starts
    // beyond the reachable box plus the near-miss range, so it can never be
    // touched or scored against, and the spokes turn beneath it.
    addSquareFrame(
      this.parts,
      TUNNEL.SPIN_FRAME_INNER,
      FRAME_OUTER,
      OBSTACLE.DEPTH_HALF,
      'secondary',
    );

    // Spokes start at local angle 0, so sector centres sit one half-sector on.
    // Solve the phase so a sector centre reaches `angle` exactly at t = tCross.
    this.spinRate = spin;
    this.spinPhase = angle - sectorHalfAngle - this.spinRate * config.tCross;

    this.openings.push({
      cx: Math.cos(sectorHalfAngle) * radius,
      cy: Math.sin(sectorHalfAngle) * radius,
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

export class Cross extends SpokedObstacle {
  readonly type: ObstacleType = 'CROSS';

  /** [PRD O2] A four-arm obstacle containing multiple possible gaps. */
  protected spokeCount(): number {
    return 4;
  }

  protected spinSpeed(): number {
    return 0;
  }
}
