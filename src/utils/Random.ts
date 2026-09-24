/**
 * VOIDRUSH — deterministic random number generation.
 *
 * `Math.random` appears nowhere in gameplay code. Every consumer is handed an
 * `RngLike`, so a seed plus an input script reproduces a run exactly.
 */

import type { RngLike } from '../types';

/**
 * mulberry32: a 32-bit-state PRNG. Fast, well-distributed for game use, and
 * trivially reproducible across platforms because all arithmetic is forced
 * through 32-bit integer operations.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng implements RngLike {
  private readonly gen: () => number;
  private readonly seed: number;
  private draws = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.gen = mulberry32(this.seed);
  }

  next(): number {
    this.draws += 1;
    return this.gen();
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxExclusive: number): number {
    if (maxExclusive <= min) return min;
    return min + Math.floor(this.next() * (maxExclusive - min));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[this.int(0, items.length)]!;
  }

  /**
   * A new generator derived from this one. Used so that, for example, tunnel
   * decoration cannot perturb the obstacle sequence.
   */
  fork(): RngLike {
    return new Rng(Math.floor(this.next() * 0xffffffff) >>> 0);
  }

  /** Number of values drawn so far. Used by determinism assertions. */
  get drawCount(): number {
    return this.draws;
  }

  get initialSeed(): number {
    return this.seed;
  }
}

/**
 * Picks an item from `[item, weight]` pairs. Weights need not sum to one.
 */
export function weightedPick<T>(rng: RngLike, entries: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = rng.next() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1]![0];
}

/** Derives a stable 32-bit seed from a string, for `?seed=` overrides. */
export function seedFromString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
