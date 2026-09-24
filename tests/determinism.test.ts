/**
 * Determinism: a seed plus an input script fully determines a run, and the
 * simulation is identical whether frames arrive at 30 Hz or 144 Hz.
 */

import { describe, expect, it } from 'vitest';
import { TIMING } from '../src/config/GameConfig';
import { Game, stepsForSeconds } from '../src/game/Game';
import { FixedStepAccumulator } from '../src/utils/Timing';
import type { InputState } from '../src/types';
import { DT, makeGenerator, scriptedInput } from './helpers';

function runScripted(seed: number, seconds: number): string {
  const game = new Game({ seed });
  game.startRun(seed);
  const input: InputState = { up: false, down: false, left: false, right: false };
  const steps = stepsForSeconds(seconds);
  for (let i = 0; i < steps; i += 1) {
    scriptedInput(i, input);
    game.step(DT, input);
  }
  return game.snapshot();
}

/** The sequence of archetypes and openings a seed generates. */
function planDigest(seed: number): string {
  const { generator, factory } = makeGenerator(seed);
  const parts: string[] = [];
  for (let i = 0; i < 60; i += 1) {
    const obstacle = generator.generate();
    parts.push(
      `${obstacle.type}:${obstacle.plannedX.toFixed(4)}:${obstacle.plannedY.toFixed(4)}`,
    );
    factory.release(obstacle);
  }
  return parts.join('|');
}

/**
 * Feeds whole frames of the given rate through the accumulator, exactly as the
 * browser loop does, and returns the resulting state.
 */
function runAtFrameRate(seed: number, hz: number, seconds: number): { snapshot: string; steps: number } {
  const game = new Game({ seed });
  game.startRun(seed);
  const accumulator = new FixedStepAccumulator();
  const input: InputState = { up: false, down: false, left: false, right: false };
  const frameDelta = 1 / hz;
  const frames = Math.round(seconds * hz);
  let stepIndex = 0;

  for (let f = 0; f < frames; f += 1) {
    const count = accumulator.consume(frameDelta);
    for (let s = 0; s < count; s += 1) {
      scriptedInput(stepIndex, input);
      game.step(TIMING.FIXED_DT, input);
      stepIndex += 1;
    }
  }
  return { snapshot: game.snapshot(), steps: stepIndex };
}

describe('run determinism', () => {
  it('reproduces a 60 second scripted run byte for byte', () => {
    expect(runScripted(20260812, 60)).toBe(runScripted(20260812, 60));
  });

  it('produces a different world for a different seed', () => {
    // Compared on the generated plan rather than on the player's fate: the
    // scripted input crashes into the first slab at the same instant whatever
    // the seed, because the slab face is at the same Z either way.
    expect(planDigest(1)).not.toBe(planDigest(2));
    expect(planDigest(1)).toBe(planDigest(1));
  });
});

describe('framerate independence', () => {
  it('yields identical state at 30 Hz and 144 Hz over 20 seconds', () => {
    const slow = runAtFrameRate(4242, 30, 20);
    const fast = runAtFrameRate(4242, 144, 20);
    expect(fast.steps).toBe(slow.steps);
    expect(fast.snapshot).toBe(slow.snapshot);
  });

  it('also matches at 45, 60 and 120 Hz', () => {
    const reference = runAtFrameRate(777, 60, 12);
    for (const hz of [45, 120, 144]) {
      const other = runAtFrameRate(777, hz, 12);
      expect(other.steps, `step count differs at ${hz} Hz`).toBe(reference.steps);
      expect(other.snapshot, `state differs at ${hz} Hz`).toBe(reference.snapshot);
    }
  });
});

describe('fixed step accumulator', () => {
  it('clamps huge frame deltas instead of spiralling', () => {
    const accumulator = new FixedStepAccumulator();
    const steps = accumulator.consume(10);
    expect(steps).toBe(TIMING.MAX_STEPS_PER_FRAME);
    expect(accumulator.frameSkips).toBe(1);
  });

  it('carries the remainder between frames', () => {
    const accumulator = new FixedStepAccumulator();
    let total = 0;
    for (let i = 0; i < 144; i += 1) total += accumulator.consume(1 / 144);
    expect(total).toBe(120);
  });

  it('resets cleanly', () => {
    const accumulator = new FixedStepAccumulator();
    accumulator.consume(1);
    accumulator.reset();
    expect(accumulator.stepCount).toBe(0);
    expect(accumulator.frameSkips).toBe(0);
  });

  it('drops the backlog on pause without discarding the step count', () => {
    const accumulator = new FixedStepAccumulator();
    accumulator.consume(1);
    const stepped = accumulator.stepCount;
    expect(stepped).toBeGreaterThan(0);

    // Pausing must not fast-forward on resume...
    accumulator.consume(0.004);
    accumulator.dropBacklog();
    expect(accumulator.alpha).toBe(0);
    // ...but the cumulative count is the evidence the simulation halted, so it
    // has to survive.
    expect(accumulator.stepCount).toBe(stepped);
  });
});
