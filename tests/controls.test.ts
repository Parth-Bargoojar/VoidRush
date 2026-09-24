/**
 * The control upgrade's integration points: which source steers, how settings
 * migrate, how the input manager folds tilt in, and proof that keyboard
 * steering is bit-for-bit what it was before tilt existed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { MOVEMENT, WORLD } from '../src/config/GameConfig';
import { TILT } from '../src/config/TiltConfig';
import { InputManager, type AnalogSource } from '../src/game/InputManager';
import { createPlayer, readSteering, stepPlayer } from '../src/game/Player';
import { resolveControlMode, tiltUsable } from '../src/input/ControlMode';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  loadSettings,
  migrateSettings,
  normaliseSettings,
  saveSettings,
} from '../src/persistence/SettingsStorage';
import { setStorageBackend, type StorageBackend } from '../src/persistence/Storage';
import type { InputState, Player, TiltStatus } from '../src/types';
import { clamp, damp } from '../src/utils/MathUtils';

/* ------------------------------------------------------------------ *
 * Control-mode selection
 * ------------------------------------------------------------------ */

describe('control mode selection', () => {
  const ALL: readonly TiltStatus[] = [
    'unsupported',
    'needs-permission',
    'denied',
    'off',
    'waiting',
    'active',
    'lost',
    'unavailable',
  ];

  it('KEYBOARD always means the keyboard', () => {
    for (const tilt of ALL) {
      expect(resolveControlMode('keyboard', { touchPrimary: true, tilt })).toBe('keyboard');
    }
  });

  it('AUTO defaults to joystick on a phone or tablet, not tilt', () => {
    expect(resolveControlMode('auto', { touchPrimary: true, tilt: 'active' })).toBe('keyboard');
    expect(resolveControlMode('auto', { touchPrimary: true, tilt: 'off' })).toBe('keyboard');
    expect(resolveControlMode('auto', { touchPrimary: true, tilt: 'needs-permission' })).toBe(
      'keyboard',
    );
  });

  it('TILT explicitly picks tilt on a phone or tablet that can provide it', () => {
    expect(resolveControlMode('tilt', { touchPrimary: true, tilt: 'active' })).toBe('tilt');
    expect(resolveControlMode('tilt', { touchPrimary: true, tilt: 'off' })).toBe('tilt');
    expect(resolveControlMode('tilt', { touchPrimary: true, tilt: 'needs-permission' })).toBe(
      'tilt',
    );
  });

  it('AUTO keeps the keyboard on desktop, even where the API exists', () => {
    for (const tilt of ALL) {
      expect(resolveControlMode('auto', { touchPrimary: false, tilt })).toBe('keyboard');
    }
  });

  it('falls back when tilt is unsupported, refused or has no sensor', () => {
    for (const tilt of ['unsupported', 'denied', 'unavailable'] as const) {
      expect(tiltUsable(tilt)).toBe(false);
      expect(resolveControlMode('auto', { touchPrimary: true, tilt })).toBe('keyboard');
      expect(resolveControlMode('tilt', { touchPrimary: true, tilt })).toBe('keyboard');
    }
  });

  it('keeps tilt through a momentary signal loss', () => {
    expect(tiltUsable('lost')).toBe(true);
    expect(resolveControlMode('tilt', { touchPrimary: true, tilt: 'lost' })).toBe('tilt');
  });

  it('TILT is honoured on a touchscreen laptop too', () => {
    expect(resolveControlMode('tilt', { touchPrimary: false, tilt: 'active' })).toBe('tilt');
  });
});

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

