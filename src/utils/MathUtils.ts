/** VOIDRUSH — small numeric helpers shared by the simulation and the renderer. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return clamp01((value - a) / (b - a));
}

/** Ease-in-out curve used to shape the difficulty ramp. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Frame-rate independent exponential approach. Returns the new value after
 * `dt` seconds of moving toward `target` with time constant `tau`.
 */
export function damp(current: number, target: number, tau: number, dt: number): number {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Squared distance in 2D, avoiding a square root in hot loops. */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function hypot2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Distance from a point to the surface of an oriented box, in the box's plane.
 * Negative when the point is inside. `rot` is a rotation about Z.
 */
export function pointToBoxDistance(
  px: number,
  py: number,
  pz: number,
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  rot: number,
): number {
  let lx = px - cx;
  let ly = py - cy;
  if (rot !== 0) {
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const rx = lx * c - ly * s;
    const ry = lx * s + ly * c;
    lx = rx;
    ly = ry;
  }
  const lz = pz - cz;

  const dx = Math.abs(lx) - hx;
  const dy = Math.abs(ly) - hy;
  const dz = Math.abs(lz) - hz;

  // Outside distance along each axis, clamped at zero.
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  const oz = Math.max(dz, 0);
  const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);

  if (outside > 0) return outside;
  // Fully inside: the (negative) distance to the nearest face.
  return Math.max(dx, Math.max(dy, dz));
}

/** Formats seconds as M:SS for the HUD and results screen. */
export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Formats an integer with thousands separators, without locale dependence. */
export function formatNumber(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
