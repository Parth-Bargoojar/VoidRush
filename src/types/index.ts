/**
 * VOIDRUSH — shared type definitions.
 *
 * Nothing in this file imports Three.js: the simulation core is renderer-free so
 * that it can run under Node for the test suite and the soak harness.
 */

/* ------------------------------------------------------------------ *
 * Random
 * ------------------------------------------------------------------ */

/** Minimal deterministic RNG contract. Every random consumer takes one of these. */
export interface RngLike {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniformly picks one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A new independent generator, deterministically derived from this one. */
  fork(): RngLike;
}

/* ------------------------------------------------------------------ *
 * Geometry / collision
 * ------------------------------------------------------------------ */

/**
 * An oriented box in world space. `rot` is a rotation about the world Z axis
 * (radians); static parts use rot = 0, which the intersection test fast-paths.
 */
export interface CollisionVolume {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
  rot: number;
}

/** A box in obstacle-local space, before the obstacle transform is applied. */
export interface ObstaclePart {
  ox: number;
  oy: number;
  oz: number;
  hx: number;
  hy: number;
  hz: number;
  /** Parts belonging to the spinning body; false for a static frame. */
  spins: boolean;
  /** Which palette slot the renderer should use for this part. */
  role: PartRole;
}

export type PartRole = 'primary' | 'secondary' | 'accent';

/**
 * A traversable region on an obstacle, expressed in world X/Y at some instant.
 * `rect` openings are axis-aligned; `circle` openings use hx as the radius and
 * are rotation-invariant, which is what makes rotating obstacles verifiable.
 */
export interface Opening {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  shape: 'rect' | 'circle';
}

/* ------------------------------------------------------------------ *
 * Obstacles
 * ------------------------------------------------------------------ */

export type ObstacleType =
  | 'STATIC_GATE'
  | 'CROSS'
  | 'RING'
  | 'BULLSEYE'
  | 'MOVING_GATE'
  | 'ROTATING_RING'
  | 'ROTATING_CROSS'
  | 'FAN'
  | 'CAGE'
  | 'COMBINATION';

export type ObstacleLifecycle = 'IDLE' | 'APPROACHING' | 'CLEARED' | 'CONSUMED';

/** The instantaneous rigid transform of an obstacle body. */
export interface ObstacleTransform {
  tx: number;
  ty: number;
  theta: number;
}

/** Everything the generator hands to an obstacle so it can build itself. */
export interface ObstacleSpawnConfig {
  /** Unique per run; reset on pool reuse so score can never double-count. */
  id: number;
  /** World Z of the obstacle origin at spawn (negative = ahead of the player). */
  z: number;
  /** Absolute simulation time at which this obstacle will reach z = 0. */
  tCross: number;
  /** The reachable point the generator wants the opening centred on. */
  targetX: number;
  targetY: number;
  /** Half-extent the opening must provide. */
  openingHalf: number;
  /** Normalised difficulty at spawn time, in [0, 1]. */
  difficulty: number;
  /** Overdrive at spawn time, in [0, 1). Omitted means none. */
  overdrive?: number;
  /** Forward speed used to convert distances into crossing times. */
  speed: number;
}

export interface ObstacleUpdateContext {
  /** Absolute simulation time (seconds since the run started). */
  time: number;
  /** Current forward speed in world units per second. */
  speed: number;
}

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Position at the start of the current fixed step, for swept collision. */
  prevX: number;
  prevY: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /**
   * Optional analog steering from the touch joystick and device tilt, each in
   * [-1, 1] with +Y up. Combined with the digital keys and clamped to unit
   * length, so a half-deflected stick flies at half speed and nothing exceeds
   * full speed.
   */
  axisX?: number;
  axisY?: number;
}

/**
 * Steering as the player controller consumes it, whatever produced it: each
 * axis in [-1, 1], vector length at most 1, +horizontal right, +vertical up.
 */
export interface NormalizedInput {
  horizontal: number;
  vertical: number;
}

/* ------------------------------------------------------------------ *
 * Difficulty
 * ------------------------------------------------------------------ */

export type DifficultyTier = 'INTRO' | 'BUILD' | 'INTENSE' | 'OVERLOAD';

