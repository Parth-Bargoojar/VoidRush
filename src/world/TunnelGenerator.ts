/**
 * VOIDRUSH — procedural tunnel wall geometry.
 *
 * A segment's blocks are a pure function of the run seed, the segment index
 * and the tunnel profile at that distance, so the tunnel is reproducible,
 * non-repeating, and cheap to re-seed when a segment is recycled.
 *
 * [PRD 6] Each row of blocks follows the profile's width, height, roll and
 * cross-section: rectangular, polygonal (chamfered corners) or irregular
 * (rough, pillared walls). The wall pattern — scattered lights, light rings,
 * longitudinal stripes or structural ribs — changes between sections.
 *
 * Fairness does not depend on any of this. Every block is placed so that its
 * inner face stays outside the square the player can reach, which is proved
 * per axis below and asserted by the test suite across seeds and phases.
 */

import { WORLD } from '../config/GameConfig';
import { TUNNEL } from '../config/TunnelConfig';
import { VISUAL } from '../config/VisualConfig';
import { lerp } from '../utils/MathUtils';
import { mulberry32 } from '../utils/Random';
import { TunnelProfile, createTunnelShape, type TunnelShape } from './TunnelProfile';

/** One voxel block on a tunnel wall. */
export interface TunnelBlock {
  x: number;
  y: number;
  /** Z offset within the segment, measured from the segment origin. */
  z: number;
  /** Half-extent of the cube. Protrusion is expressed through x/y, not size. */
  depth: number;
  /** True for emissive accent blocks. */
  accent: boolean;
  /**
   * Which surface the block belongs to: 0 floor, 1 ceiling, 2 left, 3 right,
   * 4-7 the polygonal chamfers.
   */
  wall: number;
  /** Rotation about the forward axis, in radians. */
  rot: number;
}

export type TunnelPattern = TunnelBlock[];

const ROWS = Math.ceil(WORLD.SEGMENT_LENGTH / WORLD.BLOCK_SIZE);
const HALF_BLOCK = WORLD.BLOCK_SIZE / 2;

/** Instance capacity per segment. Generation never exceeds it. */
export const BLOCKS_PER_SEGMENT = TUNNEL.MAX_BLOCKS_PER_SEGMENT;

/**
 * The four flat walls in the tunnel's local (un-rolled) frame. `nx, ny` is the
 * outward normal; the tangent runs along the other axis. Side walls sit at the
 * half-width and span the half-height, and the reverse for floor and ceiling.
 */
const WALLS: ReadonlyArray<{ nx: number; ny: number; side: boolean }> = Object.freeze([
  { nx: 0, ny: -1, side: false },
  { nx: 0, ny: 1, side: false },
  { nx: -1, ny: 0, side: true },
  { nx: 1, ny: 0, side: true },
]);

/** The four chamfer quadrants, as signs of their outward diagonal normals. */
const CHAMFERS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as ReadonlyArray<readonly [number, number]>);

/** How far a square of half-size `half` reaches along a direction at `angle`. */
function supportAlong(half: number, angle: number): number {
  return half * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
}

/**
 * Separation between a block and the square |x|, |y| <= `half` in the XY
 * plane, by the separating-axis theorem over both squares' axes. Positive
 * means clear; negative means they overlap.
 */
export function blockSeparation(block: TunnelBlock, half: number): number {
  const c = Math.cos(block.rot);
  const s = Math.sin(block.rot);
  const h = block.depth;
  // The block's extent projected onto a world axis.
  const blockRadius = h * (Math.abs(c) + Math.abs(s));
  let best = Math.max(
    Math.abs(block.x) - blockRadius - half,
    Math.abs(block.y) - blockRadius - half,
  );
  // The safe square projected onto the block's own axes.
  const squareRadius = half * (Math.abs(c) + Math.abs(s));
  const u = block.x * c + block.y * s;
  const v = -block.x * s + block.y * c;
  best = Math.max(best, Math.abs(u) - h - squareRadius, Math.abs(v) - h - squareRadius);
  return best;
}

/** Profile used when a caller has no tunnel of its own, e.g. a unit test. */
const DEFAULT_PROFILE = new TunnelProfile();
const SCRATCH_SHAPE: TunnelShape = createTunnelShape();

