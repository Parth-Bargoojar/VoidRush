/**
 * Run lifecycle around the edges of play: the menu background, returning to
 * the menu after a run, and the timing of the collision feedback.
 */

import { describe, expect, it } from 'vitest';
import { IMPACT, TIMING, WORLD } from '../src/config/GameConfig';
import { TUNNEL } from '../src/config/TunnelConfig';
import { Game, stepsForSeconds } from '../src/game/Game';
import type { InputState } from '../src/types';
import { AutopilotBot, DT, runBot } from './helpers';

const IDLE_INPUT: InputState = { up: false, down: false, left: false, right: false };

/** Pins the player into a corner until the next obstacle ends the run. */
function crash(game: Game): number {
  const corner: InputState = { up: true, down: false, left: true, right: false };
  for (let i = 0; i < stepsForSeconds(120); i += 1) {
    game.step(DT, corner);
    if (game.phase !== 'FLYING') return i;
  }
  throw new Error('run never ended');
}

/** True when some segment spans the plane just ahead of the camera. */
function tunnelSurroundsCamera(game: Game): boolean {
  const distance = game.renderDistance;
  return game.world.tunnel.segments.some((segment) => {
    const near = segment.zAt(distance);
    const far = near - WORLD.SEGMENT_LENGTH;
    return near >= -1 && far <= -1;
  });
}

describe('[PRD Screen 1] menu background', () => {
  it('drifts forward while idle', () => {
    const game = new Game({ seed: 4 });
    const before = game.renderDistance;
    for (let i = 0; i < stepsForSeconds(2); i += 1) game.step(DT, IDLE_INPUT);
    expect(game.phase).toBe('IDLE');
    expect(game.renderDistance).toBeGreaterThan(before);
    expect(tunnelSurroundsCamera(game)).toBe(true);
  });

  it('comes back as a surrounding tunnel after a run, not an empty void', () => {
    const game = new Game({ seed: 8 });
    game.startRun(8);
    runBot(game, new AutopilotBot(8), 40);
    expect(game.distance).toBeGreaterThan(1000);

    game.returnToMenu();
    expect(game.phase).toBe('IDLE');
    expect(tunnelSurroundsCamera(game)).toBe(true);
    expect(game.player.x).toBe(0);
    expect(game.player.y).toBe(0);
    // The phase palette and effects fade back to their opening values.
    expect(game.state.tier).toBe('INTRO');
    expect(game.world.activeCount).toBe(0);

    // And it keeps drifting from there.
    const start = game.renderDistance;
    for (let i = 0; i < stepsForSeconds(1); i += 1) game.step(DT, IDLE_INPUT);
    expect(game.renderDistance).toBeGreaterThan(start);
    expect(tunnelSurroundsCamera(game)).toBe(true);
  });

  it('shows the calm opening tunnel behind the menu', () => {
    const game = new Game({ seed: 12 });
    expect(game.world.tunnel.profile.isMenu).toBe(true);
    game.startRun(12);
    expect(game.world.tunnel.profile.isMenu).toBe(false);
    game.returnToMenu();
    expect(game.world.tunnel.profile.isMenu).toBe(true);
    const keyframe = game.world.tunnel.profile.keyframe(0);
    expect(keyframe.halfWidth).toBe(TUNNEL.WIDTH_START);
  });
});

describe('[PRD 11] collision feedback', () => {
  it('reports no impact while flying', () => {
    const game = new Game({ seed: 21 });
    game.startRun(21);
    for (let i = 0; i < 120; i += 1) game.step(DT, IDLE_INPUT);
    expect(game.impactProgress).toBe(0);
  });

  it('plays out over 0.7-1.2 s, rising steadily, and holds once the run has ended', () => {
    const game = new Game({ seed: 21 });
    game.startRun(21);
    crash(game);
    expect(game.phase).toBe('IMPACT');

    let previous = game.impactProgress;
    let steps = 0;
    while (game.phase === 'IMPACT') {
      game.step(DT, IDLE_INPUT);
      steps += 1;
      expect(game.impactProgress).toBeGreaterThanOrEqual(previous);
      previous = game.impactProgress;
    }
    const seconds = steps * TIMING.FIXED_DT;
    expect(seconds).toBeGreaterThanOrEqual(0.7);
    expect(seconds).toBeLessThanOrEqual(1.2);
    expect(seconds).toBeCloseTo(IMPACT.TOTAL_SECONDS, 1);
    expect(game.phase).toBe('ENDED');
    expect(game.impactProgress).toBe(1);
  });

  it('clears the impact state for the next run', () => {
    const game = new Game({ seed: 21 });
    game.startRun(21);
    crash(game);
    while (game.phase === 'IMPACT') game.step(DT, IDLE_INPUT);
    game.startRun(22);
    expect(game.impactProgress).toBe(0);
  });
});
