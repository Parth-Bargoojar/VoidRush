/**
 * VOIDRUSH — obstacle shape builders.
 *
 * Every builder appends axis-aligned boxes in obstacle-local space. These boxes
 * are simultaneously the collision volumes and the rendered geometry: the
 * renderer is driven from the same array, so a solid that is visible but not
 * collidable cannot exist by construction.
 *
 * Coverage rules that keep generation fair:
 *  - A non-spinning body must cover the square |x|,|y| <= COVER_SQUARE, which
 *    contains the player clamp box grown by the player radius.
 *  - A spinning body must cover the disc r <= COVER_DISC, because a square
 *    would expose its corners as it rotates.
 *  - [PRD 6] Every body also reaches OBSTACLE_FRAME_OUTER, the widest wall the
 *    varying tunnel can present, so a wide section never shows open air around
 *    an obstacle that the player cannot actually use. Where the tunnel is
 *    narrower, the excess sits hidden behind the wall blocks.
 */

import { GENERATION, OBSTACLE, WORLD } from '../config/GameConfig';
import { OBSTACLE_FRAME_DEPTH_FACTOR, OBSTACLE_FRAME_OUTER, TUNNEL } from '../config/TunnelConfig';
import type { ObstaclePart, PartRole } from '../types';

/** Half-size of the square a static body must cover to block every position. */
export const COVER_SQUARE = WORLD.PLAYER_CLAMP + WORLD.PLAYER_RADIUS + 0.9;

/**
 * Openings must sit inside the player clamp box, inset by the player radius
 * plus a safety margin, so the whole stated opening is genuinely usable.
 */
export const OPENING_BOUND =
  WORLD.PLAYER_CLAMP - WORLD.PLAYER_RADIUS - GENERATION.OPENING_INSET;

/** Largest opening half-extent that still fits inside the bound at (cx, cy). */
export function openingLimitInBox(cx: number, cy: number): number {
  return Math.min(OPENING_BOUND - Math.abs(cx), OPENING_BOUND - Math.abs(cy));
}

/** The smallest opening the fairness rules will ever accept. */
export function minimumOpening(reachMargin: number): number {
  return Math.max(
    WORLD.PLAYER_RADIUS + reachMargin,
    GENERATION.ABSOLUTE_MIN_OPENING,
  );
}

/**
 * Radius a spinning body must cover. At minimum the far corner of the clamp
 * box; in practice the corner of its static frame, so that the disc and the
 * frame together leave no unplanned gap at any angle.
 */
export const COVER_DISC = Math.max(
  Math.hypot(WORLD.PLAYER_CLAMP, WORLD.PLAYER_CLAMP) + WORLD.PLAYER_RADIUS + 0.8,
  TUNNEL.SPIN_FRAME_INNER * Math.SQRT2 + 0.3,
);

/** Half-size every obstacle body extends to, for the widest tunnel section. */
export const FRAME_OUTER = OBSTACLE_FRAME_OUTER;

/** Beyond this radius a spinning body may use a coarser voxel cell. */
export const COARSE_FROM = WORLD.TUNNEL_HALF_WIDTH;
export const COARSE_CELL = 3.5;

export function addBox(
  parts: ObstaclePart[],
  ox: number,
  oy: number,
  oz: number,
  hx: number,
  hy: number,
  hz: number,
  spins: boolean,
  role: PartRole,
): void {
  if (hx <= 0 || hy <= 0 || hz <= 0) return;
  parts.push({
    ox,
    oy,
    oz,
    hx,
    hy,
    hz: Math.max(hz, WORLD.MIN_PART_DEPTH / 2),
    spins,
    role,
  });
}

/**
 * A slab spanning `extent` in both axes with a rectangular hole cut out of it.
 * Built from four exact boxes, so the hole is exactly the size requested.
 */
