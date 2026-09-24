/**
 * Settings and statistics must survive a round trip, and any corrupt, partial
 * or wrong-typed payload must fall back to defaults without throwing.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { CAMERA, MOVEMENT } from '../src/config/GameConfig';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  normaliseSettings,
  saveSettings,
} from '../src/persistence/SettingsStorage';
import {
  DEFAULT_STATS,
  STATS_KEY,
  loadStats,
  normaliseStats,
  saveStats,
} from '../src/persistence/ScoreStorage';
import { setStorageBackend, type StorageBackend } from '../src/persistence/Storage';
import { mergeStats, buildRunStats } from '../src/game/RunStats';
import { createScoreState, registerClear } from '../src/game/ScoreSystem';

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

/** Storage that refuses every operation, as a full or disabled quota would. */
class HostileStorage implements StorageBackend {
  getItem(): string | null {
    throw new Error('storage disabled');
  }
  setItem(): void {
    throw new Error('quota exceeded');
  }
  removeItem(): void {
    throw new Error('storage disabled');
  }
}

afterEach(() => setStorageBackend(null));

describe('settings persistence', () => {
  it('round-trips a full settings object', () => {
    const store = new FakeStorage();
    setStorageBackend(store);
    const settings = {
      ...DEFAULT_SETTINGS,
      quality: 'ultra' as const,
      fov: 88,
      masterVolume: 0.4,
      movementSensitivity: 1.4,
      bloom: false,
    };
    expect(saveSettings(settings)).toBe(true);
    expect(loadSettings()).toEqual(settings);
  });

  it('returns defaults when nothing is stored', () => {
    setStorageBackend(new FakeStorage());
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  const corruptPayloads: Array<[string, string]> = [
    ['unparseable json', '{not json at all'],
    ['empty string', ''],
    ['null literal', 'null'],
    ['a bare number', '42'],
    ['a bare string', '"hello"'],
    ['an array', '[1,2,3]'],
    ['wrong types', '{"quality":7,"fov":"wide","masterVolume":{"a":1},"bloom":"yes"}'],
    ['out of range', '{"fov":9000,"masterVolume":-5,"movementSensitivity":1000}'],
    ['non-finite', '{"fov":null,"masterVolume":1e999}'],
    ['unknown enum', '{"quality":"cinematic"}'],
    ['partial', '{"fov":80}'],
    ['nested nonsense', '{"quality":{"low":true}}'],
  ];

  for (const [label, payload] of corruptPayloads) {
    it(`falls back to defaults for ${label}, without throwing`, () => {
      const store = new FakeStorage();
      store.setItem(SETTINGS_KEY, payload);
      setStorageBackend(store);

      const settings = loadSettings();
      expect(() => loadSettings()).not.toThrow();
      // Everything must land inside its legal range whatever was stored.
      expect(settings.fov).toBeGreaterThanOrEqual(CAMERA.FOV_MIN);
      expect(settings.fov).toBeLessThanOrEqual(CAMERA.FOV_MAX);
      expect(settings.masterVolume).toBeGreaterThanOrEqual(0);
      expect(settings.masterVolume).toBeLessThanOrEqual(1);
      expect(settings.movementSensitivity).toBeGreaterThanOrEqual(MOVEMENT.SENSITIVITY_MIN);
      expect(settings.movementSensitivity).toBeLessThanOrEqual(MOVEMENT.SENSITIVITY_MAX);
      expect(['low', 'medium', 'high', 'ultra']).toContain(settings.quality);
      expect(typeof settings.bloom).toBe('boolean');
    });
  }

  it('preserves the valid part of a partially corrupt payload', () => {
    const store = new FakeStorage();
    store.setItem(SETTINGS_KEY, '{"fov":80,"quality":"nonsense","masterVolume":0.25}');
    setStorageBackend(store);
    const settings = loadSettings();
    expect(settings.fov).toBe(80);
    expect(settings.masterVolume).toBe(0.25);
    expect(settings.quality).toBe(DEFAULT_SETTINGS.quality);
  });

  it('survives storage that throws on every call', () => {
    setStorageBackend(new HostileStorage());
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS)).toBe(false);
  });

  it('clamps directly supplied values too', () => {
    expect(normaliseSettings({ fov: -100 }).fov).toBe(CAMERA.FOV_MIN);
    expect(normaliseSettings({ cameraShake: 5 }).cameraShake).toBe(1);
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('visual intensity setting', () => {
  it('defaults to full and survives a round trip', () => {
    setStorageBackend(new FakeStorage());
    expect(DEFAULT_SETTINGS.visualIntensity).toBe(1);
    saveSettings({ ...DEFAULT_SETTINGS, visualIntensity: 0.35 });
    expect(loadSettings().visualIntensity).toBeCloseTo(0.35);
  });

  it('clamps out-of-range and falls back on wrong types', () => {
    expect(normaliseSettings({ visualIntensity: 7 }).visualIntensity).toBe(1);
    expect(normaliseSettings({ visualIntensity: -2 }).visualIntensity).toBe(0);
    expect(normaliseSettings({ visualIntensity: 'max' }).visualIntensity).toBe(1);
  });

  it('reads settings saved before the field existed', () => {
    const legacy: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete legacy.visualIntensity;
    expect(normaliseSettings(legacy).visualIntensity).toBe(DEFAULT_SETTINGS.visualIntensity);
  });
});

describe('statistics persistence', () => {
  it('round-trips lifetime statistics', () => {
    setStorageBackend(new FakeStorage());
    const stats = {
      bestScore: 160_974,
      bestTime: 93.4,
      bestCombo: 6,
      bestSpeed: 118,
      totalRuns: 12,
      totalObstaclesPassed: 340,
      totalNearMisses: 87,
    };
    expect(saveStats(stats)).toBe(true);
    expect(loadStats()).toEqual({ ...stats, bestScore: 160_974 });
  });

  it('rejects negative and non-numeric values', () => {
    const store = new FakeStorage();
    store.setItem(
      STATS_KEY,
      '{"bestScore":-5,"bestCombo":"six","totalRuns":2.9,"bestTime":null}',
    );
    setStorageBackend(store);
    const stats = loadStats();
    expect(stats.bestScore).toBe(0);
    expect(stats.bestCombo).toBe(0);
    expect(stats.totalRuns).toBe(2);
    expect(stats.bestTime).toBe(0);
  });

  it('falls back cleanly on unparseable data', () => {
    const store = new FakeStorage();
    store.setItem(STATS_KEY, '<<<corrupt>>>');
    setStorageBackend(store);
    expect(loadStats()).toEqual(DEFAULT_STATS);
  });

  it('normalises anything at all without throwing', () => {
    for (const input of [null, undefined, 5, 'x', [], {}, { bestScore: NaN }]) {
      expect(() => normaliseStats(input)).not.toThrow();
      expect(normaliseStats(input).bestScore).toBe(0);
    }
  });

  it('merges a finished run into the lifetime totals', () => {
    const score = createScoreState();
    for (let i = 0; i < 4; i += 1) registerClear(score, 'RING');
    const run = buildRunStats(score, 42.5, 96, 100);
    const merged = mergeStats(DEFAULT_STATS, run);
    expect(merged.totalRuns).toBe(1);
    expect(merged.totalObstaclesPassed).toBe(4);
    expect(merged.bestTime).toBe(42.5);
    expect(merged.bestSpeed).toBe(96);
    expect(merged.bestScore).toBe(run.score);
  });

  it('flags a new best only when the score actually beats the record', () => {
    const score = createScoreState();
    registerClear(score, 'STATIC_GATE');
    expect(buildRunStats(score, 1, 30, 0).isNewBest).toBe(true);
    expect(buildRunStats(score, 1, 30, 1_000_000).isNewBest).toBe(false);
  });
});