/** Every value the rest of the simulation reads from the difficulty curve. */
export interface DifficultyState {
  /** Normalised scalar in [0, 1]. */
  d: number;
  /**
   * Difficulty past the main ramp: 0 until 150 s, then rising for the rest of
   * the run toward 1. Drives rotation, sliding and the overload colour pulse.
   */
  overdrive: number;
  tier: DifficultyTier;
  speed: number;
  /** Longitudinal spacing between consecutive obstacles, in world units. */
  spacing: number;
  /** Seconds of travel between consecutive obstacles. */
  gapSeconds: number;
  /** Half-extent of a generated opening. */
  openingHalf: number;
  /** Extra clearance beyond the player radius the validator demands. */
  reachMargin: number;
  rotationSpeed: number;
  oscillationAmplitude: number;
  oscillationFrequency: number;
  /**
   * [TRD getDifficulty / PRD 16] Base half-extent of the tunnel, in world
   * units. Decorative only: the player's reachable box never changes with it.
   */
  tunnelWidth: number;
  visualIntensity: number;
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export type NearMissTier = 'NONE' | 'CLOSE' | 'NEAR' | 'EXTREME';

export interface ScoreState {
  score: number;
  /** The tiered score multiplier (x1..x6) earned by the current streak. */
  combo: number;
  /** The combo the player sees: +1 for every obstacle cleared, reset only by a crash. */
  consecutiveClears: number;
  /** The longest streak of the run. */
  maxCombo: number;
  obstaclesCleared: number;
  nearMisses: number;
  /** Survival milestone multiplier in force: 1, 1.5, 2 or 3. */
  survivalMultiplier: number;
}

export interface RunStats {
  score: number;
  timeSeconds: number;
  maxCombo: number;
  obstaclesCleared: number;
  nearMisses: number;
  topSpeed: number;
  isNewBest: boolean;
}

/* ------------------------------------------------------------------ *
 * Application state
 * ------------------------------------------------------------------ */

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SETTINGS' | 'CREDITS';

/** Engine-internal run phase. Distinct from the app-level GameState. */
export type RunPhase = 'IDLE' | 'FLYING' | 'IMPACT' | 'ENDED';

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Persisted under `voidrush-settings`. The first eight fields are the TRD
 * schema; `bloom`, `bloomIntensity` and `visualIntensity` are additive
 * extensions required by the PRD's Settings screen (Screen 5), which lists
 * controls the TRD schema omits.
 */
export interface Settings {
  quality: QualityLevel;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  movementSensitivity: number;
  cameraShake: number;
  effectsIntensity: number;
  fov: number;
  bloom: boolean;
  bloomIntensity: number;
  /**
   * [PRD Screen 5, Gameplay] Scales how strongly difficulty drives the visual
   * effects (PRD 16's "visual intensity"). 0 holds the calm INTRO look for
   * the whole run; 1 lets effects build to full strength.
   */
  visualIntensity: number;
  /** Whether the on-screen joystick is shown. AUTO follows the device. */
  touchControls: TouchControlsMode;
  /** DYNAMIC places the stick under the thumb; FIXED keeps it in a corner. */
  joystickMode: JoystickMode;
  /** Which corner the stick rests in. */
  joystickSide: JoystickSide;
  /** Scales the stick's radius, 0.75 to 1.35. */
  joystickSize: number;
  /** Short vibrations on near misses and impacts, where the device supports it. */
  haptics: boolean;
  /** AUTO uses tilt on phones and tablets that support it, the keyboard elsewhere. */
  controlMode: ControlMode;
  /** Divides the tilt needed for full deflection, 0.5 to 2. */
  tiltSensitivity: number;
  /** Degrees around the neutral pose that produce no movement. */
  tiltDeadZone: number;
  tiltInvertX: boolean;
  tiltInvertY: boolean;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';
export type ControlMode = 'auto' | 'keyboard' | 'tilt';
/** The source actually steering after AUTO and any fallback are resolved. */
export type ActiveControl = 'keyboard' | 'tilt';

/**
 * Where the tilt source stands.
 * - `unsupported`: no DeviceOrientation API.
 * - `needs-permission`: iOS/iPadOS; access must be granted from a tap.
 * - `denied`: access was refused.
 * - `off`: available but not listening.
 * - `waiting`: listening, no reading yet.
 * - `active`: readings arriving.
 * - `lost`: readings stopped arriving mid-session.
 * - `unavailable`: the API exists but no reading ever came (no sensor).
 */
export type TiltStatus =
  | 'unsupported'
  | 'needs-permission'
  | 'denied'
  | 'off'
  | 'waiting'
  | 'active'
  | 'lost'
  | 'unavailable';

/** Low-frequency control state pushed to React; changes only on events. */
export interface ControlInfo {
  active: ActiveControl;
  status: TiltStatus;
  calibrated: boolean;
  /** A phone or tablet, by feature detection. */
  touchPrimary: boolean;
}
export type JoystickMode = 'dynamic' | 'fixed';
export type JoystickSide = 'left' | 'right';

/** Persisted under `voidrush-stats`. Schema fixed by the TRD. */
export interface PersistedStats {
  bestScore: number;
  bestTime: number;
  bestCombo: number;
  bestSpeed: number;
  totalRuns: number;
  totalObstaclesPassed: number;
  totalNearMisses: number;
}

/* ------------------------------------------------------------------ *
 * Engine → React bridge
 * ------------------------------------------------------------------ */

export interface HudEvent {
  id: number;
  kind: 'NEAR_MISS' | 'COMBO' | 'MILESTONE';
  label: string;
  value: number;
}

/** The throttled snapshot React is allowed to read. Pushed at 15 Hz. */
export interface HudSnapshot {
  score: number;
  combo: number;
  speed: number;
  timeSeconds: number;
  tier: DifficultyTier;
  visualIntensity: number;
  /** Survival milestone multiplier in force. */
  survivalMultiplier: number;
  events: readonly HudEvent[];
}
