/**
 * Touch support: analog steering, the joystick axis on the input manager, the
 * joystick geometry, the settings fields, and the portrait FOV correction.
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
import {
  DEAD_ZONE,
  EDGE_MARGIN,
  inSteeringZone,
  readStick,
  spawnCentre,
  stickRadius,
} from '../src/ui/joystick';
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
  it('defaults to an automatic dynamic stick on the left, with vibration', () => {
    expect(DEFAULT_SETTINGS.touchControls).toBe('auto');
    expect(DEFAULT_SETTINGS.joystickMode).toBe('dynamic');
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

  it('moves a saved floating stick to the dynamic one and keeps a fixed one', () => {
    expect(normaliseSettings({ joystickMode: 'floating' }).joystickMode).toBe('dynamic');
    expect(normaliseSettings({ joystickMode: 'fixed' }).joystickMode).toBe('fixed');
  });

  it('upgrades settings saved before touch support existed', () => {
    const legacy = { quality: 'high', fov: 80 };
    const settings = normaliseSettings(legacy);
    expect(settings.quality).toBe('high');
    expect(settings.touchControls).toBe('auto');
  });
});

describe('joystick geometry', () => {
  const R = 60;

  it('reads zero at the centre and inside the dead zone', () => {
    expect(readStick(0, 0, R)).toEqual({ axisX: 0, axisY: 0, knobX: 0, knobY: 0 });
    const resting = readStick(R * DEAD_ZONE * 0.9, 0, R);
    expect(resting.axisX).toBe(0);
    expect(resting.axisY).toBe(0);
    // The knob still follows the thumb, so the stick never looks frozen.
    expect(resting.knobX).toBeGreaterThan(0);
  });

  it('rises from zero just past the dead zone to one at the rim', () => {
    expect(readStick(R * DEAD_ZONE + 0.01, 0, R).axisX).toBeLessThan(0.01);
    expect(readStick(R, 0, R).axisX).toBeCloseTo(1, 6);
    const half = readStick(R * (DEAD_ZONE + (1 - DEAD_ZONE) / 2), 0, R).axisX;
    expect(half).toBeCloseTo(0.5, 6);
  });

  it('points up for a thumb above the centre', () => {
    const up = readStick(0, -R, R);
    expect(up.axisX).toBeCloseTo(0, 6);
    expect(up.axisY).toBeCloseTo(1, 6);
    expect(readStick(R, 0, R).axisY).toBe(0);
  });

  it('pins the knob to the rim past the edge instead of moving the base', () => {
    const far = readStick(R * 3, R * 4, R);
    expect(Math.hypot(far.knobX, far.knobY)).toBeCloseTo(R, 6);
    expect(Math.hypot(far.axisX, far.axisY)).toBeCloseTo(1, 6);
    // The direction is the thumb's: 3-4-5.
    expect(far.axisX).toBeCloseTo(0.6, 6);
    expect(far.axisY).toBeCloseTo(-0.8, 6);
  });

  it('never returns NaN for degenerate input', () => {
    const zero = readStick(5, 5, 0);
    expect(zero).toEqual({ axisX: 0, axisY: 0, knobX: 0, knobY: 0 });
  });

  it('claims only its own half of the screen', () => {
    expect(inSteeringZone(100, 'left', 844)).toBe(true);
    expect(inSteeringZone(600, 'left', 844)).toBe(false);
    expect(inSteeringZone(600, 'right', 844)).toBe(true);
    expect(inSteeringZone(100, 'right', 844)).toBe(false);
  });

  it('spawns under the thumb, nudged only to stay on screen', () => {
    expect(spawnCentre({ x: 200, y: 250 }, R, 844, 390)).toEqual({ x: 200, y: 250 });
    const corner = spawnCentre({ x: 2, y: 389 }, R, 844, 390);
    expect(corner).toEqual({ x: R + EDGE_MARGIN, y: 390 - R - EDGE_MARGIN });
  });

  it('sizes the stick from the setting, within a fifth of the short side', () => {
    expect(stickRadius(1, 844, 390)).toBe(60);
    expect(stickRadius(1.35, 844, 390)).toBeCloseTo(78, 6);
    expect(stickRadius(1.35, 640, 320)).toBe(64);
    expect(stickRadius(0.1, 844, 390)).toBe(40);
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
