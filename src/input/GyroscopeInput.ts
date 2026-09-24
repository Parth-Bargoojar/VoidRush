/**
 * VOIDRUSH — tilt steering from the browser's DeviceOrientation API.
 *
 * Sensor events only record state: each valid reading is converted to a target
 * steering axis and stored. Nothing moves here. The game loop calls `update`
 * once per fixed step, which applies smoothing with that step's dt and checks
 * the sensor has not gone quiet. The player then consumes the result through
 * the same InputState as the keyboard, so there is one movement model.
 *
 * The event handler allocates nothing: every intermediate lives in a field.
 *
 * iOS and iPadOS gate the sensor behind DeviceOrientationEvent.requestPermission,
 * which only works inside a user gesture. It is never called on load; the app
 * calls `requestPermission` from the PLAY or ENABLE TILT tap.
 */

import { TILT } from '../config/TiltConfig';
import type { TiltStatus } from '../types';
import { clamp } from '../utils/MathUtils';
import {
  CalibrationAccumulator,
  DEFAULT_TUNING,
  normaliseScreenAngle,
  smoothToward,
  steeringFromUp,
  upInScreenFrame,
  vec3,
  type CalibrationResult,
  type Neutral,
  type ScreenAngle,
  type TiltTuning,
} from './tilt';

/** The shape of a deviceorientation event this module reads. */
export interface OrientationReading {
  beta: number | null;
  gamma: number | null;
}

interface Listenable {
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
}

interface PermissionGated {
  requestPermission?: () => Promise<string>;
}

/** Everything platform-specific, injectable so the class runs under Node. */
export interface TiltEnvironment {
  /** Receives `deviceorientation`. */
  sensorTarget: Listenable;
  /** Receives `orientationEvent` when the screen rotates. */
  orientationTarget: Listenable;
  orientationEvent: string;
  /** Raw screen angle as the platform reports it. */
  readScreenAngle: () => unknown;
  /** The DeviceOrientationEvent constructor, or undefined without the API. */
  sensorApi: PermissionGated | undefined;
  /** Milliseconds, monotonic. */
  now: () => number;
}

interface LegacyOrientationWindow {
  orientation?: number;
}

/** The real browser environment, or null outside a browser. */
export function browserTiltEnvironment(): TiltEnvironment | null {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { DeviceOrientationEvent?: PermissionGated })
    .DeviceOrientationEvent;
  const screenOrientation = typeof screen !== 'undefined' ? screen.orientation : undefined;
  const hasScreenOrientation =
    !!screenOrientation && typeof screenOrientation.addEventListener === 'function';
  return {
    sensorTarget: window as unknown as Listenable,
    // screen.orientation is the standard; iOS before 16.4 only has the
    // window event and window.orientation.
    orientationTarget: (hasScreenOrientation ? screenOrientation : window) as unknown as Listenable,
    orientationEvent: hasScreenOrientation ? 'change' : 'orientationchange',
    readScreenAngle: () =>
      screenOrientation && typeof screenOrientation.angle === 'number'
        ? screenOrientation.angle
        : (window as unknown as LegacyOrientationWindow).orientation,
    sensorApi: typeof api === 'function' ? api : undefined,
    now: () => performance.now(),
  };
}

export interface GyroscopeCallbacks {
  onStatusChange?: (status: TiltStatus) => void;
  /** The screen rotated; the neutral pose has been discarded. */
  onOrientationChange?: (angle: ScreenAngle) => void;
  /** The neutral pose was set or discarded. */
  onCalibrationChange?: (calibrated: boolean) => void;
}

export class GyroscopeInput {
  private readonly env: TiltEnvironment | null;
  private callbacks: GyroscopeCallbacks = {};

  private currentStatus: TiltStatus;
  private permission: 'unknown' | 'granted' | 'denied' | 'not-required';
  private listening = false;

  private angle: ScreenAngle = 0;
  private neutral: Neutral | null = null;
  private tuning: TiltTuning = { ...DEFAULT_TUNING };

  private calibrating = false;
  private readonly accumulator = new CalibrationAccumulator();

  // Per-event scratch, reused so the handler never allocates.
  private readonly up = vec3();
  private readonly deviation = { x: 0, y: 0 };
  private readonly target = { x: 0, y: 0 };
  private outX = 0;
  private outY = 0;

  private listenStartedAt = 0;
  private lastSampleAt = 0;
  private sampled = false;

