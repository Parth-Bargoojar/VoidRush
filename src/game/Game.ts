/**
 * VOIDRUSH — the simulation.
 *
 * This class owns every per-frame value in the game and imports no rendering
 * code, which is what allows the identical simulation to run in the browser, in
 * the test suite and in the head-less soak harness.
 *
 * Presentation is reached only through `GameHooks`: the engine announces what
 * happened, and the renderer, the audio graph and React decide what to do
 * about it.
 */

import type { SoundId } from '../config/AudioConfig';
import { CAMERA, IMPACT, SPEED, TIMING } from '../config/GameConfig';
import { VISUAL } from '../config/VisualConfig';
import { nearMissTier } from './CollisionSystem';
import { DifficultyManager, createDifficultyState } from './DifficultyManager';
import { EMPTY_INPUT, createPlayer, effectiveLateralSpeed, resetPlayer, stepPlayer } from './Player';
import {
  registerClear,
  registerNearMiss,
  registerSurvival,
  createScoreState,
  resetScoreState,
  updateSurvivalMultiplier,
} from './ScoreSystem';
import { ObstacleFactory } from '../obstacles/ObstacleFactory';
import { Rng } from '../utils/Random';
import { now } from '../utils/Timing';
import { WorldManager } from '../world/WorldManager';
import type {
  DifficultyState,
  InputState,
  NearMissTier,
  Player,
  RunPhase,
  ScoreState,
} from '../types';

export interface GameHooks {
  onSound?: (id: SoundId) => void;
  onShake?: (amount: number) => void;
  onNearMiss?: (tier: NearMissTier, points: number) => void;
  onComboMilestone?: (multiplier: number) => void;
  /** A survival milestone was reached; points now carry `multiplier`. */
  onSurvivalMilestone?: (multiplier: number, label: string) => void;
  onRunEnded?: () => void;
}

export interface GameOptions {
  seed?: number;
  sensitivity?: number;
  hooks?: GameHooks;
}

export class Game {
  readonly player: Player = createPlayer();
  readonly score: ScoreState = createScoreState();
  readonly difficulty = new DifficultyManager();
  readonly world: WorldManager;
  readonly factory = new ObstacleFactory();

  /** Simulation time since the run began, in seconds. */
  time = 0;
  /** Accumulated forward distance. Never a camera translation. */
  distance = 0;
  phase: RunPhase = 'IDLE';
  topSpeed = SPEED.START;
  frameSkips = 0;

  /**
   * `performance.now()` at the instant the run entered flight. Lets the browser
   * QA pass measure the engine's start-up cost directly, rather than inferring
   * it from when a frame happens to reach the screen.
   */
  runStartedAt = 0;

  /** Slow drift used behind the main menu; kept apart from run state. */
  private menuDistance = 0;
  private impactElapsed = 0;
  private sensitivity: number;
  private hooks: GameHooks;
  private seed: number;
  private rng: Rng;
  private readonly difficultyState: DifficultyState = createDifficultyState();

  constructor(options: GameOptions = {}) {
    this.seed = options.seed ?? 1;
    this.sensitivity = options.sensitivity ?? 1;
    this.hooks = options.hooks ?? {};
    this.rng = new Rng(this.seed);
    this.world = new WorldManager(this.factory, this.difficulty, this.rng);
    // The engine boots idle behind the main menu.
    this.world.reset(this.seed, this.rng, effectiveLateralSpeed(this.sensitivity), true);
  }

  setHooks(hooks: GameHooks): void {
    this.hooks = hooks;
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
    // Generation is planned against the player's reach, so a mid-run change to
    // the sensitivity setting has to reach the generator too. Obstacles already
    // committed were proved against the previous value; everything planned from
    // here uses the new one.
    this.world.generator.setLateralSpeed(effectiveLateralSpeed(value));
  }

  get currentSeed(): number {
    return this.seed;
  }

  /** Current forward speed. */
  get speed(): number {
    return this.phase === 'FLYING' ? this.difficulty.speedAt(this.time) : SPEED.START;
  }

  get state(): DifficultyState {
    return this.difficultyState;
  }

  /** Distance the renderer should position the world by. */
  get renderDistance(): number {
    return this.phase === 'IDLE' ? this.menuDistance : this.distance;
  }

  /** True while the impact sequence is playing out, before the results screen. */
  get isImpacting(): boolean {
    return this.phase === 'IMPACT';
  }

  /**
   * [PRD 11] How far through the collision feedback the run is: 0 before a
   * collision, rising to 1 as the sequence hands over to the results screen,
   * and held at 1 once the run has ended. Presentation reads this to drive the
   * distortion and fade; it never feeds back into the simulation.
   */
  get impactProgress(): number {
    if (this.phase === 'ENDED') return 1;
    if (this.phase !== 'IMPACT') return 0;
    return Math.min(1, this.impactElapsed / IMPACT.TOTAL_SECONDS);
  }

  startRun(seed?: number): void {
    this.seed = seed ?? this.seed;
    this.rng = new Rng(this.seed);
    this.time = 0;
    this.distance = 0;
    this.impactElapsed = 0;
    this.topSpeed = SPEED.START;
    this.frameSkips = 0;
    resetPlayer(this.player);
    resetScoreState(this.score);
    this.world.reset(this.seed, this.rng, effectiveLateralSpeed(this.sensitivity));
    this.difficulty.stateAt(0, this.difficultyState);
    this.phase = 'FLYING';
    this.runStartedAt = now();
  }

