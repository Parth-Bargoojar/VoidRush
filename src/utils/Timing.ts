/**
 * VOIDRUSH — fixed-timestep accumulator.
 *
 * The accumulator is the reason a run plays identically at 30, 60, 120 and
 * 144 Hz: every frame is decomposed into whole simulation steps of FIXED_DT and
 * the remainder is carried to the next frame.
 */

import { TIMING } from '../config/GameConfig';

export class FixedStepAccumulator {
  private accumulator = 0;
  private steps = 0;
  private skips = 0;

  /**
   * Consumes a frame delta and returns how many fixed steps to run now.
   * The delta is clamped, and any backlog beyond MAX_STEPS_PER_FRAME is dropped
   * rather than allowed to spiral.
   */
  consume(frameDelta: number): number {
    const clamped = Math.min(Math.max(frameDelta, 0), TIMING.MAX_FRAME_DELTA);
    this.accumulator += clamped;

    let count = 0;
    while (
      this.accumulator >= TIMING.FIXED_DT - TIMING.ACCUMULATOR_EPSILON &&
      count < TIMING.MAX_STEPS_PER_FRAME
    ) {
      this.accumulator -= TIMING.FIXED_DT;
      count += 1;
    }

    if (this.accumulator >= TIMING.FIXED_DT - TIMING.ACCUMULATOR_EPSILON) {
      // Still behind after the cap: drop the backlog and record it.
      this.skips += 1;
      this.accumulator = 0;
    }

    this.steps += count;
    return count;
  }

  /**
   * Discards unconsumed time without touching the statistics. Used when the
   * game pauses: resuming must not fast-forward through the paused interval,
   * but the cumulative step count has to stay meaningful, because it is the
   * evidence that the simulation really halted.
   */
  dropBacklog(): void {
    this.accumulator = 0;
  }

  /** Full reset, including statistics. Used when a run starts. */
  reset(): void {
    this.accumulator = 0;
    this.steps = 0;
    this.skips = 0;
  }

  /** Fraction of a step already accumulated, for render interpolation. */
  get alpha(): number {
    return this.accumulator / TIMING.FIXED_DT;
  }

  get stepCount(): number {
    return this.steps;
  }

  get frameSkips(): number {
    return this.skips;
  }
}

/** Monotonic clock that works in both the browser and Node. */
export function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
