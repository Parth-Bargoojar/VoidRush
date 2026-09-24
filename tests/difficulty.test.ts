/**
 * Difficulty must rise continuously along every axis, not by speed alone, and
 * every derived value must stay inside its declared bounds.
 */

import { describe, expect, it } from 'vitest';
import { DIFFICULTY, TYPE_WEIGHTS } from '../src/config/DifficultyConfig';
import { GENERATION, MOVEMENT, SPEED, WORLD } from '../src/config/GameConfig';
import { DifficultyManager, createDifficultyState } from '../src/game/DifficultyManager';
import type { DifficultyState } from '../src/types';

const manager = new DifficultyManager();

function sample(seconds: number): DifficultyState {
  return manager.stateAt(seconds, createDifficultyState());
}

describe('difficulty curve', () => {
  it('is monotonic and non-decreasing on every tightening axis', () => {
    let previous = sample(0);
    for (let t = 1; t <= 300; t += 1) {
      const current = sample(t);
      expect(current.d, `d at ${t}s`).toBeGreaterThanOrEqual(previous.d);
      expect(current.speed, `speed at ${t}s`).toBeGreaterThanOrEqual(previous.speed);
      expect(current.rotationSpeed, `rotation at ${t}s`).toBeGreaterThanOrEqual(
        previous.rotationSpeed,
      );
      expect(current.oscillationAmplitude, `amplitude at ${t}s`).toBeGreaterThanOrEqual(
        previous.oscillationAmplitude,
      );
      expect(current.visualIntensity, `intensity at ${t}s`).toBeGreaterThanOrEqual(
        previous.visualIntensity,
      );
      // Gaps and reaction time shrink rather than grow.
      expect(current.openingHalf, `opening at ${t}s`).toBeLessThanOrEqual(previous.openingHalf);
      expect(current.gapSeconds, `gap seconds at ${t}s`).toBeLessThanOrEqual(previous.gapSeconds);
      expect(current.reachMargin, `margin at ${t}s`).toBeLessThanOrEqual(previous.reachMargin);
      previous = current;
    }
  });

  it('rises on more than speed alone', () => {
    const early = sample(5);
    const late = sample(200);
    expect(late.speed).toBeGreaterThan(early.speed);
    expect(late.openingHalf).toBeLessThan(early.openingHalf);
    expect(late.gapSeconds).toBeLessThan(early.gapSeconds);
    expect(late.rotationSpeed).toBeGreaterThan(early.rotationSpeed);
    expect(late.oscillationAmplitude).toBeGreaterThan(early.oscillationAmplitude);
    expect(late.visualIntensity).toBeGreaterThan(early.visualIntensity);
  });

  it('keeps every derived value inside its bounds', () => {
    for (let t = 0; t <= 400; t += 0.5) {
      const state = sample(t);
      expect(state.d).toBeGreaterThanOrEqual(0);
      expect(state.d).toBeLessThanOrEqual(1);
      expect(state.speed).toBeGreaterThanOrEqual(SPEED.START);
      expect(state.speed).toBeLessThanOrEqual(SPEED.MAX);
      expect(state.spacing).toBeGreaterThanOrEqual(DIFFICULTY.SPACING_MIN);
      expect(state.spacing).toBeLessThanOrEqual(DIFFICULTY.SPACING_MAX);
      expect(state.openingHalf).toBeGreaterThanOrEqual(GENERATION.ABSOLUTE_MIN_OPENING);
      expect(state.visualIntensity).toBeLessThanOrEqual(1);
      // An opening that slides faster than the player can chase is unwinnable.
      const peakSlide = state.oscillationAmplitude * Math.PI * 2 * state.oscillationFrequency;
      expect(peakSlide).toBeLessThan(MOVEMENT.MAX_LATERAL_SPEED);
    }
  });

  it('reaches maximum speed as the OVERLOAD phase begins', () => {
    expect(manager.speedAt(DIFFICULTY.TIER_OVERLOAD_AT)).toBeCloseTo(SPEED.MAX, 6);
    expect(manager.speedAt(0)).toBe(SPEED.START);
  });

  it('uses the PRD phase boundaries', () => {
    expect(manager.tierAt(0)).toBe('INTRO');
    expect(manager.tierAt(19.9)).toBe('INTRO');
    expect(manager.tierAt(20)).toBe('BUILD');
    expect(manager.tierAt(59.9)).toBe('BUILD');
    expect(manager.tierAt(60)).toBe('INTENSE');
    expect(manager.tierAt(119.9)).toBe('INTENSE');
    expect(manager.tierAt(120)).toBe('OVERLOAD');
    expect(manager.tierAt(10_000)).toBe('OVERLOAD');
  });

  it('offers only static archetypes during the INTRO phase', () => {
    const moving = new Set(['MOVING_GATE', 'ROTATING_CROSS', 'ROTATING_RING', 'FAN', 'COMBINATION']);
    for (const [type] of TYPE_WEIGHTS.INTRO) {
      expect(moving.has(type), `${type} must not appear during INTRO`).toBe(false);
    }
    // Combinations wait for the INTENSE phase.
    expect(TYPE_WEIGHTS.BUILD.some(([type]) => type === 'COMBINATION')).toBe(false);
    expect(TYPE_WEIGHTS.INTENSE.some(([type]) => type === 'COMBINATION')).toBe(true);
  });
});

describe('distance and time', () => {
  it('inverts distance and time exactly', () => {
    for (const t of [0, 1, 17.5, 60, 119.9, 120, 200, 400]) {
      const distance = manager.distanceAt(t);
      expect(manager.timeAtDistance(distance)).toBeCloseTo(t, 6);
    }
  });

  it('matches a numerically integrated distance', () => {
    const dt = 1 / 1000;
    let integrated = 0;
    for (let t = 0; t < 90; t += dt) integrated += manager.speedAt(t) * dt;
    expect(manager.distanceAt(90)).toBeCloseTo(integrated, 0);
  });

  it('advances distance strictly monotonically', () => {
    let previous = -1;
    for (let t = 0; t <= 300; t += 0.25) {
      const distance = manager.distanceAt(t);
      expect(distance).toBeGreaterThan(previous);
      previous = distance;
    }
  });

  it('spawns obstacles outside the visible frustum', () => {
    // The spawn plane must sit beyond the far end of the fog, so nothing is
    // ever seen appearing.
    expect(Math.abs(WORLD.SPAWN_Z)).toBeGreaterThan(WORLD.SEGMENT_LENGTH * 2);
  });
});
