/**
 * VOIDRUSH — player movement.
 *
 * [PRD 2] Movement uses acceleration, velocity, damping and a maximum speed;
 * the player never teleports. The damping coefficient of 10 is expressed as the
 * time constant of a critically damped approach, TAU = 1/10 s, which makes the
 * response frame-rate independent instead of merely frame-rate tolerant.
 */

import { MOVEMENT, WORLD } from '../config/GameConfig';
import { clamp, damp } from '../utils/MathUtils';
import type { InputState, NormalizedInput, Player } from '../types';

export function createPlayer(): Player {
  return { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0 };
}

export function resetPlayer(player: Player): void {
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.prevX = 0;
  player.prevY = 0;
}

/** Effective top speed once the sensitivity setting is applied. */
export function effectiveLateralSpeed(sensitivity: number): number {
  const clamped = clamp(sensitivity, MOVEMENT.SENSITIVITY_MIN, MOVEMENT.SENSITIVITY_MAX);
  return MOVEMENT.MAX_LATERAL_SPEED * clamped;
}

/**
 * Reduces any input to normalised steering. This is the single point where
 * sources meet: digital keys give a unit direction (diagonals scaled by
 * 1/sqrt 2 so they are never faster than straight), analog sources (joystick,
 * tilt) add to it, and the sum is clamped to unit length so mixing sources can
 * never beat the top speed. The player controller only ever sees the result.
 */
export function readSteering(input: InputState, out: NormalizedInput): NormalizedInput {
  let dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dirY = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  if (dirX !== 0 && dirY !== 0) {
    const inv = Math.SQRT1_2;
    dirX *= inv;
    dirY *= inv;
  }

  const axisX = input.axisX ?? 0;
  const axisY = input.axisY ?? 0;
  if (axisX !== 0 || axisY !== 0) {
    dirX += clamp(axisX, -1, 1);
    dirY += clamp(axisY, -1, 1);
    const length = Math.hypot(dirX, dirY);
    if (length > 1) {
      dirX /= length;
      dirY /= length;
    }
  }

  out.horizontal = dirX;
  out.vertical = dirY;
  return out;
}

/** Scratch for stepPlayer, so a step allocates nothing. */
const steering: NormalizedInput = { horizontal: 0, vertical: 0 };

/**
 * Advances the player by one fixed step from normalised steering, so movement
 * is identical whether it came from keys, the joystick or tilt.
 */
export function stepPlayer(
  player: Player,
  input: InputState,
  dt: number,
  sensitivity: number,
): void {
  player.prevX = player.x;
  player.prevY = player.y;

  const { horizontal: dirX, vertical: dirY } = readSteering(input, steering);

  const maxSpeed = effectiveLateralSpeed(sensitivity);
  player.vx = damp(player.vx, dirX * maxSpeed, MOVEMENT.TAU, dt);
  player.vy = damp(player.vy, dirY * maxSpeed, MOVEMENT.TAU, dt);

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // [PRD] The player cannot leave the tunnel boundaries. Velocity is zeroed on
  // the clamped axis so the player rests against the wall rather than bouncing.
  const limit = WORLD.PLAYER_CLAMP;
  if (player.x > limit) {
    player.x = limit;
    player.vx = 0;
  } else if (player.x < -limit) {
    player.x = -limit;
    player.vx = 0;
  }
  if (player.y > limit) {
    player.y = limit;
    player.vy = 0;
  } else if (player.y < -limit) {
    player.y = -limit;
    player.vy = 0;
  }
}

export const EMPTY_INPUT: InputState = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  axisX: 0,
  axisY: 0,
});
