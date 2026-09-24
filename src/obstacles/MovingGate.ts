/**
 * O6 — Moving Gate. A gate whose opening oscillates on X or Y.
 *
 * The slab is built wider than the cross-section by twice the amplitude, so
 * that sliding it can never expose a gap at the tunnel wall — the classic way
 * a moving obstacle accidentally becomes trivial.
 */

import { DIFFICULTY, oscillationPeakSpeedFor } from '../config/DifficultyConfig';
import { GENERATION, OBSTACLE } from '../config/GameConfig';
import { lerp } from '../utils/MathUtils';
import type { ObstacleSpawnConfig, ObstacleType, RngLike } from '../types';
import { BaseObstacle } from './Obstacle';
import { COVER_SQUARE, FRAME_OUTER, addSlabWithRectHole, openingLimitInBox } from './shapes';

export class MovingGate extends BaseObstacle {
  readonly type: ObstacleType = 'MOVING_GATE';

  protected build(config: ObstacleSpawnConfig, rng: RngLike): void {
    this.setDepthHalf(OBSTACLE.DEPTH_HALF);

    const amplitude = lerp(
      DIFFICULTY.OSCILLATION_AMPLITUDE_START,
      DIFFICULTY.OSCILLATION_AMPLITUDE_END,
      config.difficulty,
    );
    // Frequency follows from the peak speed the opening is allowed to travel at.
    const peakSpeed = oscillationPeakSpeedFor(config.difficulty, config.overdrive);
    const frequency = peakSpeed / (Math.PI * 2 * amplitude);

    const horizontal = rng.chance(0.5);
    this.oscAxisX = horizontal ? 1 : 0;
    this.oscAxisY = horizontal ? 0 : 1;
    this.oscAmplitude = amplitude;
    this.oscFrequency = frequency;
    this.oscPhase = rng.range(0, Math.PI * 2);

    // Solve the rest position so the opening sits on the target at crossing time.
    const offsetAtCross =
      amplitude * Math.sin(Math.PI * 2 * frequency * config.tCross + this.oscPhase);
    const restX = config.targetX - this.oscAxisX * offsetAtCross;
    const restY = config.targetY - this.oscAxisY * offsetAtCross;

    // Grow the opening by what the crossing window will take off it, so the
    // player never has to be frame-perfect on a sliding gate.
    const half = Math.min(
      Math.max(
        config.openingHalf,
        GENERATION.ABSOLUTE_MIN_OPENING + peakSpeed * GENERATION.TIMING_WINDOW,
      ),
      openingLimitInBox(config.targetX, config.targetY),
    );
    // Wide enough that sliding never exposes the reachable box, and that the
    // slab still meets the widest tunnel wall at either end of its travel.
    const extent = Math.max(COVER_SQUARE + amplitude * 2, FRAME_OUTER + amplitude);

    addSlabWithRectHole(
      this.parts,
      restX,
      restY,
      half,
      half,
      extent,
      OBSTACLE.DEPTH_HALF,
      'primary',
      'accent',
    );

    this.openings.push({
      cx: restX,
      cy: restY,
      hx: half,
      hy: half,
      shape: 'rect',
      spins: false,
    });
    this.plannedHalf = half;
  }
}
