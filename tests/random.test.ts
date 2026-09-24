import { describe, expect, it } from 'vitest';
import { Rng, mulberry32, seedFromString, weightedPick } from '../src/utils/Random';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 1000; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let identical = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (a() === b()) identical += 1;
    }
    expect(identical).toBe(0);
  });

  it('stays inside [0, 1)', () => {
    const gen = mulberry32(999);
    for (let i = 0; i < 100_000; i += 1) {
      const value = gen();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is roughly uniform across ten buckets', () => {
    const gen = mulberry32(7);
    const buckets = new Array<number>(10).fill(0);
    const samples = 200_000;
    for (let i = 0; i < samples; i += 1) {
      buckets[Math.floor(gen() * 10)]! += 1;
    }
    const expected = samples / 10;
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });

  it('has a mean near 0.5', () => {
    const gen = mulberry32(31337);
    let sum = 0;
    const samples = 200_000;
    for (let i = 0; i < samples; i += 1) sum += gen();
    expect(Math.abs(sum / samples - 0.5)).toBeLessThan(0.005);
  });
});

describe('Rng', () => {
  it('reproduces a full sequence from the same seed', () => {
    const a = new Rng(555);
    const b = new Rng(555);
    for (let i = 0; i < 500; i += 1) {
      expect(a.range(-10, 10)).toBe(b.range(-10, 10));
      expect(a.int(0, 7)).toBe(b.int(0, 7));
      expect(a.chance(0.3)).toBe(b.chance(0.3));
    }
  });

  it('forks into independent but reproducible streams', () => {
    const parent = new Rng(88);
    const forkA = parent.fork();
    const parent2 = new Rng(88);
    const forkB = parent2.fork();
    for (let i = 0; i < 100; i += 1) {
      expect(forkA.next()).toBe(forkB.next());
    }
  });

  it('int stays in range and pick never returns undefined', () => {
    const rng = new Rng(4);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 5000; i += 1) {
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(9);
      expect(items).toContain(rng.pick(items));
    }
  });

  it('throws when picking from an empty array', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });
});

describe('weightedPick', () => {
  it('respects the supplied weights', () => {
    const rng = new Rng(2024);
    const counts = { a: 0, b: 0 };
    const samples = 60_000;
    for (let i = 0; i < samples; i += 1) {
      counts[weightedPick(rng, [['a', 3], ['b', 1]] as const)] += 1;
    }
    expect(counts.a / samples).toBeGreaterThan(0.72);
    expect(counts.a / samples).toBeLessThan(0.78);
  });
});

describe('seedFromString', () => {
  it('is stable and fits in 32 bits', () => {
    expect(seedFromString('voidrush')).toBe(seedFromString('voidrush'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
    expect(seedFromString('anything')).toBeLessThanOrEqual(0xffffffff);
    expect(seedFromString('anything')).toBeGreaterThanOrEqual(0);
  });
});
