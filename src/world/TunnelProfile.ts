/**
 * VOIDRUSH — the tunnel's shape along the run.
 *
 * [PRD 6] The tunnel's width, height, cross-section, roll, wall pattern and
 * light placement are defined at keyframes spaced a few segments apart and
 * eased between them, so the tunnel morphs progressively rather than jumping.
 *
 * A keyframe is a pure function of the run seed, its index and the difficulty
 * at the distance it sits at. The shape at any distance is therefore
 * reproducible and cheap to re-derive when a segment is recycled, exactly like
 * the block pattern itself.
 */

import {
  CROSS_SECTION_WEIGHTS,
  TIER_ALLOWS_SHAPE_VARIATION,
  TUNNEL,
  WALL_PATTERNS,
  type CrossSection,
  type WallPattern,
} from '../config/TunnelConfig';
import { WORLD } from '../config/GameConfig';
import { DifficultyManager } from '../game/DifficultyManager';
import { clamp, lerp, smoothstep } from '../utils/MathUtils';
import { mulberry32 } from '../utils/Random';
import type { DifficultyTier } from '../types';

/** The tunnel's shape at one point along the run. */
export interface TunnelShape {
  /** Half-extent of the side walls' surface from the tunnel axis. */
  halfWidth: number;
  /** Half-extent of the floor and ceiling surfaces from the tunnel axis. */
  halfHeight: number;
  /** Rotation of the cross-section about the forward axis, in radians. */
  roll: number;
  /** 0 is rectangular; 1 cuts the corners as far as fairness allows. */
  chamfer: number;
  /** Extra inward protrusion allowed for irregular walls, in world units. */
  roughness: number;
  /** Point-light placement, as fractions of the half-extents in [-1, 1]. */
  lightX: number;
  lightY: number;
  /** Wall pattern. Changes only at keyframes, which fall on segment boundaries. */
  pattern: WallPattern;
}

interface Keyframe extends TunnelShape {
  crossSection: CrossSection;
}

/** Lights may hang centrally, from the ceiling, over the floor or on a wall. */
const LIGHT_POSITIONS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0, 0],
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
] as ReadonlyArray<readonly [number, number]>);

/** Distance covered by one keyframe interval. */
export const SECTION_LENGTH = TUNNEL.SECTION_SEGMENTS * WORLD.SEGMENT_LENGTH;

/** Salts keep this stream independent of the block and obstacle streams. */
const KEYFRAME_SALT = 0x7a11e5;

/**
 * Largest roll that keeps a cross-section whose nearest inner face sits
 * `innerHalf` from the axis clear of the reachable box. A square of half-size
 * `SAFE_HALF` rotated by θ reaches `SAFE_HALF (cos θ + sin θ)` along a wall
 * normal, so the bound solves that for θ.
 */
export function allowedRoll(innerHalf: number): number {
  const k = innerHalf / TUNNEL.SAFE_HALF;
  if (k <= 1) return 0;
  if (k >= Math.SQRT2) return Math.PI / 4;
  return Math.asin(k / Math.SQRT2) - Math.PI / 4;
}

function pickVariant(r: number): number {
  // Narrow, standard, wide — standard is twice as likely as either extreme.
  if (r < 0.25) return -1;
  if (r < 0.75) return 0;
  return 1;
}

function pickCrossSection(r: number): CrossSection {
  let total = 0;
  for (const [, weight] of CROSS_SECTION_WEIGHTS) total += weight;
  let roll = r * total;
  for (const [section, weight] of CROSS_SECTION_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return section;
  }
  return CROSS_SECTION_WEIGHTS[CROSS_SECTION_WEIGHTS.length - 1]![0];
}

function createKeyframe(): Keyframe {
  return {
    halfWidth: TUNNEL.WIDTH_START,
    halfHeight: TUNNEL.WIDTH_START,
    roll: 0,
    chamfer: 0,
    roughness: 0,
    lightX: 0,
    lightY: 0,
    pattern: 'SCATTER',
    crossSection: 'RECT',
  };
}

/** Keyframes kept per profile. Sampling only ever needs two adjacent ones. */
const CACHE_SIZE = 4;

export class TunnelProfile {
  private readonly difficulty: DifficultyManager;
  private seed = 1;
  /** Behind the menu the tunnel keeps its opening shape: no run is under way. */
  private menu = false;
  private readonly cache: Keyframe[] = [];
  private readonly cacheKeys: number[] = [];

  constructor(difficulty: DifficultyManager = new DifficultyManager()) {
    this.difficulty = difficulty;
    for (let i = 0; i < CACHE_SIZE; i += 1) {
      this.cache.push(createKeyframe());
      this.cacheKeys.push(-1);
    }
  }

