/**
 * VOIDRUSH — difficulty curve and the speed/distance relationship.
 *
 * Forward speed is a closed-form function of elapsed time, so distance
 * travelled and the time at which any obstacle reaches the player are both
 * exactly solvable. That exactness is what the reachability proof rests on: the
 * generator can ask "when will the player arrive?" and get an answer that the
 * simulation will then reproduce to the last decimal.
 */

import {
  DIFFICULTY,
  oscillationPeakSpeedFor,
  rotationSpeedFor,
} from '../config/DifficultyConfig';
import { GENERATION, SPEED, WORLD } from '../config/GameConfig';
import { TUNNEL } from '../config/TunnelConfig';
import { clamp, lerp, smoothstep } from '../utils/MathUtils';
import type { DifficultyState, DifficultyTier } from '../types';

/** Time at which the speed ramp saturates at SPEED.MAX. */
const SATURATION_TIME = (SPEED.MAX - SPEED.START) / SPEED.RAMP;
/** Distance covered by the time the ramp saturates. */
const SATURATION_DISTANCE =
  SPEED.START * SATURATION_TIME + (SPEED.RAMP * SATURATION_TIME * SATURATION_TIME) / 2;

export class DifficultyManager {
  /** [PRD 3] Forward speed at `time` seconds of survival. */
  speedAt(time: number): number {
    return Math.min(SPEED.MAX, SPEED.START + SPEED.RAMP * Math.max(0, time));
  }

  /** Exact distance travelled after `time` seconds. */
  distanceAt(time: number): number {
    const t = Math.max(0, time);
    if (t <= SATURATION_TIME) {
      return SPEED.START * t + (SPEED.RAMP * t * t) / 2;
    }
    return SATURATION_DISTANCE + SPEED.MAX * (t - SATURATION_TIME);
  }

  /** Inverse of `distanceAt`: when will the run have covered `distance`? */
  timeAtDistance(distance: number): number {
    const d = Math.max(0, distance);
    if (d <= SATURATION_DISTANCE) {
      // (RAMP/2) t^2 + START t - d = 0
      const a = SPEED.RAMP / 2;
      const b = SPEED.START;
      return (-b + Math.sqrt(b * b + 4 * a * d)) / (2 * a);
    }
    return SATURATION_TIME + (d - SATURATION_DISTANCE) / SPEED.MAX;
  }

  /** The normalised difficulty scalar, eased. */
  normalised(time: number): number {
    return smoothstep(clamp(time / DIFFICULTY.RAMP_SECONDS, 0, 1));
  }

  /**
   * Difficulty beyond the main ramp. Zero until RAMP_SECONDS, then rising for
   * the rest of the run toward (never reaching) 1. See DIFFICULTY.OVERDRIVE_TAU.
   */
  overdriveAt(time: number): number {
    const over = time - DIFFICULTY.RAMP_SECONDS;
    if (over <= 0) return 0;
    return 1 - Math.exp(-over / DIFFICULTY.OVERDRIVE_TAU);
  }

  /** [PRD 17] Phase boundaries are expressed in seconds of survival. */
  tierAt(time: number): DifficultyTier {
    if (time < DIFFICULTY.TIER_BUILD_AT) return 'INTRO';
    if (time < DIFFICULTY.TIER_INTENSE_AT) return 'BUILD';
    if (time < DIFFICULTY.TIER_OVERLOAD_AT) return 'INTENSE';
    return 'OVERLOAD';
  }

  /** Every derived parameter for the given moment in the run. */
  stateAt(time: number, out: DifficultyState): DifficultyState {
    const d = this.normalised(time);
    const speed = this.speedAt(time);
    const gapSeconds = lerp(DIFFICULTY.GAP_SECONDS_START, DIFFICULTY.GAP_SECONDS_END, d);
    const amplitude = lerp(
      DIFFICULTY.OSCILLATION_AMPLITUDE_START,
      DIFFICULTY.OSCILLATION_AMPLITUDE_END,
      d,
    );
    const overdrive = this.overdriveAt(time);
    const peakSpeed = oscillationPeakSpeedFor(d, overdrive);

    out.d = d;
    out.overdrive = overdrive;
    out.tier = this.tierAt(time);
    out.speed = speed;
    out.gapSeconds = gapSeconds;
    // [PRD 20] Spacing follows from speed and required reaction time rather
    // than being a fixed distance, and never drops below the floor.
    out.spacing = clamp(speed * gapSeconds, DIFFICULTY.SPACING_MIN, DIFFICULTY.SPACING_MAX);
    out.openingHalf = Math.max(
      lerp(DIFFICULTY.OPENING_HALF_START, DIFFICULTY.OPENING_HALF_END, d),
      GENERATION.ABSOLUTE_MIN_OPENING,
    );
    out.reachMargin = lerp(DIFFICULTY.REACH_MARGIN_START, DIFFICULTY.REACH_MARGIN_END, d);
    out.rotationSpeed = rotationSpeedFor(d, overdrive);
    out.oscillationAmplitude = amplitude;
    out.oscillationFrequency = peakSpeed / (Math.PI * 2 * amplitude);
    // [PRD 17] A large tunnel in INTRO that narrows as the run intensifies.
    out.tunnelWidth = lerp(TUNNEL.WIDTH_START, TUNNEL.WIDTH_END, d);
    out.visualIntensity = lerp(
      DIFFICULTY.VISUAL_INTENSITY_START,
      DIFFICULTY.VISUAL_INTENSITY_END,
      d,
    );
    return out;
  }
}

export function createDifficultyState(): DifficultyState {
  return {
    d: 0,
    overdrive: 0,
    tier: 'INTRO',
    speed: SPEED.START,
    spacing: DIFFICULTY.SPACING_MIN,
    gapSeconds: DIFFICULTY.GAP_SECONDS_START,
    openingHalf: DIFFICULTY.OPENING_HALF_START,
    reachMargin: DIFFICULTY.REACH_MARGIN_START,
    rotationSpeed: DIFFICULTY.ROTATION_SPEED_START,
    oscillationAmplitude: DIFFICULTY.OSCILLATION_AMPLITUDE_START,
    oscillationFrequency: 0,
    tunnelWidth: TUNNEL.WIDTH_START,
    visualIntensity: DIFFICULTY.VISUAL_INTENSITY_START,
  };
}

/** Distance the world must be generated ahead of the player. */
export const GENERATION_HORIZON =
  Math.abs(WORLD.SPAWN_Z) + DIFFICULTY.SPACING_MAX * WORLD.GENERATION_LOOKAHEAD;