  constructor(env: TiltEnvironment | null = browserTiltEnvironment()) {
    this.env = env;
    if (!env || !env.sensorApi) {
      this.currentStatus = 'unsupported';
      this.permission = 'unknown';
    } else if (typeof env.sensorApi.requestPermission === 'function') {
      this.currentStatus = 'needs-permission';
      this.permission = 'unknown';
    } else {
      this.currentStatus = 'off';
      this.permission = 'not-required';
    }
  }

  setCallbacks(callbacks: GyroscopeCallbacks): void {
    this.callbacks = callbacks;
  }

  /* -------------------------------------------------------------- *
   * State
   * -------------------------------------------------------------- */

  get status(): TiltStatus {
    return this.currentStatus;
  }

  /** Smoothed steering, each axis in [-1, 1]; +x right, +y up. */
  get x(): number {
    return this.outX;
  }

  get y(): number {
    return this.outY;
  }

  get calibrated(): boolean {
    return this.neutral !== null;
  }

  get isListening(): boolean {
    return this.listening;
  }

  get isCalibrating(): boolean {
    return this.calibrating;
  }

  get screenAngle(): ScreenAngle {
    return this.angle;
  }

  /** True when access must still be granted from a user gesture. */
  get needsPermission(): boolean {
    return this.permission !== 'granted' && this.permission !== 'not-required';
  }

  setTuning(tuning: TiltTuning): void {
    this.tuning = { ...tuning };
  }

  private setStatus(next: TiltStatus): void {
    if (next === this.currentStatus) return;
    this.currentStatus = next;
    this.callbacks.onStatusChange?.(next);
  }

  /* -------------------------------------------------------------- *
   * Permission and lifecycle
   * -------------------------------------------------------------- */

  /**
   * Asks for sensor access where the platform requires it. MUST be called
   * synchronously from a user gesture: the platform call is made before this
   * returns. Resolves true when tilt may be used; never rejects.
   */
  requestPermission(): Promise<boolean> {
    const api = this.env?.sensorApi;
    if (!api) return Promise.resolve(false);
    if (typeof api.requestPermission !== 'function' || this.permission === 'granted') {
      if (this.permission !== 'granted') this.permission = 'not-required';
      return Promise.resolve(true);
    }

    let pending: Promise<string>;
    try {
      pending = api.requestPermission();
    } catch {
      this.deny();
      return Promise.resolve(false);
    }
    return Promise.resolve(pending).then(
      (result) => {
        if (result === 'granted') {
          this.permission = 'granted';
          if (this.currentStatus === 'needs-permission' || this.currentStatus === 'denied') {
            this.setStatus('off');
          }
          return true;
        }
        this.deny();
        return false;
      },
      () => {
        this.deny();
        return false;
      },
    );
  }

  private deny(): void {
    this.permission = 'denied';
    this.stop();
    this.setStatus('denied');
  }

  /**
   * Starts listening. Returns false where that cannot work yet: no API, or
   * access not granted. Safe to call repeatedly; never adds a second listener.
   */
  start(): boolean {
    const env = this.env;
    if (!env || !env.sensorApi) return false;
    if (this.needsPermission) return false;
    if (this.listening) return true;

    this.listening = true;
    this.angle = normaliseScreenAngle(env.readScreenAngle());
    this.sampled = false;
    this.listenStartedAt = env.now();
    env.sensorTarget.addEventListener('deviceorientation', this.handleReading);
    env.orientationTarget.addEventListener(env.orientationEvent, this.handleRotation);
    this.setStatus('waiting');
    return true;
  }

  /** Stops listening and releases both listeners. Keeps the neutral pose. */
  stop(): void {
    const env = this.env;
    if (this.listening && env) {
      env.sensorTarget.removeEventListener('deviceorientation', this.handleReading);
      env.orientationTarget.removeEventListener(env.orientationEvent, this.handleRotation);
    }
    this.listening = false;
    this.calibrating = false;
    this.target.x = 0;
    this.target.y = 0;
    this.outX = 0;
    this.outY = 0;
    if (
      this.currentStatus === 'waiting' ||
      this.currentStatus === 'active' ||
      this.currentStatus === 'lost'
    ) {
      this.setStatus('off');
    }
  }

  /**
   * Stops listening and clears a previous "no sensor" verdict so the next
   * `start` probes again. A refusal stays until permission is asked again.
   */
  reset(): void {
    this.stop();
    if (this.currentStatus === 'unavailable') {
      this.setStatus(this.needsPermission ? 'needs-permission' : 'off');
    }
  }

