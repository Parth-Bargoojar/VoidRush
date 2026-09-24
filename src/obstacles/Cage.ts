/**
 * O7 — Cage. A deep rectangular tube: the player enters through the near face
 * and must hold the line all the way through, rather than clipping a thin gate.
 */

import { OBSTACLE } from '../config/GameConfig';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import { FRAME_OUTER, addBox, addSlabWithRectHole, openingLimitInBox } from './shapes';

export class Cage extends BaseObstacle {
  readonly type: ObstacleType = 'CAGE';

  protected build(config: ObstacleSpawnConfig, _rng: RngLike): void {
    const depthHalf = OBSTACLE.CAGE_DEPTH_HALF;
    this.setDepthHalf(depthHalf);

    const radius = Math.min(config.openingHalf, openingLimitInBox(config.targetX, config.targetY));
    // The tube's square cross-section circumscribes the declared circular
    // opening, so the corner rails can never intrude on it.
    const interior = radius * OBSTACLE.CAGE_INTERIOR_FACTOR;

    addSlabWithRectHole(
      this.parts,
      config.targetX,
      config.targetY,
      interior,
      interior,
      FRAME_OUTER,
      depthHalf,
      'primary',
      'accent',
    );

    // Longitudinal corner rails give the archetype its cage silhouette.
    const rail = OBSTACLE.CAGE_RAIL_HALF;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        addBox(
          this.parts,
          config.targetX + sx * interior,
          config.targetY + sy * interior,
          0,
          rail,
          rail,
          depthHalf * OBSTACLE.CAGE_RAIL_OVERHANG,
          false,
          'accent',
        );
      }
    }

    this.openings.push({
      cx: config.targetX,
      cy: config.targetY,
      hx: radius,
      hy: radius,
      shape: 'circle',
      spins: false,
    });
    this.plannedHalf = radius;
  }
}
