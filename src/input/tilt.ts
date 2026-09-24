/**
 * VOIDRUSH — tilt steering maths, free of the DOM so every step is testable.
 *
 * Why not use `beta`/`gamma` directly: they are Euler angles, and in landscape
 * the axis that matters (gamma) is only defined over ±90°. A phone held upright
 * sideways sits right on that seam, where gamma jumps from -90 to +90 and beta
 * flips by 180. Instead each reading is turned into the direction of "up" in the
 * device's own frame, which has no seams, then rotated into the screen's frame
 * using the current screen orientation. Roll and pitch are measured from that
 * vector, so they are continuous in every orientation a person plays in.
 *
 * Screen frame: +x to the right of the screen as the player sees it, +y to the
 * top of the screen, +z out of the glass toward the player.
 */

import { TILT } from '../config/TiltConfig';
import { clamp } from '../utils/MathUtils';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Screen rotation relative to the device's natural orientation. */
export type ScreenAngle = 0 | 90 | 180 | 270;

/**
 * Normalises any angle the platform reports (`screen.orientation.angle` gives
 * 0/90/180/270, iOS `window.orientation` gives 0/90/-90/180) to a quarter turn.
 * Anything unreadable is treated as the natural orientation.
 */
export function normaliseScreenAngle(raw: unknown): ScreenAngle {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  const quarter = Math.round(raw / 90);
  const wrapped = ((quarter % 4) + 4) % 4;
  return (wrapped * 90) as ScreenAngle;
}

/** A mutable 3-vector, reused across sensor events so none allocates. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

/**
 * Writes the world "up" direction, expressed in the screen frame, into `out`.
 *
 * DeviceOrientation composes R = Rz(alpha)·Rx(beta)·Ry(gamma) from device to
 * earth frame. Up in device coordinates is the third row of R, which does not
 * depend on alpha: (-cos b · sin g, sin b, cos b · cos g). Alpha is therefore
 * never read, so devices that report it as null still work.
 *
 * Returns false, leaving `out` untouched, for a missing or non-finite reading.
 */
export function upInScreenFrame(
  beta: number | null | undefined,
  gamma: number | null | undefined,
  angle: ScreenAngle,
  out: Vec3,
): boolean {
  if (typeof beta !== 'number' || typeof gamma !== 'number') return false;
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return false;

  const cb = Math.cos(beta * DEG);
  const dx = -cb * Math.sin(gamma * DEG);
  const dy = Math.sin(beta * DEG);
  const dz = cb * Math.cos(gamma * DEG);

  // Rotate the device x/y plane into the screen's. At 90 the device has been
  // turned a quarter counter-clockwise: its top edge is on the player's left
  // and its right edge is now the top of the screen.
  switch (angle) {
    case 90:
      out.x = -dy;
      out.y = dx;
      break;
    case 180:
      out.x = -dx;
      out.y = -dy;
      break;
    case 270:
      out.x = dy;
      out.y = -dx;
      break;
    default:
      out.x = dx;
      out.y = dy;
  }
  out.z = dz;
  return true;
}

/**
 * Roll: degrees the screen's right edge sits below horizontal. Seam-free
 * because it is an arcsine of one component, defined for every pose.
 */
export function rollOf(up: Vec3): number {
  return Math.asin(clamp(-up.x, -1, 1)) * RAD;
}

/**
 * Pitch: degrees the screen is raised from lying flat, measured in the plane
 * of the screen's vertical axis. 0 flat on a table, 90 held upright. Unaffected
 * by roll, because roll scales y and z together.
 */
export function pitchOf(up: Vec3): number {
  return Math.atan2(up.y, up.z) * RAD;
}

/** Wraps an angle difference into (-180, 180]. */
export function wrapDegrees(degrees: number): number {
  let d = degrees % 360;
  if (d > 180) d -= 360;
  else if (d <= -180) d += 360;
  return d;
}

/** The held position subtracted from every reading. Never persisted. */
export interface Neutral {
  roll: number;
  pitch: number;
}

/**
 * Tilt away from neutral, in degrees, as steering directions:
 * +horizontal when the right edge is lowered, +vertical when the top edge is
 * lowered (tipped away from the player). Lower an edge to fly toward it.
 */
export function deviationFrom(up: Vec3, neutral: Neutral, out: { x: number; y: number }): void {
  out.x = rollOf(up) - neutral.roll;
  out.y = -wrapDegrees(pitchOf(up) - neutral.pitch);
}

/** The player-tunable part of the response. */
export interface TiltTuning {
  sensitivity: number;
  deadZone: number;
  invertX: boolean;
  invertY: boolean;
}

export const DEFAULT_TUNING: Readonly<TiltTuning> = Object.freeze({
  sensitivity: TILT.SENSITIVITY_DEFAULT,
  deadZone: TILT.DEAD_ZONE_DEFAULT,
  invertX: false,
  invertY: false,
});