class FakeStorage implements StorageBackend {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

afterEach(() => setStorageBackend(null));

describe('control settings', () => {
  it('defaults to AUTO with the documented tilt tuning', () => {
    expect(DEFAULT_SETTINGS.controlMode).toBe('auto');
    expect(DEFAULT_SETTINGS.tiltSensitivity).toBe(1);
    expect(DEFAULT_SETTINGS.tiltDeadZone).toBe(2);
    expect(DEFAULT_SETTINGS.tiltInvertX).toBe(false);
    expect(DEFAULT_SETTINGS.tiltInvertY).toBe(false);
    expect(TILT.MAX_TILT).toBe(22);
    expect(TILT.RESPONSE_EXPONENT).toBe(1.35);
    expect(TILT.SENSOR_TIMEOUT_MS).toBe(500);
  });

  it('round-trips every control field', () => {
    setStorageBackend(new FakeStorage());
    const settings = {
      ...DEFAULT_SETTINGS,
      controlMode: 'tilt' as const,
      tiltSensitivity: 1.4,
      tiltDeadZone: 3.5,
      tiltInvertX: true,
      tiltInvertY: true,
    };
    expect(saveSettings(settings)).toBe(true);
    expect(loadSettings()).toEqual(settings);
  });

  it('clamps and validates stored control values', () => {
    const settings = normaliseSettings({
      controlMode: 'gyro',
      tiltSensitivity: 50,
      tiltDeadZone: -4,
      tiltInvertX: 'yes',
      tiltInvertY: 1,
    });
    expect(settings.controlMode).toBe('auto');
    expect(settings.tiltSensitivity).toBe(TILT.SENSITIVITY_MAX);
    expect(settings.tiltDeadZone).toBe(TILT.DEAD_ZONE_MIN);
    expect(settings.tiltInvertX).toBe(false);
    expect(settings.tiltInvertY).toBe(false);
  });

  it('writes a versioned payload and never stores a calibration', () => {
    const store = new FakeStorage();
    setStorageBackend(store);
    saveSettings(DEFAULT_SETTINGS);
    const stored = JSON.parse(store.map.get(SETTINGS_KEY)!) as Record<string, unknown>;
    expect(stored.version).toBe(SETTINGS_VERSION);
    expect(Object.keys(stored).some((key) => /neutral|calibrat/i.test(key))).toBe(false);
  });
});

describe('settings migration', () => {
  /** A real payload as the previous release wrote it: no version, no tilt. */
  const V1 = {
    quality: 'high',
    masterVolume: 0.6,
    musicVolume: 0.5,
    sfxVolume: 0.9,
    movementSensitivity: 1.2,
    cameraShake: 0.4,
    effectsIntensity: 0.8,
    fov: 88,
    bloom: false,
    bloomIntensity: 1.3,
    visualIntensity: 0.7,
    touchControls: 'auto',
    joystickMode: 'fixed',
    joystickSide: 'right',
    joystickSize: 1.1,
    haptics: false,
  };

  it('upgrades a v1 payload, keeping every existing preference', () => {
    const store = new FakeStorage();
    setStorageBackend(store);
    store.map.set(SETTINGS_KEY, JSON.stringify(V1));
    const settings = loadSettings();
    expect(settings).toMatchObject(V1);
    expect(settings.controlMode).toBe('auto');
    expect(settings.tiltSensitivity).toBe(DEFAULT_SETTINGS.tiltSensitivity);
    expect(settings.tiltDeadZone).toBe(DEFAULT_SETTINGS.tiltDeadZone);
  });

  it('keeps a player who forced the joystick on off tilt', () => {
    const migrated = migrateSettings({ ...V1, touchControls: 'on' });
    expect(normaliseSettings(migrated).controlMode).toBe('keyboard');
  });

  it('does not override an explicit choice or re-run on current payloads', () => {
    expect(
      normaliseSettings(migrateSettings({ ...V1, touchControls: 'on', controlMode: 'tilt' }))
        .controlMode,
    ).toBe('tilt');
    const current = { ...V1, touchControls: 'on', controlMode: 'auto', version: SETTINGS_VERSION };
    expect(migrateSettings(current)).toBe(current);
  });

  it('is pure and total', () => {
    const input = { ...V1 };
    migrateSettings(input);
    expect(input).toEqual(V1);
    for (const junk of [null, undefined, 42, 'x', [], [1, 2]]) {
      expect(() => normaliseSettings(migrateSettings(junk))).not.toThrow();
      expect(normaliseSettings(migrateSettings(junk))).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('persists the migrated form on the next save', () => {
    const store = new FakeStorage();
    setStorageBackend(store);
    store.map.set(SETTINGS_KEY, JSON.stringify({ ...V1, touchControls: 'on' }));
    saveSettings(loadSettings());
    const stored = JSON.parse(store.map.get(SETTINGS_KEY)!) as Record<string, unknown>;
    expect(stored.version).toBe(SETTINGS_VERSION);
    expect(stored.controlMode).toBe('keyboard');
  });
});

/* ------------------------------------------------------------------ *
 * Input composition
 * ------------------------------------------------------------------ */

/** Just enough of a Window for the input manager outside a browser. */
function fakeWindow(): Window {
  const noop = (): void => undefined;
  return {
    addEventListener: noop,
    removeEventListener: noop,
    document: { addEventListener: noop, removeEventListener: noop, visibilityState: 'visible' },
  } as unknown as Window;
}

class StubTilt implements AnalogSource {
  x = 0;
  y = 0;
  updates = 0;
  resets = 0;
  update(): void {
    this.updates += 1;
  }
  resetOutput(): void {
    this.resets += 1;
    this.x = 0;
    this.y = 0;
  }
}

function manager(): { input: InputManager; tilt: StubTilt } {
  const input = new InputManager(
    { onPauseToggle: () => undefined, onBlur: () => undefined, isPlaying: () => true },
    fakeWindow(),
  );
  const tilt = new StubTilt();
  input.setTiltSource(tilt);
  return { input, tilt };
}

describe('input manager with tilt', () => {
  it('polls tilt every step but only feeds it to the player when enabled', () => {
    const { input, tilt } = manager();
    tilt.x = 0.6;
    input.update(1 / 120);
    expect(tilt.updates).toBe(1);
    expect(input.input.axisX).toBe(0);

    input.setTiltEnabled(true);
    tilt.x = 0.6;
    tilt.y = -0.3;
    input.update(1 / 120);
    expect(input.input.axisX).toBeCloseTo(0.6);
    expect(input.input.axisY).toBeCloseTo(-0.3);
  });

  it('sums tilt with the joystick and clamps each axis', () => {
    const { input, tilt } = manager();
    input.setTiltEnabled(true);
    tilt.x = 0.8;
    input.setAxis(0.7, 0);
    expect(input.input.axisX).toBe(1);
    input.setAxis(-0.3, 0);
    expect(input.input.axisX).toBeCloseTo(0.5);
  });

  it('clears tilt output on clear and when disabled', () => {
    const { input, tilt } = manager();
    input.setTiltEnabled(true);
    tilt.x = 0.9;
    input.update(1 / 120);
    const before = tilt.resets;
    input.clear();
    expect(tilt.resets).toBe(before + 1);
    expect(input.input.axisX).toBe(0);

    tilt.x = 0.9;
    input.update(1 / 120);
    input.setTiltEnabled(false);
    expect(input.input.axisX).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Keyboard steering is unchanged
 * ------------------------------------------------------------------ */

/** stepPlayer exactly as it shipped before the control upgrade. */
function legacyStepPlayer(player: Player, input: InputState, dt: number, sensitivity: number): void {
  player.prevX = player.x;
  player.prevY = player.y;
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
  const maxSpeed =
    MOVEMENT.MAX_LATERAL_SPEED *
    clamp(sensitivity, MOVEMENT.SENSITIVITY_MIN, MOVEMENT.SENSITIVITY_MAX);
  player.vx = damp(player.vx, dirX * maxSpeed, MOVEMENT.TAU, dt);
  player.vy = damp(player.vy, dirY * maxSpeed, MOVEMENT.TAU, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
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

function keys(mask: number): InputState {
  return { up: !!(mask & 1), down: !!(mask & 2), left: !!(mask & 4), right: !!(mask & 8) };
}

describe('WASD behaviour is unchanged', () => {
  it('normalises every key combination exactly as before', () => {
    const out = { horizontal: 0, vertical: 0 };
    const expected: Record<number, [number, number]> = {
      0: [0, 0],
      1: [0, 1], // W
      2: [0, -1], // S
      4: [-1, 0], // A
      8: [1, 0], // D
      3: [0, 0], // W+S cancel
      12: [0, 0], // A+D cancel
      9: [Math.SQRT1_2, Math.SQRT1_2], // W+D
      5: [-Math.SQRT1_2, Math.SQRT1_2], // W+A
      10: [Math.SQRT1_2, -Math.SQRT1_2], // S+D
      6: [-Math.SQRT1_2, -Math.SQRT1_2], // S+A
    };
    for (const [mask, [h, v]] of Object.entries(expected)) {
      readSteering(keys(Number(mask)), out);
      expect(out.horizontal).toBe(h);
      expect(out.vertical).toBe(v);
    }
  });

  it('produces bit-identical trajectories to the previous player step', () => {
    const current = createPlayer();
    const legacy = createPlayer();
    // A deterministic sweep through every key combination, including holds
    // long enough to reach the clamp walls, at several sensitivities.
    for (let step = 0; step < 6000; step += 1) {
      const input = keys((step * 7 + (step >> 5)) % 16);
      const sensitivity = [1, 0.6, 1.6, 1.25][(step >> 9) % 4]!;
      stepPlayer(current, input, 1 / 120, sensitivity);
      legacyStepPlayer(legacy, input, 1 / 120, sensitivity);
      expect(current).toEqual(legacy);
    }
  });

  it('keyboard state comes through the input manager untouched by an idle tilt source', () => {
    const { input, tilt } = manager();
    input.setTiltEnabled(true);
    input.update(1 / 120);
    expect(tilt.x).toBe(0);
    const out = { horizontal: 0, vertical: 0 };
    readSteering({ ...input.input, right: true, up: true }, out);
    expect(out.horizontal).toBe(Math.SQRT1_2);
    expect(out.vertical).toBe(Math.SQRT1_2);
  });
});