export function addSlabWithRectHole(
  parts: ObstaclePart[],
  holeX: number,
  holeY: number,
  holeHX: number,
  holeHY: number,
  extent: number,
  depthHalf: number,
  role: PartRole,
  accentRole: PartRole = 'accent',
): void {
  const left = -extent;
  const right = extent;
  const bottom = -extent;
  const top = extent;

  const holeLeft = holeX - holeHX;
  const holeRight = holeX + holeHX;
  const holeBottom = holeY - holeHY;
  const holeTop = holeY + holeHY;

  // Left and right panels span the full height.
  if (holeLeft > left) {
    const w = (holeLeft - left) / 2;
    addBox(parts, left + w, 0, 0, w, extent, depthHalf, false, role);
  }
  if (right > holeRight) {
    const w = (right - holeRight) / 2;
    addBox(parts, holeRight + w, 0, 0, w, extent, depthHalf, false, role);
  }
  // Top and bottom panels only span the hole's width.
  if (top > holeTop) {
    const h = (top - holeTop) / 2;
    addBox(parts, holeX, holeTop + h, 0, holeHX, h, depthHalf, false, role);
  }
  if (holeBottom > bottom) {
    const h = (holeBottom - bottom) / 2;
    addBox(parts, holeX, bottom + h, 0, holeHX, h, depthHalf, false, role);
  }

  // Emissive lip around the opening so the gap boundary reads at speed.
  const lip = 0.35;
  addBox(parts, holeLeft - lip, holeY, 0, lip, holeHY + lip * 2, depthHalf * 1.05, false, accentRole);
  addBox(parts, holeRight + lip, holeY, 0, lip, holeHY + lip * 2, depthHalf * 1.05, false, accentRole);
  addBox(parts, holeX, holeBottom - lip, 0, holeHX, lip, depthHalf * 1.05, false, accentRole);
  addBox(parts, holeX, holeTop + lip, 0, holeHX, lip, depthHalf * 1.05, false, accentRole);
}

/**
 * Voxelises the square |x|,|y| <= extent, skipping cells that intersect a
 * circular hole. A cell is emitted only when it lies entirely outside the hole,
 * so the requested hole radius is always fully clear.
 */
export function addGridWithCircularHole(
  parts: ObstaclePart[],
  extent: number,
  cell: number,
  holeCx: number,
  holeCy: number,
  holeR: number,
  depthHalf: number,
  role: PartRole,
  accentRole: PartRole,
): void {
  const half = cell / 2;
  const cellDiag = half * Math.SQRT2;
  const steps = Math.ceil(extent / cell);
  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iy = -steps; iy <= steps; iy += 1) {
      const cx = ix * cell;
      const cy = iy * cell;
      const d = Math.hypot(cx - holeCx, cy - holeCy);
      if (d - cellDiag < holeR) continue;
      // Cells hugging the hole get the accent colour: this is the gap boundary.
      const isRim = d - cellDiag < holeR + cell;
      addBox(parts, cx, cy, 0, half, half, depthHalf, false, isRim ? accentRole : role);
    }
  }
}

/**
 * Voxelises an annular band, optionally skipping a circular hole. Used for
 * spinning bodies, where only a disc gives rotation-invariant coverage.
 */
export function addVoxelBand(
  parts: ObstaclePart[],
  rInner: number,
  rOuter: number,
  cell: number,
  holeCx: number,
  holeCy: number,
  holeR: number,
  depthHalf: number,
  spins: boolean,
  role: PartRole,
  accentRole: PartRole,
): void {
  const half = cell / 2;
  const cellDiag = half * Math.SQRT2;
  const steps = Math.ceil(rOuter / cell);
  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iy = -steps; iy <= steps; iy += 1) {
      const cx = ix * cell;
      const cy = iy * cell;
      const r = Math.hypot(cx, cy);
      // Keep a cell only if it lies wholly inside the band.
      if (r - cellDiag < rInner || r + cellDiag > rOuter) continue;
      if (holeR > 0) {
        const d = Math.hypot(cx - holeCx, cy - holeCy);
        if (d - cellDiag < holeR) continue;
        const isRim = d - cellDiag < holeR + cell;
        addBox(parts, cx, cy, 0, half, half, depthHalf, spins, isRim ? accentRole : role);
        continue;
      }
      addBox(parts, cx, cy, 0, half, half, depthHalf, spins, role);
    }
  }
}

/**
 * Fills the disc r <= rOuter, skipping a circular hole. The region beyond
 * COARSE_FROM sits behind the tunnel walls, so it uses a coarser cell.
 */
