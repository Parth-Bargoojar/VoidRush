/**
 * VOIDRUSH — reachability proof.
 *
 * No obstacle reaches the world without passing through here. The proof has two
 * independent halves, and both must succeed:
 *
 *  1. An analytic envelope check. Starting from the centre of the previous
 *     obstacle's opening — where the player provably was, since they survived
 *     it — with zero velocity, and charging two time constants for accelerating
 *     and settling, can the player reach this opening in the time available?
 *
 *  2. A direct geometric check against the actual collision volumes at the
 *     crossing time and at both edges of the timing window. This catches any
 *     disagreement between an archetype's declared opening and the geometry it
 *     really built, which is the failure mode an analytic check alone would
 *     miss.
 *
 * Time-varying obstacles are evaluated at the predicted crossing time, and must
 * stay valid across a +/-0.12 s window so the player is never asked to be
 * frame-perfect.
 */

import { GENERATION, WORLD } from '../config/GameConfig';
import type { Opening } from '../types';
import { CombinationObstacle } from './CombinationObstacle';
import type { BaseObstacle } from './Obstacle';
import { OPENING_BOUND } from './shapes';

export interface ReachabilityRequest {
  /** Opening centre of the previously committed obstacle. */
  prevX: number;
  prevY: number;
  /** Crossing time of the previously committed obstacle. */
  prevTCross: number;
  /** Effective lateral speed, already scaled by the sensitivity setting. */
  lateralSpeed: number;
  /** Movement response time constant. */
  tau: number;
  /** Extra clearance beyond the player radius demanded at this difficulty. */
  reachMargin: number;
}

export interface ReachabilityResult {
  ok: boolean;
  /** Where the player will be after clearing this obstacle. */
  exitX: number;
  exitY: number;
  exitHalf: number;
  /**
   * When the player leaves the obstacle. For a plain body this is its crossing
   * time; for a combination it is the last layer's, which is later than the
   * combination's centre. The next obstacle must be planned from this.
   */
  exitTCross: number;
  /** Populated when `ok` is false; used by tests and diagnostics. */
  reason: string;
}

const FAIL_UNREACHABLE = 'unreachable';
const FAIL_TOO_TIGHT = 'opening-too-tight';
const FAIL_OUT_OF_BOX = 'opening-outside-clamp-box';
const FAIL_GEOMETRY = 'geometry-blocks-opening';
const FAIL_NO_OPENING = 'no-openings';

/**
 * The furthest the player can be asked to travel on one axis in `travel`
 * seconds, conservatively: from rest, charged two time constants, then derated
 * by the safety factor.
 */
export function reachBudget(travel: number, lateralSpeed: number, tau: number): number {
  const usable = Math.max(0, travel - GENERATION.REACH_TAU_CHARGE * tau);
  return lateralSpeed * usable * GENERATION.REACH_SAFETY;
}

/** Largest displacement of an opening's centre across the crossing window. */
function windowDrift(
  obstacle: BaseObstacle,
  openingIndex: number,
  tCross: number,
): { dx: number; dy: number; radial: number } {
  const base = obstacle.getOpenings(tCross)[openingIndex];
  if (!base) return { dx: 0, dy: 0, radial: 0 };
  let dx = 0;
  let dy = 0;
  let radial = 0;
  for (const offset of [-GENERATION.TIMING_WINDOW, GENERATION.TIMING_WINDOW]) {
    const sample = obstacle.getOpenings(tCross + offset)[openingIndex];
    if (!sample) continue;
    const ex = Math.abs(sample.cx - base.cx);
    const ey = Math.abs(sample.cy - base.cy);
    dx = Math.max(dx, ex);
    dy = Math.max(dy, ey);
    radial = Math.max(radial, Math.hypot(ex, ey));
  }
  return { dx, dy, radial };
}

/** The opening that actually survives the crossing window. */
function effectiveOpening(
  opening: Opening,
  drift: { dx: number; dy: number; radial: number },
): { hx: number; hy: number } {
  if (opening.shape === 'circle') {
    const r = opening.hx - drift.radial;
    return { hx: r, hy: r };
  }
  return { hx: opening.hx - drift.dx, hy: opening.hy - drift.dy };
}

/**
 * Validates one body against one starting point. Combinations recurse through
 * this per layer, chaining the start point from the layer before.
 */
function validateBody(
  obstacle: BaseObstacle,
  tCross: number,
  request: ReachabilityRequest,
): ReachabilityResult {
  const travel = tCross - request.prevTCross;
  const budget = reachBudget(travel, request.lateralSpeed, request.tau);
  const required = WORLD.PLAYER_RADIUS + request.reachMargin;

  const openings = obstacle.getOpenings(tCross);
  if (openings.length === 0) {
    return { ok: false, exitX: 0, exitY: 0, exitHalf: 0, exitTCross: tCross, reason: FAIL_NO_OPENING };
  }

  let lastReason = FAIL_UNREACHABLE;

  for (let i = 0; i < openings.length; i += 1) {
    const opening = openings[i]!;
    const drift = windowDrift(obstacle, i, tCross);
    const effective = effectiveOpening(opening, drift);
    const half = Math.min(effective.hx, effective.hy);

    if (half < required) {
      lastReason = FAIL_TOO_TIGHT;
      continue;
    }
    if (Math.abs(opening.cx) + half > OPENING_BOUND || Math.abs(opening.cy) + half > OPENING_BOUND) {
      lastReason = FAIL_OUT_OF_BOX;
      continue;
    }
    if (
      Math.abs(opening.cx - request.prevX) > budget ||
      Math.abs(opening.cy - request.prevY) > budget
    ) {
      lastReason = FAIL_UNREACHABLE;
      continue;
    }

    // Independent geometric proof: a player sphere parked at the opening centre
    // must clear real geometry at both window edges and at the crossing itself.
    let blocked = false;
    for (const offset of [-GENERATION.TIMING_WINDOW, 0, GENERATION.TIMING_WINDOW]) {
      const clearance = obstacle.distanceToSolid(opening.cx, opening.cy, 0, tCross + offset, 0);
      if (clearance < WORLD.PLAYER_RADIUS) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      lastReason = FAIL_GEOMETRY;
      continue;
    }

    return {
      ok: true,
      exitX: opening.cx,
      exitY: opening.cy,
      exitHalf: half,
      exitTCross: tCross,
      reason: '',
    };
  }

  return { ok: false, exitX: 0, exitY: 0, exitHalf: 0, exitTCross: tCross, reason: lastReason };
}

/**
 * Proves that `obstacle` is passable given where the player must have been.
 * Combination bodies are chained layer by layer, so each sub-layer inherits the
 * exit point of the one before it.
 */
export function validateReachability(
  obstacle: BaseObstacle,
  tCross: number,
  request: ReachabilityRequest,
): ReachabilityResult {
  if (obstacle instanceof CombinationObstacle) {
    let cursor: ReachabilityRequest = request;
    let result: ReachabilityResult = {
      ok: false,
      exitX: request.prevX,
      exitY: request.prevY,
      exitHalf: 0,
      exitTCross: tCross,
      reason: FAIL_NO_OPENING,
    };
    for (const layer of obstacle.layers) {
      result = validateBody(layer.obstacle, layer.tCross, cursor);
      if (!result.ok) return result;
      cursor = {
        ...cursor,
        prevX: result.exitX,
        prevY: result.exitY,
        prevTCross: layer.tCross,
      };
    }
    return result;
  }

  return validateBody(obstacle, tCross, request);
}