/**
 * Builds the pattern for segment `index`. Blocks protrude inward by a seeded
 * amount, and some are accent blocks whose emissive colour sells depth and
 * speed.
 *
 * `zeroDistance` is the run distance at which the segment's origin reaches the
 * player; segments are laid end to end from -1, so it follows from the index
 * unless the caller says otherwise.
 */
export function generateSegmentPattern(
  seed: number,
  index: number,
  out: TunnelPattern,
  profile?: TunnelProfile,
  zeroDistance: number = (index - 1) * WORLD.SEGMENT_LENGTH,
): TunnelPattern {
  out.length = 0;
  let source = profile;
  if (!source) {
    source = DEFAULT_PROFILE;
    if (source.currentSeed !== seed >>> 0 || source.isMenu) source.reset(seed);
  }

  // Mixing the index into the seed makes each segment independent, so
  // recycling one never disturbs the others.
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);

  for (let row = 0; row < ROWS; row += 1) {
    const offsetInSegment = row * WORLD.BLOCK_SIZE + HALF_BLOCK;
    const z = -offsetInSegment;
    const shape = source.sample(zeroDistance + offsetInSegment, SCRATCH_SHAPE);
    // Rows are numbered along the whole run, so ring and rib spacing carries
    // across segment boundaries unbroken.
    const globalRow = Math.round((zeroDistance + offsetInSegment - HALF_BLOCK) / WORLD.BLOCK_SIZE);
    buildRow(out, rng, shape, z, globalRow);
  }
  return out;
}

