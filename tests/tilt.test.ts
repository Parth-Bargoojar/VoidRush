/**
 * Tilt steering: the sensor maths, calibration, and the GyroscopeInput source
 * driven by a fake environment and clock. Everything here is deterministic; no
 * test depends on a real sensor or a real timer.
 */

import { describe, expect, it, vi } from 'vitest';
import { TILT } from '../src/config/TiltConfig';
import { GyroscopeInput, type TiltEnvironment } from '../src/input/GyroscopeInput';
import {
  CalibrationAccumulator,
  DEFAULT_TUNING,
  normaliseScreenAngle,
  pitchOf,
  rollOf,
  shapeAxis,
  smoothToward,
  steeringFromUp,
  upInScreenFrame,
  vec3,
  wrapDegrees,
  type ScreenAngle,
} from '../src/input/tilt';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function screenTilt(beta: number, gamma: number, angle: ScreenAngle): { roll: number; pitch: number } {
  const up = vec3();
  expect(upInScreenFrame(beta, gamma, angle, up)).toBe(true);
  return { roll: rollOf(up), pitch: pitchOf(up) };
}

type Handler = (event: never) => void;

class FakeTarget {
  readonly listeners = new Map<string, Set<Handler>>();
  addEventListener(type: string, handler: Handler): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }
  removeEventListener(type: string, handler: Handler): void {
    this.listeners.get(type)?.delete(handler);
  }
  count(): number {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
  emit(type: string, event: unknown): void {
    for (const handler of this.listeners.get(type) ?? []) (handler as (e: unknown) => void)(event);
  }
}

interface Harness {
  env: TiltEnvironment;
  sensors: FakeTarget;
  screen: FakeTarget;
  clock: { t: number };
  angle: { value: number };
  read: (beta: number | null, gamma: number | null) => void;
  rotate: (angle: number) => void;
}

function harness(options: { permission?: () => Promise<string> } = {}): Harness {
  const sensors = new FakeTarget();
  const screen = new FakeTarget();
  const clock = { t: 1000 };
  const angle = { value: 90 };
  const api = options.permission ? { requestPermission: options.permission } : {};
  const env: TiltEnvironment = {
    sensorTarget: sensors,
    orientationTarget: screen,
    orientationEvent: 'change',
    readScreenAngle: () => angle.value,
    sensorApi: api,
    now: () => clock.t,
  };
  return {
    env,
    sensors,
    screen,
    clock,
    angle,
    read: (beta, gamma) => sensors.emit('deviceorientation', { beta, gamma }),
    rotate: (next) => {
      angle.value = next;
      screen.emit('change', {});
    },
  };
}

/** Landscape-left grip: screen reclined 45° from flat, level side to side. */
const HOLD_BETA = 0;
const HOLD_GAMMA = -45;
const DT = 1 / 120;

/** Runs `seconds` of fixed steps, delivering the same reading at ~60 Hz. */
function fly(
  h: Harness,
  gyro: GyroscopeInput,
  seconds: number,
  beta: number | null = HOLD_BETA,
  gamma: number | null = HOLD_GAMMA,
): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    h.clock.t += DT * 1000;
    if (i % 2 === 0) h.read(beta, gamma);
    gyro.update(DT);
  }
}

function calibrated(h: Harness): GyroscopeInput {
  const gyro = new GyroscopeInput(h.env);
  expect(gyro.start()).toBe(true);
  gyro.beginCalibration();
  for (let i = 0; i < 20; i += 1) {
    h.clock.t += 16;
    h.read(HOLD_BETA, HOLD_GAMMA);
  }
  expect(gyro.finishCalibration().ok).toBe(true);
  return gyro;
}

/* ------------------------------------------------------------------ *
 * Orientation normalisation
 * ------------------------------------------------------------------ */

