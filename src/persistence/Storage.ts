/**
 * VOIDRUSH — localStorage access.
 *
 * [TRD] Stored values are validated before use and never executed. If storage
 * is unavailable, disabled, full or corrupt, the game falls back to in-memory
 * defaults and carries on: persistence failing is never allowed to be visible
 * to the player.
 */

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory stand-in used when the browser refuses to give us storage. */
class MemoryBackend implements StorageBackend {
  private readonly map = new Map<string, string>();
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

let backend: StorageBackend | null = null;

function resolveBackend(): StorageBackend {
  if (backend) return backend;
  try {
    // Safari in private mode throws on setItem rather than on access, so probe.
    const probe = '__voidrush_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    backend = globalThis.localStorage;
  } catch {
    backend = new MemoryBackend();
  }
  return backend;
}

/** Replaces the backend. Used by tests; also the recovery path in the app. */
export function setStorageBackend(next: StorageBackend | null): void {
  backend = next;
}

export function readRaw(key: string): string | null {
  try {
    return resolveBackend().getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    resolveBackend().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(key: string): void {
  try {
    resolveBackend().removeItem(key);
  } catch {
    // Nothing to do: the value is already effectively gone.
  }
}

/** A validated numeric field, falling back to `fallback` for anything odd. */
export function readNumber(source: unknown, key: string, fallback: number): number {
  if (typeof source !== 'object' || source === null) return fallback;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

export function readBoolean(source: unknown, key: string, fallback: boolean): boolean {
  if (typeof source !== 'object' || source === null) return fallback;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function readEnum<T extends string>(
  source: unknown,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof source !== 'object' || source === null) return fallback;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Parses JSON, treating any failure as "no stored value". */
export function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