  /**
   * Gives up on tilt for the rest of the session: the sensor never answered,
   * or the player chose touch instead after it failed.
   */
  markUnavailable(): void {
    this.stop();
    this.setStatus('unavailable');
  }

  dispose(): void {
    this.stop();
    this.callbacks = {};
  }

  /* -------------------------------------------------------------- *
   * Calibration
   * -------------------------------------------------------------- */

  /** Starts collecting readings for a new neutral pose. Output drops to zero. */
  beginCalibration(): void {
    this.accumulator.reset();
    this.calibrating = true;
    this.target.x = 0;
    this.target.y = 0;
    this.outX = 0;
    this.outY = 0;
  }

  /**
   * Ends collection. A steady result becomes the neutral pose; an unsteady one
   * does too when `acceptUnsteady` is set (the player has already been asked
   * to hold still more than once). No signal never changes the neutral pose.
   */
  finishCalibration(acceptUnsteady = false): CalibrationResult {
    this.calibrating = false;
    const result = this.accumulator.result();
    if (result.ok || (result.reason === 'unsteady' && acceptUnsteady)) {
      this.neutral = { roll: result.neutral.roll, pitch: result.neutral.pitch };
      this.callbacks.onCalibrationChange?.(true);
    }
    return result;
  }

  cancelCalibration(): void {
    this.calibrating = false;
    this.accumulator.reset();
  }

  /** Discards the neutral pose; steering stays at zero until recalibrated. */
  invalidateCalibration(): void {
    const had = this.neutral !== null;
    this.neutral = null;
    this.target.x = 0;
    this.target.y = 0;
    if (had) this.callbacks.onCalibrationChange?.(false);
  }

  /* -------------------------------------------------------------- *
   * Per-step update, called from the game loop
   * -------------------------------------------------------------- */

  /**
   * Advances smoothing by `dt` seconds and checks for a silent sensor. Cheap
   * enough to run every fixed step.
   */
  update(dt: number): void {
    if (this.listening && this.env) {
      const time = this.env.now();
      if (!this.sampled) {
        if (time - this.listenStartedAt > TILT.PROBE_TIMEOUT_MS) {
          // The API exists but nothing is behind it (a desktop browser).
          this.markUnavailable();
          return;
        }
      } else if (time - this.lastSampleAt > TILT.SENSOR_TIMEOUT_MS) {
        this.target.x = 0;
        this.target.y = 0;
        this.setStatus('lost');
      }
    }
    // Returning toward neutral, or losing the sensor, decelerates smoothly.
    this.outX = clamp(smoothToward(this.outX, this.target.x, dt, TILT.SMOOTHING_TAU), -1, 1);
    this.outY = clamp(smoothToward(this.outY, this.target.y, dt, TILT.SMOOTHING_TAU), -1, 1);
  }

  /** Zeroes the smoothed output, e.g. on pause, resume and restart. */
  resetOutput(): void {
    this.outX = 0;
    this.outY = 0;
  }

  /* -------------------------------------------------------------- *
   * Event handlers
   * -------------------------------------------------------------- */

  /** Exposed for tests; the browser calls it through the listener. */
  readonly handleReading = (event: OrientationReading): void => {
    if (!this.listening || !this.env) return;
    if (!upInScreenFrame(event.beta, event.gamma, this.angle, this.up)) return;

    this.sampled = true;
    this.lastSampleAt = this.env.now();
    if (this.currentStatus !== 'active') this.setStatus('active');

    if (this.calibrating) {
      this.accumulator.add(this.up);
      return;
    }
    if (this.neutral === null) {
      this.target.x = 0;
      this.target.y = 0;
      return;
    }
    steeringFromUp(this.up, this.neutral, this.tuning, this.deviation, this.target);
  };

  /** Exposed for tests; the browser calls it when the screen rotates. */
  readonly handleRotation = (): void => {
    if (!this.env) return;
    const next = normaliseScreenAngle(this.env.readScreenAngle());
    if (next === this.angle) return;
    this.angle = next;
    // Readings taken in the old orientation are meaningless in the new one.
    if (this.calibrating) this.accumulator.reset();
    this.invalidateCalibration();
    this.resetOutput();
    this.callbacks.onOrientationChange?.(next);
  };
}