  reset(seed: number, menu = false): void {
    this.seed = seed >>> 0;
    this.menu = menu;
    this.cacheKeys.fill(-1);
  }

  get currentSeed(): number {
    return this.seed;
  }

  get isMenu(): boolean {
    return this.menu;
  }

  /** The keyframe at index `k`, which sits at distance `k * SECTION_LENGTH`. */
  keyframe(k: number): Readonly<Keyframe> {
    const index = Math.max(0, Math.floor(k));
    const slot = index % CACHE_SIZE;
    const cached = this.cache[slot]!;
    if (this.cacheKeys[slot] === index) return cached;
    this.computeKeyframe(index, cached);
    this.cacheKeys[slot] = index;
    return cached;
  }

  private computeKeyframe(k: number, out: Keyframe): void {
    const rng = mulberry32((this.seed ^ Math.imul(k + 1, 0x85ebca6b) ^ KEYFRAME_SALT) >>> 0);
    // Every draw happens unconditionally, so the stream does not shift when a
    // phase boundary changes which of them are used.
    const rWidth = rng();
    const rHeight = rng();
    const rSection = rng();
    const rRoll = rng();
    const rLight = rng();
    const rPattern = rng();

    let base: number = TUNNEL.WIDTH_START;
    let tier: DifficultyTier = 'INTRO';
    if (!this.menu) {
      const time = this.difficulty.timeAtDistance(k * SECTION_LENGTH);
      base = lerp(TUNNEL.WIDTH_START, TUNNEL.WIDTH_END, this.difficulty.normalised(time));
      tier = this.difficulty.tierAt(time);
    }

    const light = LIGHT_POSITIONS[Math.floor(rLight * LIGHT_POSITIONS.length)] ?? LIGHT_POSITIONS[0]!;
    out.lightX = light[0];
    out.lightY = light[1];
    out.pattern = WALL_PATTERNS[Math.floor(rPattern * WALL_PATTERNS.length)] ?? 'SCATTER';

    if (!TIER_ALLOWS_SHAPE_VARIATION[tier]) {
      // [PRD 17] INTRO and BUILD: the large rectangular tunnel, no roll.
      out.halfWidth = base;
      out.halfHeight = base;
      out.crossSection = 'RECT';
      out.chamfer = 0;
      out.roughness = 0;
      out.roll = 0;
      return;
    }

    out.halfWidth = clamp(
      base + pickVariant(rWidth) * TUNNEL.VARIANT_STEP,
      TUNNEL.HALF_MIN,
      TUNNEL.HALF_MAX,
    );
    out.halfHeight = clamp(
      base + pickVariant(rHeight) * TUNNEL.VARIANT_STEP,
      TUNNEL.HALF_MIN,
      TUNNEL.HALF_MAX,
    );
    out.crossSection = pickCrossSection(rSection);
    out.chamfer = out.crossSection === 'POLYGONAL' ? 1 : 0;
    out.roughness = out.crossSection === 'IRREGULAR' ? TUNNEL.IRREGULAR_PROTRUSION : 0;

    // Roll only as far as this keyframe's own dimensions allow, so the
    // generator's safety guard rarely has to widen anything.
    const maxProtrusion = WORLD.BLOCK_PROTRUSION + out.roughness;
    const limit = Math.min(
      TUNNEL.ROLL_MAX,
      allowedRoll(Math.min(out.halfWidth, out.halfHeight) - maxProtrusion),
    );
    out.roll = (rRoll * 2 - 1) * limit;
  }

  /**
   * The tunnel's shape at run distance `distance`, eased between the two
   * keyframes that bracket it. Writes into `out` and allocates nothing.
   */
  sample(distance: number, out: TunnelShape): TunnelShape {
    const position = Math.max(0, distance) / SECTION_LENGTH;
    const k = Math.floor(position);
    const t = smoothstep(position - k);
    const a = this.keyframe(k);
    const b = this.keyframe(k + 1);

    out.halfWidth = lerp(a.halfWidth, b.halfWidth, t);
    out.halfHeight = lerp(a.halfHeight, b.halfHeight, t);
    out.roll = lerp(a.roll, b.roll, t);
    out.chamfer = lerp(a.chamfer, b.chamfer, t);
    out.roughness = lerp(a.roughness, b.roughness, t);
    out.lightX = lerp(a.lightX, b.lightX, t);
    out.lightY = lerp(a.lightY, b.lightY, t);
    out.pattern = a.pattern;
    return out;
  }
}

export function createTunnelShape(): TunnelShape {
  return {
    halfWidth: TUNNEL.WIDTH_START,
    halfHeight: TUNNEL.WIDTH_START,
    roll: 0,
    chamfer: 0,
    roughness: 0,
    lightX: 0,
    lightY: 0,
    pattern: 'SCATTER',
  };
}