export function addSpinningDisc(
  parts: ObstaclePart[],
  holeCx: number,
  holeCy: number,
  holeR: number,
  depthHalf: number,
  role: PartRole,
  accentRole: PartRole,
): void {
  addVoxelBand(parts, 0, COARSE_FROM, OBSTACLE.CELL, holeCx, holeCy, holeR, depthHalf, true, role, accentRole);
  // The outer band sits behind the tunnel walls, so it can be coarser — but it
  // still honours the hole, in case a wide opening reaches past COARSE_FROM.
  addVoxelBand(
    parts,
    COARSE_FROM,
    COVER_DISC,
    COARSE_CELL,
    holeCx,
    holeCy,
    holeR,
    depthHalf,
    true,
    role,
    accentRole,
  );
}

/**
 * A static square frame between half-sizes `inner` and `outer`, built from four
 * boxes. It carries a body out to the widest tunnel wall. The frame sits a
 * fraction deeper than the body so shared faces never z-fight.
 */
export function addSquareFrame(
  parts: ObstaclePart[],
  inner: number,
  outer: number,
  depthHalf: number,
  role: PartRole,
): void {
  if (outer <= inner) return;
  const band = (outer - inner) / 2;
  const mid = (outer + inner) / 2;
  const hz = depthHalf * OBSTACLE_FRAME_DEPTH_FACTOR;
  // Top and bottom span the full width; left and right fill between them.
  addBox(parts, 0, mid, 0, outer, band, hz, false, role);
  addBox(parts, 0, -mid, 0, outer, band, hz, false, role);
  addBox(parts, -mid, 0, 0, band, inner, hz, false, role);
  addBox(parts, mid, 0, 0, band, inner, hz, false, role);
}

/** A solid hub at the centre of a cross or fan. */
export function addHub(
  parts: ObstaclePart[],
  radius: number,
  depthHalf: number,
  role: PartRole,
): void {
  addBox(parts, 0, 0, 0, radius, radius, depthHalf, true, role);
}

/**
 * Radial arms or blades, laid out as chains of cubic cells along each spoke.
 *
 * Cells rather than one long rotated box: the part list stays axis-aligned in
 * local space, so the whole body needs only a single rotation about Z, and the
 * chunky cell chain is what gives the arms their voxel silhouette.
 */
export function addArms(
  parts: ObstaclePart[],
  count: number,
  hubR: number,
  outerR: number,
  halfThickness: number,
  depthHalf: number,
  role: PartRole,
  accentRole: PartRole,
): void {
  const span = outerR - hubR;
  if (span <= 0 || count <= 0) return;
  const cells = Math.max(1, Math.ceil(span / OBSTACLE.CELL));
  const step = span / cells;
  const half = Math.max(halfThickness, step / 2);

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let c = 0; c < cells; c += 1) {
      const r = hubR + step * (c + 0.5);
      addBox(
        parts,
        cos * r,
        sin * r,
        0,
        half,
        half,
        depthHalf,
        true,
        c === cells - 1 ? accentRole : role,
      );
    }
  }
}

/**
 * Arms are staircases of axis-aligned cells, so a spoke running diagonally is
 * effectively thicker than its nominal half-thickness. Opening maths uses this
 * inflated value so a validated sector is never optimistic.
 */
export function armEffectiveHalfThickness(halfThickness: number): number {
  return halfThickness * Math.SQRT2;
}

/**
 * Largest circle that fits in the sector between two radial arms, measured at
 * radius `r` along the sector centre line. Conservative: it ignores the extra
 * room available further out, so a validated opening is never optimistic.
 */
export function sectorOpeningRadius(
  r: number,
  sectorHalfAngle: number,
  armHalfThickness: number,
): number {
  return r * Math.sin(sectorHalfAngle) - armHalfThickness;
}

/** Radius at which a sector first admits a circle of the requested size. */
export function radiusForSectorOpening(
  wanted: number,
  sectorHalfAngle: number,
  armHalfThickness: number,
): number {
  return (wanted + armHalfThickness) / Math.sin(sectorHalfAngle);
}
