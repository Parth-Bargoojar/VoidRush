/**
 * VOIDRUSH — central gameplay configuration.
 *
 * Every gameplay constant lives in `src/config`. No gameplay number may appear
 * as a literal anywhere else in the codebase.
 *
 * Values marked [PRD] / [TRD] / [Design] are mandated by the project
 * documentation and take precedence over the build directive's defaults.
 * Divergences are recorded in CONTEXT.md under "Ambiguity Ledger".
 */

import { frozen } from './frozen';

/* ------------------------------------------------------------------ *
 * Timing
 * ------------------------------------------------------------------ */

export const TIMING = frozen({
  /**
   * Simulation step. The documents specify 60 FPS as the *render* target; the
   * TRD only requires "fixed timestep" for the simulation, so we step at 120 Hz
   * for collision headroom and render once per animation frame.
   */
  FIXED_DT: 1 / 120,
  /** Clamps tab stalls and debugger breakpoints. */
  MAX_FRAME_DELTA: 0.25,
  /** Excess beyond this is dropped and counted as a frame skip. */
  MAX_STEPS_PER_FRAME: 8,
  /** Rate at which the engine pushes HUD snapshots to React. */
  HUD_PUSH_HZ: 15,
  /** Accumulator tolerance, so 1/30 s and 1/144 s frames yield equal step counts. */
  ACCUMULATOR_EPSILON: 1e-9,
});

/* ------------------------------------------------------------------ *
 * World space
 * ------------------------------------------------------------------ */

export const WORLD = frozen({
  /** Tunnel interior is 24 x 24, centred on the Z axis. */
  TUNNEL_HALF_WIDTH: 12,
  TUNNEL_HALF_HEIGHT: 12,
  /** The player may not leave this box. Tunnel walls themselves are decorative. */
  PLAYER_CLAMP: 10,
  PLAYER_RADIUS: 0.6,
  /** Obstacles are created here and advance toward the camera at +Z. */
  SPAWN_Z: -420,
  /** Recycled once past this. */
  DESPAWN_Z: 25,
  /** An obstacle counts as cleared once its far face passes this plane. */
  CLEAR_Z: 1,
  /**
   * [PRD] 30-50 world units per segment. Twelve segments of 45 cover 540 units,
   * which leaves enough slack that the tunnel still spans the spawn plane even
   * at the moment just before a segment is recycled.
   */
  SEGMENT_LENGTH: 45,
  /** [PRD] 8-12 active segments. */
  SEGMENT_COUNT: 12,
  /** [TRD] 10-30 active obstacles. */
  MAX_ACTIVE_OBSTACLES: 14,
  /** Collision-safety floor: no solid part may be thinner than this along Z. */
  MIN_PART_DEPTH: 4,
  /** Voxel block edge length for tunnel walls. [PRD] 1-3 world units. */
  BLOCK_SIZE: 3,
  /** Maximum inward protrusion of a wall block. */
  BLOCK_PROTRUSION: 1.2,
  /** Generate this many obstacles beyond the spawn point. */
  GENERATION_LOOKAHEAD: 2,
});

/* ------------------------------------------------------------------ *
 * Player movement
 * ------------------------------------------------------------------ */

export const MOVEMENT = frozen({
  /** [PRD] Maximum lateral and vertical speed: 14 units/s. */
  MAX_LATERAL_SPEED: 14,
  /**
   * [PRD] Movement damping: 10. Expressed as the time constant of the
   * critically damped response, TAU = 1 / damping.
   */
  DAMPING: 10,
  TAU: 1 / 10,
  SENSITIVITY_MIN: 0.6,
  SENSITIVITY_MAX: 1.6,
  SENSITIVITY_DEFAULT: 1,
});

/* ------------------------------------------------------------------ *
 * Forward speed
 * ------------------------------------------------------------------ */

export const SPEED = frozen({
  /** [PRD] Starting speed: 30 units/s. */
  START: 30,
  /** [PRD] Maximum intended speed: approximately 100-120 units/s. */
  MAX: 120,
  /** Linear ramp; reaches MAX at the start of the OVERLOAD phase (120 s). */
  RAMP: 0.75,
});

/* ------------------------------------------------------------------ *
 * Camera
 * ------------------------------------------------------------------ */

export const CAMERA = frozen({
  /** [PRD] Base FOV 75 degrees. */
  FOV_BASE: 75,
  /** [PRD] Up to approximately 90 degrees at top speed. */
  FOV_SPEED_GAIN: 15,
  FOV_MIN: 65,
  FOV_MAX: 95,
  /** The field-of-view setting a new player starts on: the widest view. */
  FOV_DEFAULT: 95,
  FOV_SMOOTH_TAU: 0.4,
  /** [PRD] Maximum roll approximately +/-5 degrees. */
  MAX_ROLL: (5 * Math.PI) / 180,
  ROLL_TAU: 0.12,
  /** Positional lag so movement reads as inertial without feeling floaty. */
  POSITION_LAG_TAU: 0.04,
  NEAR_CLIP: 0.1,
  /** [PRD] Far clip 500+. */
  FAR_CLIP: 600,
  /** The camera-shake setting a new player starts on: full strength. */
  SHAKE_DEFAULT: 1,
  SHAKE_COLLISION: 1,
  SHAKE_COMBO: 0.35,
  SHAKE_DECAY_TAU: 0.18,
  /** World units of camera displacement at full shake. */
  SHAKE_AMPLITUDE: 1.6,
  /** Combo milestone interval that triggers a shake pulse. */
  COMBO_SHAKE_INTERVAL: 5,
});