/**
 * One axis of the response: dead zone, sensitivity, curve, clamp.
 *
 * Inside the dead zone the output is exactly zero. Past it the magnitude is
 * rescaled from zero, so leaving the dead zone never produces a jump, and it
 * reaches 1 at MAX_TILT / sensitivity. The power curve then keeps small tilts
 * precise and saves full speed for a deliberate lean.
 */
export function shapeAxis(
  degrees: number,
  deadZone: number,
  sensitivity: number,
  exponent: number = TILT.RESPONSE_EXPONENT,
  maxTilt: number = TILT.MAX_TILT,
): number {
  const magnitude = Math.abs(degrees);
  const zone = clamp(Number.isFinite(deadZone) ? deadZone : 0, 0, maxTilt);
  // `!(a > b)` is also true for NaN, so a bad reading can only ever yield 0.
  if (!(magnitude > zone)) return 0;
  const gain = clamp(
    Number.isFinite(sensitivity) ? sensitivity : 1,
    TILT.SENSITIVITY_MIN,
    TILT.SENSITIVITY_MAX,
  );
  const span = Math.max(maxTilt / gain - zone, TILT.MIN_RESPONSE_SPAN);
  const normalised = Math.min((magnitude - zone) / span, 1);
  const shaped = Math.pow(normalised, exponent);
  return degrees < 0 ? -shaped : shaped;
}

/**
 * The full per-reading transform, from a screen-frame up vector to the target
 * steering axis in [-1, 1]. Smoothing happens later, in the game loop.
 */
export function steeringFromUp(
  up: Vec3,
  neutral: Neutral,
  tuning: TiltTuning,
  deviation: { x: number; y: number },
  out: { x: number; y: number },
): void {
  deviationFrom(up, neutral, deviation);
  const x = shapeAxis(deviation.x, tuning.deadZone, tuning.sensitivity);
  const y = shapeAxis(deviation.y, tuning.deadZone, tuning.sensitivity);
  out.x = tuning.invertX ? -x : x;
  out.y = tuning.invertY ? -y : y;
}

/**
 * Frame-rate independent low-pass: moves `current` toward `target` by the
 * fraction a first-order filter with time constant `tau` would cover in `dt`.
 */
export function smoothToward(current: number, target: number, dt: number, tau: number): number {
  if (!(dt > 0)) return current;
  if (!(tau > 0)) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

export interface CalibrationResult {
  ok: boolean;
  /** Why it failed: no readings arrived, or the device was moving. */
  reason: 'ok' | 'no-signal' | 'unsteady';
  samples: number;
  /** Approximate angular standard deviation of the samples, in degrees. */
  spread: number;
  neutral: Neutral;
}

/**
 * Averages readings into a neutral pose.
 *
 * The up vectors are averaged rather than the angles, so there is no wrap-around
 * to get wrong. The length of the mean of unit vectors also measures how still
 * the device was (circular statistics: spread ≈ sqrt(2·(1 − |mean|))), so no
 * sample has to be stored.
 */
export class CalibrationAccumulator {
  private sx = 0;
  private sy = 0;
  private sz = 0;
  private n = 0;

  reset(): void {
    this.sx = 0;
    this.sy = 0;
    this.sz = 0;
    this.n = 0;
  }

  add(up: Vec3): void {
    const length = Math.hypot(up.x, up.y, up.z);
    if (!(length > 0) || !Number.isFinite(length)) return;
    this.sx += up.x / length;
    this.sy += up.y / length;
    this.sz += up.z / length;
    this.n += 1;
  }

  get count(): number {
    return this.n;
  }

  result(
    minSamples: number = TILT.CALIBRATION_MIN_SAMPLES,
    maxSpread: number = TILT.CALIBRATION_MAX_SPREAD,
  ): CalibrationResult {
    if (this.n < Math.max(1, minSamples)) {
      return {
        ok: false,
        reason: 'no-signal',
        samples: this.n,
        spread: 0,
        neutral: { roll: 0, pitch: 0 },
      };
    }
    const mean = { x: this.sx / this.n, y: this.sy / this.n, z: this.sz / this.n };
    const resultant = Math.min(1, Math.hypot(mean.x, mean.y, mean.z));
    const spread = Math.sqrt(Math.max(0, 2 * (1 - resultant))) * RAD;
    const neutral = { roll: rollOf(mean), pitch: pitchOf(mean) };
    // rollOf assumes a unit vector; the mean is shorter when the device moved.
    if (resultant > 0) neutral.roll = Math.asin(clamp(-mean.x / resultant, -1, 1)) * RAD;
    const steady = spread <= maxSpread;
    return {
      ok: steady,
      reason: steady ? 'ok' : 'unsteady',
      samples: this.n,
      spread,
      neutral,
    };
  }
}