  /**
   * Returns the engine to the menu drift state.
   *
   * The run's world is discarded rather than left in place: its tunnel sits at
   * the run's accumulated distance, which the menu drift would never reach, so
   * keeping it would leave the menu in front of an empty void. The player is
   * re-centred and the difficulty returns to its opening values, which also
   * fades the palette back to the INTRO colours behind the menu.
   */
  returnToMenu(): void {
    this.phase = 'IDLE';
    this.impactElapsed = 0;
    this.menuDistance = 0;
    resetPlayer(this.player);
    this.world.reset(this.seed, this.rng, effectiveLateralSpeed(this.sensitivity), true);
    this.difficulty.stateAt(0, this.difficultyState);
  }

  /**
   * Advances the simulation by exactly one fixed step. Every gameplay value is
   * computed from `dt`, so 30 Hz and 144 Hz frame delivery produce identical
   * state after the same number of steps.
   */
  step(dt: number, input: InputState = EMPTY_INPUT): void {
    if (this.phase === 'IDLE') {
      this.menuDistance += SPEED.START * VISUAL.MENU_SPEED_FACTOR * dt;
      this.world.tunnel.update(this.menuDistance);
      return;
    }

    if (this.phase === 'IMPACT') {
      // [PRD 11] The run has already stopped; only the feedback plays out.
      this.impactElapsed += dt;
      if (this.impactElapsed >= IMPACT.TOTAL_SECONDS) {
        this.phase = 'ENDED';
        this.hooks.onRunEnded?.();
      }
      return;
    }

    if (this.phase !== 'FLYING') return;

    const tPrev = this.time;
    const distancePrev = this.distance;
    this.time += dt;
    this.distance = this.difficulty.distanceAt(this.time);

    this.difficulty.stateAt(this.time, this.difficultyState);
    const speed = this.difficultyState.speed;
    if (speed > this.topSpeed) this.topSpeed = speed;

    const milestone = updateSurvivalMultiplier(this.score, this.time);
    if (milestone) {
      this.hooks.onSurvivalMilestone?.(milestone.multiplier, milestone.label);
    }

    stepPlayer(this.player, input, dt, this.sensitivity);
    this.world.step(distancePrev, this.distance, tPrev, this.time, this.player);
    registerSurvival(this.score, dt);

    this.consumeEvents();
  }

  private consumeEvents(): void {
    const count = this.world.eventCountThisStep;
    for (let i = 0; i < count; i += 1) {
      const event = this.world.eventAt(i);
      if (event.kind === 'COLLIDE') {
        this.beginImpact();
        return;
      }

      // A cleared obstacle scores exactly once: CONSUMED is set here, and the
      // CLEAR event only ever fires on the APPROACHING -> CLEARED transition.
      const award = registerClear(this.score, event.type);

      const tier = nearMissTier(event.minSurfaceDistance);
      if (tier !== 'NONE') {
        const points = registerNearMiss(this.score, tier);
        this.hooks.onNearMiss?.(tier, points);
        this.hooks.onSound?.('NEAR_MISS');
      }

      // Combos are silent: the HUD counter and a notification every few clears.
      if (award.milestone) {
        this.hooks.onComboMilestone?.(award.combo);
      }
      // Shake is reserved for collisions and combo milestones; never continuous.
      if (this.score.consecutiveClears % CAMERA.COMBO_SHAKE_INTERVAL === 0) {
        this.hooks.onShake?.(CAMERA.SHAKE_COMBO);
      }

      for (const obstacle of this.world.active) {
        if (obstacle.id === event.obstacleId) {
          obstacle.state = 'CONSUMED';
          break;
        }
      }
    }
  }

  private beginImpact(): void {
    this.phase = 'IMPACT';
    this.impactElapsed = 0;
    this.hooks.onShake?.(CAMERA.SHAKE_COLLISION);
    this.hooks.onSound?.('COLLISION');
  }

  /** Force-ends a run, used by the error boundary in §13. */
  abortRun(): void {
    if (this.phase === 'FLYING' || this.phase === 'IMPACT') {
      this.phase = 'ENDED';
      this.hooks.onRunEnded?.();
    }
  }

  /**
   * A digest of the committed world plan. Included in the snapshot so that
   * determinism assertions are sensitive to what the generator actually built,
   * not merely to where the player ended up.
   */
  private worldDigest(): number {
    let h = 2166136261 >>> 0;
    for (const obstacle of this.world.active) {
      h ^= obstacle.id;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= obstacle.type.length + obstacle.partCount;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= Math.round(obstacle.plannedX * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= Math.round(obstacle.plannedY * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= Math.round(obstacle.spinPhase * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** Snapshot used by determinism assertions. */
  snapshot(): string {
    return JSON.stringify({
      world: this.worldDigest(),
      t: this.time.toFixed(9),
      d: this.distance.toFixed(6),
      px: this.player.x.toFixed(9),
      py: this.player.y.toFixed(9),
      vx: this.player.vx.toFixed(9),
      vy: this.player.vy.toFixed(9),
      score: this.score.score.toFixed(6),
      combo: this.score.combo,
      streak: this.score.consecutiveClears,
      cleared: this.score.obstaclesCleared,
      near: this.score.nearMisses,
      active: this.world.activeCount,
      generated: this.world.generator.stats.generated,
      phase: this.phase,
    });
  }
}

/** Steps needed to simulate `seconds` of gameplay. */
export function stepsForSeconds(seconds: number): number {
  return Math.round(seconds / TIMING.FIXED_DT);
}