describe('screen angle', () => {
  it('normalises every platform convention to a quarter turn', () => {
    expect(normaliseScreenAngle(0)).toBe(0);
    expect(normaliseScreenAngle(90)).toBe(90);
    expect(normaliseScreenAngle(180)).toBe(180);
    expect(normaliseScreenAngle(270)).toBe(270);
    // iOS window.orientation reports landscape-right as -90.
    expect(normaliseScreenAngle(-90)).toBe(270);
    expect(normaliseScreenAngle(360)).toBe(0);
  });

  it('treats unreadable angles as the natural orientation', () => {
    expect(normaliseScreenAngle(undefined)).toBe(0);
    expect(normaliseScreenAngle(null)).toBe(0);
    expect(normaliseScreenAngle(Number.NaN)).toBe(0);
    expect(normaliseScreenAngle('landscape')).toBe(0);
  });
});

describe('orientation mapping', () => {
  it('reads a flat device as level', () => {
    const { roll, pitch } = screenTilt(0, 0, 0);
    expect(roll).toBeCloseTo(0, 9);
    expect(pitch).toBeCloseTo(0, 9);
  });

  it('portrait: gamma is roll, beta is pitch', () => {
    // Right edge lowered 10° (gamma +10) steers right.
    expect(screenTilt(0, 10, 0).roll).toBeCloseTo(10, 6);
    expect(screenTilt(0, -10, 0).roll).toBeCloseTo(-10, 6);
    // Raised 45° from flat.
    expect(screenTilt(45, 0, 0).pitch).toBeCloseTo(45, 6);
  });

  it('landscape-left (90): beta is roll, gamma is pitch', () => {
    const neutral = screenTilt(HOLD_BETA, HOLD_GAMMA, 90);
    expect(neutral.roll).toBeCloseTo(0, 6);
    expect(neutral.pitch).toBeCloseTo(45, 6);

    // Device top edge (the player's left) raised: the right edge dips.
    expect(screenTilt(10, HOLD_GAMMA, 90).roll).toBeCloseTo(10, 6);
    expect(screenTilt(-10, HOLD_GAMMA, 90).roll).toBeCloseTo(-10, 6);
    // Device right edge (the top of the screen) tipped away: flatter.
    expect(screenTilt(0, -35, 90).pitch).toBeCloseTo(35, 6);
  });

  it('landscape-right (270): the mirror of landscape-left', () => {
    const neutral = screenTilt(0, 45, 270);
    expect(neutral.roll).toBeCloseTo(0, 6);
    expect(neutral.pitch).toBeCloseTo(45, 6);

    // Device top is now on the right: lowering it steers right.
    expect(screenTilt(-10, 45, 270).roll).toBeCloseTo(10, 6);
    expect(screenTilt(0, 35, 270).pitch).toBeCloseTo(35, 6);
  });

  it('portrait upside-down (180) inverts both axes', () => {
    expect(screenTilt(0, -10, 180).roll).toBeCloseTo(10, 6);
    expect(screenTilt(-45, 0, 180).pitch).toBeCloseTo(45, 6);
  });

  it('has no seam where gamma wraps past ±90 in landscape', () => {
    // 88° from flat is reported directly; 92° is reported as beta 180 with
    // gamma back at +88. Pitch must still read 88 then 92, not jump.
    const before = screenTilt(0, -88, 90);
    const after = screenTilt(180, 88, 90);
    expect(before.pitch).toBeCloseTo(88, 6);
    expect(after.pitch).toBeCloseTo(92, 6);
    expect(Math.abs(after.roll - before.roll)).toBeLessThan(1e-6);
  });

  it('rejects missing or invalid readings without touching the output', () => {
    const up = { x: 7, y: 8, z: 9 };
    expect(upInScreenFrame(null, 0, 0, up)).toBe(false);
    expect(upInScreenFrame(0, null, 0, up)).toBe(false);
    expect(upInScreenFrame(undefined, undefined, 0, up)).toBe(false);
    expect(upInScreenFrame(Number.NaN, 0, 0, up)).toBe(false);
    expect(upInScreenFrame(0, Number.POSITIVE_INFINITY, 0, up)).toBe(false);
    expect(up).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('wraps angle differences into (-180, 180]', () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(180);
    expect(wrapDegrees(10)).toBe(10);
  });
});

/* ------------------------------------------------------------------ *
 * Response shaping
 * ------------------------------------------------------------------ */

describe('response curve', () => {
  const DZ = TILT.DEAD_ZONE_DEFAULT;

  it('ignores tilt inside the dead zone', () => {
    expect(shapeAxis(0, DZ, 1)).toBe(0);
    expect(shapeAxis(DZ, DZ, 1)).toBe(0);
    expect(shapeAxis(-DZ * 0.9, DZ, 1)).toBe(0);
  });

  it('rises from zero at the dead-zone edge, with no jump', () => {
    const justPast = shapeAxis(DZ + 0.01, DZ, 1);
    expect(justPast).toBeGreaterThan(0);
    expect(justPast).toBeLessThan(0.001);
  });

  it('reaches full deflection at the maximum effective tilt, and clamps beyond', () => {
    expect(shapeAxis(TILT.MAX_TILT, DZ, 1)).toBeCloseTo(1, 9);
    expect(shapeAxis(90, DZ, 1)).toBe(1);
    expect(shapeAxis(-90, DZ, 1)).toBe(-1);
  });

  it('is nonlinear: precise near neutral, full with a deliberate lean', () => {
    const halfway = DZ + (TILT.MAX_TILT - DZ) / 2;
    expect(shapeAxis(halfway, DZ, 1)).toBeCloseTo(Math.pow(0.5, TILT.RESPONSE_EXPONENT), 9);
    expect(shapeAxis(halfway, DZ, 1)).toBeLessThan(0.5);
  });

  it('is monotonic and odd-symmetric', () => {
    let previous = -Infinity;
    for (let d = -40; d <= 40; d += 0.25) {
      const value = shapeAxis(d, DZ, 1);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(shapeAxis(-d, DZ, 1)).toBeCloseTo(-value, 12);
      previous = value;
    }
  });

  it('sensitivity divides the tilt needed for full deflection', () => {
    expect(shapeAxis(TILT.MAX_TILT / 2, DZ, 2)).toBeCloseTo(1, 9);
    expect(shapeAxis(10, DZ, 2)).toBeGreaterThan(shapeAxis(10, DZ, 1));
    expect(shapeAxis(10, DZ, 0.5)).toBeLessThan(shapeAxis(10, DZ, 1));
  });

  it('clamps out-of-range sensitivity and dead zone instead of misbehaving', () => {
    expect(shapeAxis(10, DZ, 100)).toBe(shapeAxis(10, DZ, TILT.SENSITIVITY_MAX));
    expect(shapeAxis(10, DZ, -3)).toBe(shapeAxis(10, DZ, TILT.SENSITIVITY_MIN));
    expect(shapeAxis(10, -5, 1)).toBe(shapeAxis(10, 0, 1));
    // A dead zone wider than the whole range still leaves a response span.
    expect(Number.isFinite(shapeAxis(40, 30, 2))).toBe(true);
  });

  it('turns NaN input into no movement', () => {
    expect(shapeAxis(Number.NaN, DZ, 1)).toBe(0);
    expect(shapeAxis(10, DZ, Number.NaN)).toBe(shapeAxis(10, DZ, 1));
  });

  it('inverts each axis independently', () => {
    const up = vec3();
    upInScreenFrame(10, -35, 90, up); // right edge down 10°, top edge away 10°
    const neutral = { roll: 0, pitch: 45 };
    const scratch = { x: 0, y: 0 };
    const plain = { x: 0, y: 0 };
    const inverted = { x: 0, y: 0 };
    steeringFromUp(up, neutral, DEFAULT_TUNING, scratch, plain);
    steeringFromUp(up, neutral, { ...DEFAULT_TUNING, invertX: true }, scratch, inverted);
    expect(plain.x).toBeGreaterThan(0);
    expect(plain.y).toBeGreaterThan(0);
    expect(inverted.x).toBeCloseTo(-plain.x, 12);
    expect(inverted.y).toBeCloseTo(plain.y, 12);
    steeringFromUp(up, neutral, { ...DEFAULT_TUNING, invertY: true }, scratch, inverted);
    expect(inverted.x).toBeCloseTo(plain.x, 12);
    expect(inverted.y).toBeCloseTo(-plain.y, 12);
  });
});

describe('smoothing', () => {
  it('leaves the value alone for a zero or invalid step', () => {
    expect(smoothToward(0.3, 1, 0, 0.05)).toBe(0.3);
    expect(smoothToward(0.3, 1, Number.NaN, 0.05)).toBe(0.3);
  });

  it('snaps with no time constant', () => {
    expect(smoothToward(0, 1, DT, 0)).toBe(1);
  });

  it('is frame-rate independent', () => {
    const once = smoothToward(0, 1, 1 / 60, TILT.SMOOTHING_TAU);
    const twice = smoothToward(smoothToward(0, 1, 1 / 120, TILT.SMOOTHING_TAU), 1, 1 / 120, TILT.SMOOTHING_TAU);
    expect(twice).toBeCloseTo(once, 12);
  });

  it('prioritises responsiveness: over 90% of a step change within 100 ms', () => {
    let value = 0;
    for (let i = 0; i < 12; i += 1) value = smoothToward(value, 1, DT, TILT.SMOOTHING_TAU);
    expect(value).toBeGreaterThan(0.9);
  });
});

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

describe('calibration', () => {
  it('reports no signal without enough samples', () => {
    const acc = new CalibrationAccumulator();
    expect(acc.result().reason).toBe('no-signal');
    const up = vec3();
    upInScreenFrame(0, -45, 90, up);
    for (let i = 0; i < TILT.CALIBRATION_MIN_SAMPLES - 1; i += 1) acc.add(up);
    expect(acc.result().ok).toBe(false);
    acc.add(up);
    expect(acc.result().ok).toBe(true);
  });

  it('recovers the held pose exactly from steady samples', () => {
    const acc = new CalibrationAccumulator();
    const up = vec3();
    upInScreenFrame(3, -40, 90, up);
    for (let i = 0; i < 30; i += 1) acc.add(up);
    const result = acc.result();
    expect(result.ok).toBe(true);
    expect(result.spread).toBeLessThan(0.01);
    expect(result.neutral.roll).toBeCloseTo(rollOf(up), 6);
    expect(result.neutral.pitch).toBeCloseTo(pitchOf(up), 6);
  });

  it('averages small tremor to the centre of the motion', () => {
    const acc = new CalibrationAccumulator();
    const up = vec3();
    for (let i = 0; i < 40; i += 1) {
      const wobble = i % 2 === 0 ? 1.5 : -1.5;
      upInScreenFrame(wobble, -45 + wobble, 90, up);
      acc.add(up);
    }
    const result = acc.result();
    expect(result.ok).toBe(true);
    expect(result.neutral.roll).toBeCloseTo(0, 1);
    expect(result.neutral.pitch).toBeCloseTo(45, 1);
  });

  it('flags a device that was moving', () => {
    const acc = new CalibrationAccumulator();
    const up = vec3();
    for (let i = 0; i < 40; i += 1) {
      upInScreenFrame(i % 2 === 0 ? 20 : -20, -45, 90, up);
      acc.add(up);
    }
    const result = acc.result();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsteady');
    expect(result.spread).toBeGreaterThan(TILT.CALIBRATION_MAX_SPREAD);
  });

  it('ignores degenerate vectors', () => {
    const acc = new CalibrationAccumulator();
    acc.add({ x: 0, y: 0, z: 0 });
    acc.add({ x: Number.NaN, y: 0, z: 1 });
    expect(acc.count).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * GyroscopeInput
 * ------------------------------------------------------------------ */

describe('gyroscope input: capability and permission', () => {
  it('is unsupported without the API, and never throws', () => {
    const gyro = new GyroscopeInput(null);
    expect(gyro.status).toBe('unsupported');
    expect(gyro.start()).toBe(false);
    gyro.update(DT);
    expect(gyro.x).toBe(0);
  });

  it('starts directly where no permission is required (Android/Chrome)', () => {
    const h = harness();
    const gyro = new GyroscopeInput(h.env);
    expect(gyro.status).toBe('off');
    expect(gyro.needsPermission).toBe(false);
    expect(gyro.start()).toBe(true);
    expect(gyro.status).toBe('waiting');
  });

  it('waits for a gesture on iOS: no request is made on construction', () => {
    const permission = vi.fn(() => Promise.resolve('granted'));
    const h = harness({ permission });
    const gyro = new GyroscopeInput(h.env);
    expect(gyro.status).toBe('needs-permission');
    expect(gyro.start()).toBe(false);
    expect(permission).not.toHaveBeenCalled();
    expect(h.sensors.count()).toBe(0);
  });

  it('makes the platform request synchronously, then starts once granted', async () => {
    const permission = vi.fn(() => Promise.resolve('granted'));
    const h = harness({ permission });
    const gyro = new GyroscopeInput(h.env);
    const pending = gyro.requestPermission();
    // Called before any await: still inside the user gesture.
    expect(permission).toHaveBeenCalledTimes(1);
    expect(await pending).toBe(true);
    expect(gyro.status).toBe('off');
    expect(gyro.start()).toBe(true);
    // Granted once, asking again does not prompt again.
    expect(await gyro.requestPermission()).toBe(true);
    expect(permission).toHaveBeenCalledTimes(1);
  });

  it('handles a refusal', async () => {
    const h = harness({ permission: () => Promise.resolve('denied') });
    const gyro = new GyroscopeInput(h.env);
    expect(await gyro.requestPermission()).toBe(false);
    expect(gyro.status).toBe('denied');
    expect(gyro.start()).toBe(false);
  });

  it('treats a rejected or throwing request as a refusal', async () => {
    const rejecting = new GyroscopeInput(
      harness({ permission: () => Promise.reject(new Error('NotAllowedError')) }).env,
    );
    expect(await rejecting.requestPermission()).toBe(false);
    expect(rejecting.status).toBe('denied');

    const throwing = new GyroscopeInput(
      harness({
        permission: () => {
          throw new Error('no gesture');
        },
      }).env,
    );
    expect(await throwing.requestPermission()).toBe(false);
    expect(throwing.status).toBe('denied');
  });
});

describe('gyroscope input: listeners', () => {
  it('adds one listener per target, never duplicates, and removes them all', () => {
    const h = harness();
    const gyro = new GyroscopeInput(h.env);
    gyro.start();
    gyro.start();
    expect(h.sensors.count()).toBe(1);
    expect(h.screen.count()).toBe(1);
    gyro.stop();
    expect(h.sensors.count()).toBe(0);
    expect(h.screen.count()).toBe(0);
    gyro.start();
    gyro.dispose();
    expect(h.sensors.count() + h.screen.count()).toBe(0);
  });
});

describe('gyroscope input: steering', () => {
  it('outputs nothing until calibrated', () => {
    const h = harness();
    const gyro = new GyroscopeInput(h.env);
    gyro.start();
    fly(h, gyro, 0.3, 15, HOLD_GAMMA);
    expect(gyro.status).toBe('active');
    expect(gyro.calibrated).toBe(false);
    expect(gyro.x).toBe(0);
    expect(gyro.y).toBe(0);
  });

  it('holds still at the neutral pose and inside the dead zone', () => {
    const h = harness();
    const gyro = calibrated(h);
    fly(h, gyro, 0.5);
    expect(gyro.x).toBe(0);
    expect(gyro.y).toBe(0);
    fly(h, gyro, 0.5, HOLD_BETA + TILT.DEAD_ZONE_DEFAULT * 0.8, HOLD_GAMMA);
    expect(gyro.x).toBe(0);
  });

  it('steers right, left, up and down, and reaches full deflection', () => {
    const h = harness();
    const gyro = calibrated(h);

    fly(h, gyro, 0.5, HOLD_BETA + 10, HOLD_GAMMA);
    expect(gyro.x).toBeGreaterThan(0.2);
    expect(gyro.x).toBeLessThan(1);
    expect(Math.abs(gyro.y)).toBeLessThan(1e-9);

    fly(h, gyro, 0.5, HOLD_BETA - 30, HOLD_GAMMA);
    expect(gyro.x).toBeCloseTo(-1, 4);

    // Top edge tipped away (flatter): climb.
    fly(h, gyro, 0.5, HOLD_BETA, HOLD_GAMMA + 12);
    expect(gyro.y).toBeGreaterThan(0.2);
    // Top edge pulled back (more upright): dive.
    fly(h, gyro, 0.5, HOLD_BETA, HOLD_GAMMA - 12);
    expect(gyro.y).toBeLessThan(-0.2);
  });

  it('decelerates smoothly back to zero on return to neutral', () => {
    const h = harness();
    const gyro = calibrated(h);
    fly(h, gyro, 0.5, HOLD_BETA + 20, HOLD_GAMMA);
    const leaning = gyro.x;
    h.clock.t += 8;
    h.read(HOLD_BETA, HOLD_GAMMA);
    gyro.update(DT);
    // One step later it has eased down, not snapped to zero.
    expect(gyro.x).toBeGreaterThan(0);
    expect(gyro.x).toBeLessThan(leaning);
    fly(h, gyro, 0.5);
    expect(gyro.x).toBeCloseTo(0, 4);
  });

  it('applies tuning changes to the next reading', () => {
    const h = harness();
    const gyro = calibrated(h);
    fly(h, gyro, 0.5, HOLD_BETA + 10, HOLD_GAMMA);
    const normal = gyro.x;
    gyro.setTuning({ ...DEFAULT_TUNING, sensitivity: 2 });
    fly(h, gyro, 0.5, HOLD_BETA + 10, HOLD_GAMMA);
    expect(gyro.x).toBeGreaterThan(normal);
    gyro.setTuning({ ...DEFAULT_TUNING, invertX: true });
    fly(h, gyro, 0.5, HOLD_BETA + 10, HOLD_GAMMA);
    expect(gyro.x).toBeCloseTo(-normal, 4);
  });

  it('ignores null and invalid readings', () => {
    const h = harness();
    const gyro = calibrated(h);
    fly(h, gyro, 0.3, HOLD_BETA + 15, HOLD_GAMMA);
    const before = gyro.x;
    h.read(null, null);
    h.read(Number.NaN, 4);
    gyro.update(DT);
    expect(gyro.x).toBeGreaterThanOrEqual(before - 1e-9);
    expect(Number.isFinite(gyro.x)).toBe(true);
  });

  it('always stays within [-1, 1]', () => {
    const h = harness();
    const gyro = calibrated(h);
    for (const [beta, gamma] of [
      [170, -45],
      [-170, -45],
      [0, 89],
      [0, -89],
      [90, 0],
    ]) {
      fly(h, gyro, 0.3, beta, gamma);
      expect(Math.abs(gyro.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(gyro.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('gyroscope input: sensor loss', () => {
  it('marks the sensor lost after the timeout and eases the output to zero', () => {
    const h = harness();
    const gyro = calibrated(h);
    const statuses: string[] = [];
    gyro.setCallbacks({ onStatusChange: (s) => statuses.push(s) });
    fly(h, gyro, 0.5, HOLD_BETA + 25, HOLD_GAMMA);
    expect(gyro.x).toBeCloseTo(1, 3);

    // Silence: just under the timeout, still active.
    for (let t = 0; t < TILT.SENSOR_TIMEOUT_MS - 20; t += DT * 1000) {
      h.clock.t += DT * 1000;
      gyro.update(DT);
    }
    expect(gyro.status).toBe('active');

    for (let i = 0; i < 60; i += 1) {
      h.clock.t += DT * 1000;
      gyro.update(DT);
    }
    expect(gyro.status).toBe('lost');
    expect(statuses).toEqual(['lost']);
    expect(gyro.x).toBeLessThan(0.05);

    // Readings return: steering resumes.
    fly(h, gyro, 0.3, HOLD_BETA + 25, HOLD_GAMMA);
    expect(gyro.status).toBe('active');
    expect(gyro.x).toBeGreaterThan(0.9);
  });

  it('declares no sensor when the API exists but nothing ever arrives', () => {
    const h = harness();
    const gyro = new GyroscopeInput(h.env);
    gyro.start();
    for (let i = 0; i < 240; i += 1) {
      h.clock.t += DT * 1000;
      gyro.update(DT);
    }
    expect(gyro.status).toBe('unavailable');
    expect(h.sensors.count()).toBe(0);
    // A retry probes again.
    gyro.reset();
    expect(gyro.status).toBe('off');
    expect(gyro.start()).toBe(true);
  });

  it('a calibration with no readings reports no signal and keeps the old pose', () => {
    const h = harness();
    const gyro = calibrated(h);
    gyro.beginCalibration();
    const result = gyro.finishCalibration(true);
    expect(result.reason).toBe('no-signal');
    expect(gyro.calibrated).toBe(true);
  });
});

describe('gyroscope input: orientation changes', () => {
  it('remaps axes, discards the neutral pose and reports the rotation', () => {
    const h = harness();
    const gyro = calibrated(h);
    const rotations: number[] = [];
    gyro.setCallbacks({ onOrientationChange: (angle) => rotations.push(angle) });

    fly(h, gyro, 0.3, HOLD_BETA + 15, HOLD_GAMMA);
    expect(gyro.x).toBeGreaterThan(0);

    h.rotate(-90);
    expect(rotations).toEqual([270]);
    expect(gyro.screenAngle).toBe(270);
    expect(gyro.calibrated).toBe(false);
    expect(gyro.x).toBe(0);

    // No steering until recalibrated in the new orientation…
    fly(h, gyro, 0.3, -15, 45);
    expect(gyro.x).toBe(0);

    // …then the landscape-right mapping applies.
    gyro.beginCalibration();
    for (let i = 0; i < 20; i += 1) h.read(0, 45);
    expect(gyro.finishCalibration().ok).toBe(true);
    fly(h, gyro, 0.5, -15, 45);
    expect(gyro.x).toBeGreaterThan(0.2);
  });

  it('ignores a change event that is not a quarter turn', () => {
    const h = harness();
    const gyro = calibrated(h);
    const onOrientationChange = vi.fn();
    gyro.setCallbacks({ onOrientationChange });
    h.rotate(90);
    expect(onOrientationChange).not.toHaveBeenCalled();
    expect(gyro.calibrated).toBe(true);
  });

  it('restarts collection when the device rotates mid-calibration', () => {
    const h = harness();
    const gyro = new GyroscopeInput(h.env);
    gyro.start();
    gyro.beginCalibration();
    for (let i = 0; i < 20; i += 1) h.read(0, -45);
    h.rotate(270);
    for (let i = 0; i < 20; i += 1) h.read(0, 45);
    const result = gyro.finishCalibration();
    expect(result.ok).toBe(true);
    expect(result.samples).toBe(20);
    expect(result.neutral.pitch).toBeCloseTo(45, 6);
  });
});
