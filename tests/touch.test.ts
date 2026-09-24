/**
 * Touch support: analog steering, the joystick axis on the input manager, the
 * new settings fields, and the portrait FOV correction.
 */

import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/config/GameConfig';
import { InputManager } from '../src/game/InputManager';
import { createPlayer, stepPlayer } from '../src/game/Player';
import {
  DEFAULT_SETTINGS,
  JOYSTICK_SIZE_MAX,
  JOYSTICK_SIZE_MIN,
  normaliseSettings,
} from '../src/persistence/SettingsStorage';
import { aspectCorrectedFov } from '../src/rendering/CameraController';
import type { InputState } from '../src/types';

const DT = 1 / 120;

/** Velocity after holding `input` long enough to reach steady state. */
function settle(input: InputState): { vx: number; vy: number } {
  const player = createPlayer();
  for (let i = 0; i < 240; i += 1) {
    stepPlayer(player, input, DT, 1);
    // Keep the player centred so the wall clamp never zeroes velocity.
    player.x = 0;
    player.y = 0;
  }
  return { vx: player.vx, vy: player.vy };
}

const NONE: InputState = { up: false, down: false, left: false, right: false };

describe('analog steering', () => {
  it('a half-deflected stick flies at about half speed', () => {
    const { vx, vy } = settle({ ...NONE, axisX: 0.5, axisY: 0 });
    expect(vx).toBeCloseTo(MOVEMENT.MAX_LATERAL_SPEED * 0.5, 1);
    expect(vy).toBeCloseTo(0, 5);
  });

  it('positive axisY steers up, like W', () => {
    const stick = settle({ ...NONE, axisY: 1 });
    const key = settle({ ...NONE, up: true });
    expect(stick.vy).toBeCloseTo(key.vy, 5);
  });

  it('stick plus keys can never beat top speed', () => {
    const { vx, vy } = settle({ ...NONE, right: true, up: true, axisX: 1, axisY: 1 });
    expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(MOVEMENT.MAX_LATERAL_SPEED + 1e-6);
  });

  it('out-of-range axis values are clamped', () => {
    const { vx } = settle({ ...NONE, axisX: 50 });
    expect(vx).toBeCloseTo(MOVEMENT.MAX_LATERAL_SPEED, 1);
  });
});

describe('input manager axis', () => {
  it('stores, clamps and clears the joystick axis', () => {
    const manager = new InputManager(
      {
        onPauseToggle: () => undefined,
        onBlur: () => undefined,
        isPlaying: () => true,
      },
      // Never attached, so a bare stand-in for the window is enough.
      {} as Window,
    );
    manager.setAxis(0.4, -2);
    expect(manager.input.axisX).toBeCloseTo(0.4);
    expect(manager.input.axisY).toBe(-1);
    manager.setAxis(Number.NaN, 0.2);
    expect(manager.input.axisX).toBe(0);
    manager.clear();
    expect(manager.input.axisX).toBe(0);
    expect(manager.input.axisY).toBe(0);
  });
});

describe('touch settings', () => {
  it('defaults to an automatic floating stick on the left, with vibration', () => {
    expect(DEFAULT_SETTINGS.touchControls).toBe('auto');
    expect(DEFAULT_SETTINGS.joystickMode).toBe('floating');
    expect(DEFAULT_SETTINGS.joystickSide).toBe('left');
    expect(DEFAULT_SETTINGS.haptics).toBe(true);
  });

  it('rejects invalid values', () => {
    const settings = normaliseSettings({
      touchControls: 'maybe',
      joystickMode: 7,
      joystickSide: 'up',
      joystickSize: 99,
      haptics: 'yes',
    });
    expect(settings.touchControls).toBe(DEFAULT_SETTINGS.touchControls);
    expect(settings.joystickMode).toBe(DEFAULT_SETTINGS.joystickMode);
    expect(settings.joystickSide).toBe(DEFAULT_SETTINGS.joystickSide);
    expect(settings.joystickSize).toBe(JOYSTICK_SIZE_MAX);
    expect(settings.haptics).toBe(DEFAULT_SETTINGS.haptics);
    expect(normaliseSettings({ joystickSize: 0 }).joystickSize).toBe(JOYSTICK_SIZE_MIN);
  });

  it('upgrades settings saved before touch support existed', () => {
    const legacy = { quality: 'high', fov: 80 };
    const settings = normaliseSettings(legacy);
    expect(settings.quality).toBe('high');
    expect(settings.touchControls).toBe('auto');
  });
});

describe('portrait field of view', () => {
  it('leaves landscape and square screens untouched', () => {
    expect(aspectCorrectedFov(75, 16 / 9)).toBe(75);
    expect(aspectCorrectedFov(75, 1)).toBe(75);
  });

  it('widens a tall phone, within a cap', () => {
    const phone = aspectCorrectedFov(75, 390 / 844);
    expect(phone).toBeGreaterThan(90);
    expect(phone).toBeLessThanOrEqual(110);
    expect(aspectCorrectedFov(95, 0.2)).toBe(110);
  });

  it('widens more as the screen gets taller', () => {
    expect(aspectCorrectedFov(75, 0.5)).toBeGreaterThan(aspectCorrectedFov(75, 0.75));
  });
});
