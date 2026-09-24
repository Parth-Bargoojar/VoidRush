/**
 * VOIDRUSH — settings persistence.
 *
 * [TRD] Key `voidrush-settings`, with the schema the TRD specifies plus the
 * PRD Screen 5 controls it omits (bloom, bloom intensity, visual intensity).
 * Every field is clamped on read, so no stored combination can produce an
 * unplayable or invalid state.
 */

import { CAMERA, MOVEMENT } from '../config/GameConfig';
import { clamp } from '../utils/MathUtils';
import type { QualityLevel, Settings } from '../types';
import { parseJson, readBoolean, readEnum, readNumber, readRaw, writeRaw } from './Storage';

export const SETTINGS_KEY = 'voidrush-settings';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

/** [TRD] Medium is the default quality level. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  quality: 'medium' as QualityLevel,
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  movementSensitivity: MOVEMENT.SENSITIVITY_DEFAULT,
  cameraShake: CAMERA.SHAKE_DEFAULT,
  effectsIntensity: 1,
  fov: CAMERA.FOV_BASE,
  bloom: true,
  bloomIntensity: 1,
  visualIntensity: 1,
});

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
  };
}

export function loadSettings(): Settings {
  return normaliseSettings(parseJson(readRaw(SETTINGS_KEY)));
}

export function saveSettings(settings: Settings): boolean {
  return writeRaw(SETTINGS_KEY, JSON.stringify(normaliseSettings(settings)));
}