/** Appends one ring of blocks at depth `z`. */
function buildRow(
  out: TunnelPattern,
  rng: () => number,
  shape: TunnelShape,
  z: number,
  globalRow: number,
): void {
  const roll = shape.roll;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const maxProtrusion = WORLD.BLOCK_PROTRUSION + shape.roughness;

  // Safety guard: however the profile asks the row to be shaped, no inner face
  // may come nearer the axis than the rolled reachable box reaches.
  const support = supportAlong(TUNNEL.SAFE_HALF, roll);
  const halfWidth = Math.max(shape.halfWidth, support + maxProtrusion);
  const halfHeight = Math.max(shape.halfHeight, support + maxProtrusion);

  // [PRD 6] Polygonal cross-section: corners cut at 45 degrees, never nearer
  // the axis than the reachable box extends along that diagonal.
  const cornerDistance = (halfWidth + halfHeight) / Math.SQRT2;
  const diagonalSupport = Math.max(
    supportAlong(TUNNEL.SAFE_HALF, roll + Math.PI / 4),
    supportAlong(TUNNEL.SAFE_HALF, roll - Math.PI / 4),
  );
  const chamferMin = diagonalSupport + WORLD.BLOCK_PROTRUSION + TUNNEL.CHAMFER_MARGIN;
  const chamferDistance =
    shape.chamfer > 0 && chamferMin < cornerDistance
      ? lerp(cornerDistance, chamferMin, Math.min(1, shape.chamfer))
      : cornerDistance;
  const chamfered = chamferDistance < cornerDistance - HALF_BLOCK;
  const chamferLine = chamferDistance * Math.SQRT2;

  const pattern = shape.pattern;
  const isRibRow = pattern === 'RIBS' && globalRow % TUNNEL.RIB_INTERVAL === 0;
  const isRingRow = pattern === 'RINGS' && globalRow % TUNNEL.RING_INTERVAL === 0;

  /* ---- flat walls ------------------------------------------------------ */
  for (let w = 0; w < WALLS.length; w += 1) {
    const wall = WALLS[w]!;
    const normalExtent = wall.side ? halfWidth : halfHeight;
    const tangentExtent = wall.side ? halfHeight : halfWidth;
    const count = Math.ceil((tangentExtent * 2) / WORLD.BLOCK_SIZE);
    const step = (tangentExtent * 2) / count;
    const centre = Math.floor(count / 2);

    for (let j = 0; j < count; j += 1) {
      // Draws are unconditional so the stream never depends on the pattern.
      const rProtrusion = rng();
      const rAccent = rng();
      const rPillar = rng();

      const along = -tangentExtent + step * (j + 0.5);
      let protrusion = rProtrusion * maxProtrusion;
      if (shape.roughness > 0 && rPillar < TUNNEL.IRREGULAR_PILLAR_CHANCE) {
        protrusion = maxProtrusion;
      }
      if (pattern === 'RIBS') {
        protrusion = isRibRow ? maxProtrusion : Math.min(protrusion, TUNNEL.RIB_FLAT_PROTRUSION);
      }

      const offset = normalExtent + HALF_BLOCK - protrusion;
      // Local, un-rolled position: normal times offset plus tangent times along.
      const lx = wall.nx * offset + (wall.side ? 0 : along);
      const ly = wall.ny * offset + (wall.side ? along : 0);

      if (chamfered && isBehindChamfer(lx, ly, chamferLine)) continue;

      let accent: boolean;
      switch (pattern) {
        case 'RINGS':
          accent = isRingRow;
          break;
        case 'STRIPES':
          accent = j === centre;
          break;
        case 'RIBS':
          accent = isRibRow && rAccent < 0.35;
          break;
        default:
          accent = rAccent < VISUAL.ACCENT_BLOCK_FRACTION;
          break;
      }

      pushBlock(out, lx * cos - ly * sin, lx * sin + ly * cos, z, accent, w, roll);
    }
  }

  /* ---- chamfers -------------------------------------------------------- */
  if (!chamfered) return;
  for (let q = 0; q < CHAMFERS.length; q += 1) {
    const [sx, sy] = CHAMFERS[q]!;
    // Where the chamfer line meets the side wall and the floor/ceiling.
    const p1x = sx * halfWidth;
    const p1y = sy * (chamferLine - halfWidth);
    const p2x = sx * (chamferLine - halfHeight);
    const p2y = sy * halfHeight;
    // Tangent along the chamfer face, and its length plus one block of overlap
    // at each end so the face meets the walls without a seam.
    const tx = -sy / Math.SQRT2;
    const ty = sx / Math.SQRT2;
    const a1 = p1x * tx + p1y * ty;
    const a2 = p2x * tx + p2y * ty;
    const low = Math.min(a1, a2) - HALF_BLOCK;
    const length = Math.abs(a2 - a1) + WORLD.BLOCK_SIZE;
    const count = Math.max(1, Math.ceil(length / WORLD.BLOCK_SIZE));
    const step = length / count;
    const nx = sx / Math.SQRT2;
    const ny = sy / Math.SQRT2;
    const faceRoll = roll + Math.atan2(sy, sx);

    for (let j = 0; j < count; j += 1) {
      const rProtrusion = rng();
      const rAccent = rng();
      const along = low + step * (j + 0.5);
      const protrusion = rProtrusion * WORLD.BLOCK_PROTRUSION;
      const offset = chamferDistance + HALF_BLOCK - protrusion;
      const lx = nx * offset + tx * along;
      const ly = ny * offset + ty * along;

      let accent: boolean;
      switch (pattern) {
        case 'RINGS':
          accent = isRingRow;
          break;
        case 'STRIPES':
          // The four chamfers become continuous light strips down the tunnel.
          accent = true;
          break;
        case 'RIBS':
          accent = false;
          break;
        default:
          accent = rAccent < VISUAL.ACCENT_BLOCK_FRACTION;
          break;
      }

      pushBlock(out, lx * cos - ly * sin, lx * sin + ly * cos, z, accent, 4 + q, faceRoll);
    }
  }
}

/**
 * True when a wall block (axis-aligned in the tunnel's local frame) lies wholly
 * beyond a chamfer face, where it would be hidden and only cost fill rate.
 */
function isBehindChamfer(lx: number, ly: number, chamferLine: number): boolean {
  for (const [sx, sy] of CHAMFERS) {
    if (sx * lx + sy * ly - 2 * HALF_BLOCK >= chamferLine) return true;
  }
  return false;
}

function pushBlock(
  out: TunnelPattern,
  x: number,
  y: number,
  z: number,
  accent: boolean,
  wall: number,
  rot: number,
): void {
  // A hard ceiling so a profile can never overrun the instance buffers.
  if (out.length >= BLOCKS_PER_SEGMENT) return;
  out.push({ x, y, z, depth: HALF_BLOCK, accent, wall, rot });
}

/**
 * A cheap order-sensitive digest of a segment pattern. Tests use it to prove
 * the tunnel does not visibly repeat within a three-minute run.
 */
export function hashPattern(pattern: TunnelPattern): number {
  let h = 2166136261 >>> 0;
  for (const block of pattern) {
    // Protrusion lives in the block's position, so that is what varies.
    h ^= Math.round(block.x * 1000) | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= Math.round(block.y * 1000) | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (block.accent ? 7919 : 0) + block.wall;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