/* ------------------------------------------------------------------ *
 * Collision, passage and near miss
 * ------------------------------------------------------------------ */

export const COLLISION = frozen({
  /** Sub-samples taken across the slab crossing: entry, midpoint, exit. */
  SWEEP_SAMPLES: 3,
  /**
   * [PRD] Near-miss tiers by minimum surface-to-surface distance.
   * Tuned in QA so the observed rate sits inside the 15-35% band.
   */
  NEAR_MISS_CLOSE: 1.5,
  NEAR_MISS_NEAR: 0.9,
  NEAR_MISS_EXTREME: 0.45,
});

/* ------------------------------------------------------------------ *
 * Collision feedback timing
 * ------------------------------------------------------------------ */

export const IMPACT = frozen({
  /** [PRD] Freeze/slow gameplay for approximately 100 ms. */
  FREEZE_SECONDS: 0.1,
  /** [PRD] Total collision feedback duration: 0.7-1.2 seconds. */
  TOTAL_SECONDS: 0.9,
});

/* ------------------------------------------------------------------ *
 * Obstacle geometry
 * ------------------------------------------------------------------ */

export const OBSTACLE = frozen({
  /** Half-depth along Z of a standard obstacle body (full depth 4.0). */
  DEPTH_HALF: 2,
  /** Cage bodies are deep, so the player must hold a line through them. */
  CAGE_DEPTH_HALF: 4,
  /** The cage tube circumscribes its declared circular opening by this factor. */
  CAGE_INTERIOR_FACTOR: 1.2,
  CAGE_RAIL_HALF: 0.45,
  CAGE_RAIL_OVERHANG: 1.08,
  /** Voxel cell size used to tile discs, annuli and slabs into boxes. */
  CELL: 2,
  /** Solid hub radius at the centre of cross/fan obstacles. */
  HUB_RADIUS: 1.2,
  /** Arm/blade half-thickness for cross and fan obstacles. */
  ARM_HALF_THICKNESS: 0.9,
  /** Radius of the solid core a bullseye's passable band must clear. */
  BULLSEYE_CORE: 1.6,
  FAN_BLADES_MIN: 3,
  FAN_BLADES_MAX: 6,
  /** Fans turn faster than crosses at the same difficulty. */
  FAN_SPIN_FACTOR: 1.35,
  /** Longitudinal separation between combination sub-layers. */
  COMBINATION_GAP_MIN: 12,
  COMBINATION_GAP_MAX: 24,
  COMBINATION_LAYERS_MIN: 2,
  COMBINATION_LAYERS_MAX: 3,
  /** Keeps sub-layer ids distinct from top-level obstacle ids. */
  COMBINATION_ID_STRIDE: 8,
});

/* ------------------------------------------------------------------ *
 * Generation and reachability
 * ------------------------------------------------------------------ */

export const GENERATION = frozen({
  /** Fraction of the conservative reach budget an opening may demand. */
  REACH_SAFETY: 0.7,
  /** The player is charged two time constants to accelerate and settle. */
  REACH_TAU_CHARGE: 2,
  /** Half-width of the crossing window an opening must remain valid across. */
  TIMING_WINDOW: 0.12,
  /** Resample attempts before emitting the guaranteed-safe fallback. */
  MAX_ATTEMPTS: 12,
  /** Openings are inset this far from the clamp boundary. */
  OPENING_INSET: 0.4,
  /** Minimum opening half-extent, whatever the difficulty says. */
  ABSOLUTE_MIN_OPENING: 2,
});

/* ------------------------------------------------------------------ *
 * Rendering budgets
 * ------------------------------------------------------------------ */

export const RENDER = frozen({
  PIXEL_RATIO_CAP: 2,
  PIXEL_RATIO_LOW: 1,
  PIXEL_RATIO_MEDIUM: 1.5,
  PIXEL_RATIO_HIGH: 2,
  PIXEL_RATIO_ULTRA: 2,
  /** Distance fade. Obstacles reach full opacity by -340. */
  FOG_NEAR: 340,
  FOG_FAR: 415,
  /** Instance capacity for a single obstacle body. */
  OBSTACLE_INSTANCE_CAPACITY: 384,
  /** Auto-downgrade quality if the frame time exceeds this for a sustained run. */
  FRAME_TIME_BUDGET_MS: 22,
  FRAME_TIME_SAMPLES: 120,
});
