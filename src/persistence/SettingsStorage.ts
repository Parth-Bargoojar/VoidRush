/**
 * VOIDRUSH — settings persistence.
 *
 * [TRD] Key `voidrush-settings`, with the schema the TRD specifies plus the
 * PRD Screen 5 controls it omits (bloom, bloom intensity, visual intensity),
 * the touch joystick and the tilt controls. Every field is clamped on read, so
 * no stored combination can produce an unplayable or invalid state.
 *
 * Payloads carry a `version`. Anything older is migrated before it is
 * normalised; see `migrateSettings`. The tilt neutral pose is deliberately not
 * stored: how a device is held changes from one session to the next.
 */

import { CAMERA, MOVEMENT } from '../config/GameConfig';
import { TILT } from '../config/TiltConfig';
import { clamp } from '../utils/MathUtils';
import type {
  ControlMode,
  JoystickMode,
  JoystickSide,
  QualityLevel,
  Settings,
  TouchControlsMode,
} from '../types';
import { parseJson, readBoolean, readEnum, readNumber, readRaw, writeRaw } from './Storage';

export const SETTINGS_KEY = 'voidrush-settings';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
export const TOUCH_CONTROL_MODES: readonly TouchControlsMode[] = ['auto', 'on', 'off'];
// A saved 'floating' (a retired stick that slid after the thumb) reads as the default.
export const JOYSTICK_MODES: readonly JoystickMode[] = ['dynamic', 'fixed'];
export const JOYSTICK_SIDES: readonly JoystickSide[] = ['left', 'right'];
export const JOYSTICK_SIZE_MIN = 0.75;
export const JOYSTICK_SIZE_MAX = 1.35;
export const CONTROL_MODES: readonly ControlMode[] = ['auto', 'keyboard', 'tilt'];

/**
 * 1: everything up to the touch joystick (no `version` field).
 * 2: adds the control mode and tilt settings.
 */
export const SETTINGS_VERSION = 2;

/** High is the default quality level. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  quality: 'high' as QualityLevel,
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  movementSensitivity: MOVEMENT.SENSITIVITY_DEFAULT,
  cameraShake: CAMERA.SHAKE_DEFAULT,
  effectsIntensity: 1,
  fov: CAMERA.FOV_DEFAULT,
  bloom: true,
  bloomIntensity: 1,
  visualIntensity: 1,
  touchControls: 'auto' as TouchControlsMode,
  joystickMode: 'dynamic' as JoystickMode,
  joystickSide: 'left' as JoystickSide,
  joystickSize: 1,
  haptics: true,
  controlMode: 'auto' as ControlMode,
  tiltSensitivity: TILT.SENSITIVITY_DEFAULT,
  tiltDeadZone: TILT.DEAD_ZONE_DEFAULT,
  tiltInvertX: false,
  tiltInvertY: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Brings a stored payload up to SETTINGS_VERSION. Never throws and never
 * mutates its input; anything that is not an object passes through for
 * `normaliseSettings` to replace with defaults.
 *
 * v1 → v2: a player who had forced the on-screen joystick on had chosen touch
 * steering on purpose, so they keep it rather than being switched to tilt by
 * the new AUTO default. Every other v1 player gets AUTO.
 */
export function migrateSettings(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const version = typeof raw.version === 'number' && Number.isFinite(raw.version) ? raw.version : 1;
  if (version >= SETTINGS_VERSION) return raw;

  const next: Record<string, unknown> = { ...raw };
  if (version < 2) {
    if (!('controlMode' in next)) {
      next.controlMode = next.touchControls === 'on' ? 'keyboard' : 'auto';
    }
  }
  next.version = SETTINGS_VERSION;
  return next;
}

/** Clamps every field into its legal range. */
export function normaliseSettings(input: Partial<Settings> | unknown): Settings {
  return {
    quality: readEnum(input, 'quality', QUALITY_LEVELS, DEFAULT_SETTINGS.quality),
    masterVolume: clamp(readNumber(input, 'masterVolume', DEFAULT_SETTINGS.masterVolume), 0, 1),
    musicVolume: clamp(readNumber(input, 'musicVolume', DEFAULT_SETTINGS.musicVolume), 0, 1),
    sfxVolume: clamp(readNumber(input, 'sfxVolume', DEFAULT_SETTINGS.sfxVolume), 0, 1),
    movementSensitivity: clamp(
      readNumber(input, 'movementSensitivity', DEFAULT_SETTINGS.movementSensitivity),
      MOVEMENT.SENSITIVITY_MIN,
      MOVEMENT.SENSITIVITY_MAX,
    ),
    cameraShake: clamp(readNumber(input, 'cameraShake', DEFAULT_SETTINGS.cameraShake), 0, 1),
    effectsIntensity: clamp(
      readNumber(input, 'effectsIntensity', DEFAULT_SETTINGS.effectsIntensity),
      0,
      1,
    ),
    fov: clamp(readNumber(input, 'fov', DEFAULT_SETTINGS.fov), CAMERA.FOV_MIN, CAMERA.FOV_MAX),
    bloom: readBoolean(input, 'bloom', DEFAULT_SETTINGS.bloom),
    bloomIntensity: clamp(
      readNumber(input, 'bloomIntensity', DEFAULT_SETTINGS.bloomIntensity),
      0,
      2,
    ),
    visualIntensity: clamp(
      readNumber(input, 'visualIntensity', DEFAULT_SETTINGS.visualIntensity),
      0,
      1,
    ),
    touchControls: readEnum(
      input,
      'touchControls',
      TOUCH_CONTROL_MODES,
      DEFAULT_SETTINGS.touchControls,
    ),
    joystickMode: readEnum(input, 'joystickMode', JOYSTICK_MODES, DEFAULT_SETTINGS.joystickMode),
    joystickSide: readEnum(input, 'joystickSide', JOYSTICK_SIDES, DEFAULT_SETTINGS.joystickSide),
    joystickSize: clamp(
      readNumber(input, 'joystickSize', DEFAULT_SETTINGS.joystickSize),
      JOYSTICK_SIZE_MIN,
      JOYSTICK_SIZE_MAX,
    ),
    haptics: readBoolean(input, 'haptics', DEFAULT_SETTINGS.haptics),
    controlMode: readEnum(input, 'controlMode', CONTROL_MODES, DEFAULT_SETTINGS.controlMode),
    tiltSensitivity: clamp(
      readNumber(input, 'tiltSensitivity', DEFAULT_SETTINGS.tiltSensitivity),
      TILT.SENSITIVITY_MIN,
      TILT.SENSITIVITY_MAX,
    ),
    tiltDeadZone: clamp(
      readNumber(input, 'tiltDeadZone', DEFAULT_SETTINGS.tiltDeadZone),
      TILT.DEAD_ZONE_MIN,
      TILT.DEAD_ZONE_MAX,
    ),
    tiltInvertX: readBoolean(input, 'tiltInvertX', DEFAULT_SETTINGS.tiltInvertX),
    tiltInvertY: readBoolean(input, 'tiltInvertY', DEFAULT_SETTINGS.tiltInvertY),
  };
}

export function loadSettings(): Settings {
  return normaliseSettings(migrateSettings(parseJson(readRaw(SETTINGS_KEY))));
}

export function saveSettings(settings: Settings): boolean {
  return writeRaw(
    SETTINGS_KEY,
    JSON.stringify({ version: SETTINGS_VERSION, ...normaliseSettings(settings) }),
  );
}
