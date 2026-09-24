/**
 * VOIDRUSH — the animation loop.
 *
 * One `requestAnimationFrame` drives everything. Each frame is decomposed into
 * whole fixed steps, the world is rendered once, and the HUD is published at a
 * fixed 15 Hz. React is not involved at any point.
 */

import { TIMING } from '../config/GameConfig';
import { FixedStepAccumulator, now } from '../utils/Timing';

export interface LoopCallbacks {
  /** Runs one fixed simulation step. */
  step: (dt: number) => void;
  /** Draws the world. `dt` is real elapsed time, for visual smoothing only. */
  render: (dt: number) => void;
  /** Publishes the HUD snapshot. */
  publish: () => void;
  /** True while the simulation should advance; false when paused or in a menu. */
  shouldStep: () => boolean;
}

export class GameLoop {
  private readonly accumulator = new FixedStepAccumulator();
  private readonly callbacks: LoopCallbacks;
  private handle: number | null = null;
  private lastTime = 0;
  private publishTimer = 0;
  private running = false;

  constructor(callbacks: LoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = now();
    this.accumulator.reset();
    this.handle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      cancelAnimationFrame(this.handle);
      this.handle = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get frameSkips(): number {
    return this.accumulator.frameSkips;
  }

  get stepCount(): number {
    return this.accumulator.stepCount;
  }

  private readonly frame = (): void => {
    if (!this.running) return;
    this.handle = requestAnimationFrame(this.frame);

    const time = now();
    const elapsed = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (this.callbacks.shouldStep()) {
      const steps = this.accumulator.consume(elapsed);
      for (let i = 0; i < steps; i += 1) {
        this.callbacks.step(TIMING.FIXED_DT);
      }
    } else {
      // Paused: drop the backlog so resuming does not fast-forward, but keep
      // the step count intact so a halted simulation is observable.
      this.accumulator.dropBacklog();
    }

    // Rendering happens once per frame, after stepping.
    this.callbacks.render(Math.min(elapsed, TIMING.MAX_FRAME_DELTA));

    this.publishTimer += elapsed;
    const interval = 1 / TIMING.HUD_PUSH_HZ;
    if (this.publishTimer >= interval) {
      this.publishTimer %= interval;
      this.callbacks.publish();
    }
  };
}
