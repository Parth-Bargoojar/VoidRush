/**
 * VOIDRUSH — the application controller.
 *
 * Owns the engine, the renderer, the audio graph, input and persistence, and
 * exposes a small command surface to React. React calls methods here; it never
 * reaches into the simulation.
 *
 * [§13] Every optional subsystem fails soft. A missing WebGL context surfaces a
 * recovery screen, audio failure leaves a silent no-op backend, unavailable
 * storage falls back to memory, and an uncaught error during play ends the run
 * with a diagnostic rather than freezing the canvas.
 */

import { AudioEngine } from '../audio/AudioEngine';
import type { SoundId } from '../config/AudioConfig';
import { CAMERA, MOVEMENT } from '../config/GameConfig';
import { NEAR_MISS_REWARD } from '../config/ScoreConfig';
import { Game } from '../game/Game';
import { GameLoop } from '../game/GameLoop';
import { GameStateMachine, type GameAction } from '../game/GameStateMachine';
import { InputManager } from '../game/InputManager';
import { buildRunStats, mergeStats } from '../game/RunStats';
import { Renderer, RendererError } from '../rendering/Renderer';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../persistence/SettingsStorage';
import { loadStats, saveStats } from '../persistence/ScoreStorage';
import { seedFromString } from '../utils/Random';
import { now } from '../utils/Timing';
import type { GameState, NearMissTier, PersistedStats, RunStats, Settings } from '../types';
import { GameBridge } from './GameBridge';

/** Vibration lengths in ms. Kept short: feedback, not a buzz. */
const HAPTIC_NEAR_MISS_MS = 12;
const HAPTIC_COLLISION: readonly number[] = [45, 40, 90];

export interface AppListener {
  onStateChange: (state: GameState) => void;
  onSettingsChange: (settings: Settings) => void;
  onStatsChange: (stats: PersistedStats) => void;
  onRunEnd: (stats: RunStats) => void;
  onFatal: (message: string) => void;
}

/** Reads `?seed=` so a run can be reproduced exactly. */
function seedFromLocation(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric !== 0 ? numeric >>> 0 : seedFromString(raw);
}

export class VoidrushApp {
  readonly bridge = new GameBridge();
  readonly game: Game;
  readonly audio = new AudioEngine();

  private renderer: Renderer | null = null;
  private readonly machine: GameStateMachine;
  private readonly loop: GameLoop;
  private input: InputManager | null = null;
  private listener: AppListener | null = null;

  private settings: Settings;
  private stats: PersistedStats;
  private lastRun: RunStats | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private windowResizeHandler: (() => void) | null = null;
  private orientationHandler: (() => void) | null = null;
  private orientationTimer: ReturnType<typeof setTimeout> | null = null;
  private firstTouchHandler: (() => void) | null = null;
  private seedOverride: number | null;
  private runSeed = 1;
  private disposed = false;
  /** Cost of the last audio-graph construction, surfaced to the QA pass. */
  private lastUnlockMs = 0;

  constructor() {
    this.settings = loadSettings();
    this.stats = loadStats();
    this.seedOverride = seedFromLocation();
    // Illegal transitions throw in development and are ignored in production.
    this.machine = new GameStateMachine('MENU', import.meta.env.DEV);

    this.game = new Game({
      seed: this.seedOverride ?? 1,
      sensitivity: this.settings.movementSensitivity,
    });
    this.game.setHooks({
      onSound: (id) => {
        this.audio.play(id);
        this.haptic(id);
      },
      onShake: (amount) => this.renderer?.cameraController.addShake(amount),
      onNearMiss: (tier, points) => this.onNearMiss(tier, points),
      onComboMilestone: (multiplier) =>
        this.bridge.emit('COMBO', `COMBO ×${multiplier}`, multiplier, this.game.time),
      onSurvivalMilestone: (multiplier, label) =>
        this.bridge.emit('MILESTONE', label, multiplier, this.game.time),
      onRunEnded: () => this.finishRun(),
    });

    this.loop = new GameLoop({
      step: (dt) => this.safeStep(dt),
      render: (dt) => this.safeRender(dt),
      publish: () => this.publish(),
      // A run steps only while PLAYING. The idle engine behind the menu, its
      // settings and its credits also steps, because an IDLE step does nothing
      // but advance the slow background drift [PRD 30, Screen 1].
      shouldStep: () => this.machine.state === 'PLAYING' || this.game.phase === 'IDLE',
    });
  }

  /* -------------------------------------------------------------- *
   * Mounting
   * -------------------------------------------------------------- */

  /** Attaches to the canvas. Returns false when WebGL is unavailable. */
  mount(canvas: HTMLCanvasElement, listener: AppListener): boolean {
    this.listener = listener;

    try {
      this.renderer = new Renderer(canvas);
    } catch (error) {
      const message =
        error instanceof RendererError ? error.message : 'WebGL could not be initialised';
      listener.onFatal(message);
      return false;
    }

    this.renderer.onContextLost = (): void => {
      this.loop.stop();
      listener.onFatal('The graphics context was lost.');
    };
    this.renderer.onContextRestored = (): void => {
      this.renderer?.requestRepaint();
      this.loop.start();
    };

    this.renderer.applySettings(this.settings);
    this.applyViewportSize();

    this.windowResizeHandler = (): void => this.applyViewportSize();
    window.addEventListener('resize', this.windowResizeHandler);
    // iOS reports the old size for a moment after rotating, so measure again
    // once the rotation has settled.
    this.orientationHandler = (): void => {
      if (this.orientationTimer !== null) clearTimeout(this.orientationTimer);
      this.orientationTimer = setTimeout(() => {
        this.orientationTimer = null;
        this.applyViewportSize();
      }, 300);
    };
    window.addEventListener('orientationchange', this.orientationHandler);
    // Mobile Safari only lets audio start inside a touch handler itself, so the
    // first touch anywhere unlocks it synchronously.
    this.firstTouchHandler = (): void => {
      this.detachFirstTouch();
      if (!this.disposed) this.gesture();
    };
    window.addEventListener('touchend', this.firstTouchHandler, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.applyViewportSize());
      this.resizeObserver.observe(canvas);
    }

    this.input = new InputManager({
      onPauseToggle: () => this.handleEscape(),
      // [§9.4] Losing focus or visibility forces a pause.
      onBlur: () => this.pause(),
      isPlaying: () => this.machine.state === 'PLAYING',
    });
    this.input.attach();

    this.attachDiagnosticsHook();
    listener.onSettingsChange(this.settings);
    listener.onStatsChange(this.stats);
    this.loop.start();
    return true;
  }

  /**
   * Exposes a read-only diagnostics function, but only when the page is opened
   * with `?qa=1`. The automated browser pass uses it; a normal session never
   * gets a debug surface attached.
   */
  private attachDiagnosticsHook(): void {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('qa') !== '1') return;
    (window as unknown as { voidrushDiagnostics?: () => Record<string, number | string> })
      .voidrushDiagnostics = () => this.diagnostics();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.input?.dispose();
    this.input = null;
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
    if (this.orientationHandler) {
      window.removeEventListener('orientationchange', this.orientationHandler);
      this.orientationHandler = null;
    }
    if (this.orientationTimer !== null) {
      clearTimeout(this.orientationTimer);
      this.orientationTimer = null;
    }
    this.detachFirstTouch();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.audio.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.listener = null;
  }

  private detachFirstTouch(): void {
    if (!this.firstTouchHandler) return;
    window.removeEventListener('touchend', this.firstTouchHandler);
    this.firstTouchHandler = null;
  }

  private applyViewportSize(): void {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.canvas.style.width = `${width}px`;
    this.renderer.canvas.style.height = `${height}px`;
    this.renderer.resize(width, height);
  }

  /* -------------------------------------------------------------- *
   * Frame
   * -------------------------------------------------------------- */

  private safeStep(dt: number): void {
    try {
      this.game.step(dt, this.input?.input);
    } catch (error) {
      this.handleFatalDuringPlay(error);
    }
  }

  private safeRender(dt: number): void {
    if (!this.renderer) return;
    try {
      this.renderer.render(this.game, dt, this.machine.state === 'MENU');
      this.audio.setSpeed(this.game.speed);
    } catch (error) {
      this.handleFatalDuringPlay(error);
    }
  }

  /**
   * [§13] An uncaught error during play ends the run with a diagnostic. The
   * canvas is never left frozen with no way out.
   */
  private handleFatalDuringPlay(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error('VOIDRUSH: run aborted after an unexpected error:', error);
    if (this.machine.state === 'PLAYING') {
      this.game.abortRun();
      this.transition('DIE');
    } else {
      this.loop.stop();
      this.listener?.onFatal(message);
    }
  }

  private publish(): void {
    this.bridge.publish(
      {
        score: this.game.score.score,
        // The streak, not the score multiplier: +1 for every obstacle cleared.
        combo: this.game.score.consecutiveClears,
        speed: this.game.speed,
        timeSeconds: this.game.time,
        tier: this.game.state.tier,
        visualIntensity: this.game.state.visualIntensity,
        survivalMultiplier: this.game.score.survivalMultiplier,
      },
      this.game.time,
    );
  }

  /** Short vibrations for the events a player feels rather than watches. */
  private haptic(id: SoundId): void {
    if (!this.settings.haptics) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    let pattern: number | readonly number[];
    if (id === 'COLLISION') pattern = HAPTIC_COLLISION;
    else if (id === 'NEAR_MISS') pattern = HAPTIC_NEAR_MISS_MS;
    else return;
    try {
      navigator.vibrate(pattern as number | number[]);
    } catch {
      // Vibration is decoration; a refusal changes nothing.
    }
  }

  private onNearMiss(tier: NearMissTier, points: number): void {
    if (tier === 'NONE') return;
    this.bridge.emit('NEAR_MISS', 'NEAR MISS', points || NEAR_MISS_REWARD[tier], this.game.time);
  }

  /* -------------------------------------------------------------- *
   * Commands
   * -------------------------------------------------------------- */

  get state(): GameState {
    return this.machine.state;
  }

  get currentSettings(): Settings {
    return this.settings;
  }

  get currentStats(): PersistedStats {
    return this.stats;
  }

  get results(): RunStats | null {
    return this.lastRun;
  }

  private transition(action: GameAction): void {
    const before = this.machine.state;
    const after = this.machine.dispatch(action);
    if (after !== before) this.listener?.onStateChange(after);
  }

  /** Audio may only start from a user gesture, so every command routes here. */
  private gesture(): void {
    const started = now();
    this.audio.unlock();
    // [PRD 29] Music begins with the first gesture and runs from then on.
    this.audio.startMusic();
    this.lastUnlockMs = now() - started;
  }

  playSound(id: SoundId): void {
    this.audio.play(id);
  }

  startRun(): void {
    this.runSeed = this.seedOverride ?? ((Date.now() ^ (this.stats.totalRuns * 2654435761)) >>> 0);
    this.bridge.reset();
    this.renderer?.clearObstacles();
    this.game.setSensitivity(this.settings.movementSensitivity);
    this.game.startRun(this.runSeed);
    this.input?.clear();
    this.transition(this.machine.state === 'MENU' ? 'PLAY' : 'RESTART');

    // Audio is unlocked after the current task, so the first frame of flight
    // can paint before the audio graph is built. Constructing an AudioContext
    // is usually a few milliseconds, but it was measured at 4.5 s on a machine
    // with no audio device, and starting the game must never wait on it.
    // Browsers gate audio on sticky user activation, which a gesture has
    // already granted by this point, so deferring is safe.
    this.deferAudioStart();
  }

  private deferAudioStart(): void {
    setTimeout(() => {
      if (this.disposed) return;
      this.gesture();
      this.audio.setDucked(false);
      this.audio.play('GAME_START');
    }, 0);
  }

  /** Escape pauses a run, resumes it, or closes Settings and Credits. */
  handleEscape(): void {
    const state = this.machine.state;
    if (state === 'SETTINGS' || state === 'CREDITS') {
      this.playSound('UI_CLICK');
      this.back();
    } else {
      this.togglePause();
    }
  }

  /** Analog steering from the on-screen joystick, each axis in [-1, 1], +Y up. */
  setTouchAxis(x: number, y: number): void {
    this.input?.setAxis(x, y);
  }

  togglePause(): void {
    if (this.machine.state === 'PLAYING') {
      this.audio.setDucked(true);
      this.transition('PAUSE');
    } else if (this.machine.state === 'PAUSED') {
      this.resume();
    }
  }

  /**
   * Pauses a run if one is in progress, and does nothing otherwise. Used when
   * the run can no longer be played as it is: focus lost, or a phone turned
   * to portrait.
   */
  pause(): void {
    if (this.machine.state !== 'PLAYING') return;
    this.audio.setDucked(true);
    this.input?.clear();
    this.transition('PAUSE');
  }

  resume(): void {
    this.gesture();
    if (this.machine.state !== 'PAUSED') return;
    this.audio.setDucked(false);
    this.input?.clear();
    this.transition('RESUME');
  }

  returnToMenu(): void {
    this.gesture();
    this.game.returnToMenu();
    this.renderer?.clearObstacles();
    this.bridge.reset();
    this.audio.stopAll();
    this.audio.setDucked(false);
    this.transition('MAIN_MENU');
  }

  openSettings(): void {
    this.gesture();
    this.transition('OPEN_SETTINGS');
  }

  openCredits(): void {
    this.gesture();
    this.transition('OPEN_CREDITS');
  }

  back(): void {
    this.gesture();
    this.transition('BACK');
  }

  /** Applies a settings change live and persists it immediately. */
  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.settings = loadSettings();

    this.renderer?.applySettings(this.settings);
    this.game.setSensitivity(this.settings.movementSensitivity);
    this.audio.setVolumes({
      master: this.settings.masterVolume,
      music: this.settings.musicVolume,
      sfx: this.settings.sfxVolume,
    });
    this.listener?.onSettingsChange(this.settings);
  }

  resetSettings(): void {
    this.updateSettings(DEFAULT_SETTINGS);
  }

  /** Called by the engine once the impact sequence has finished. */
  private finishRun(): void {
    this.lastRun = buildRunStats(
      this.game.score,
      this.game.time,
      this.game.topSpeed,
      this.stats.bestScore,
    );
    this.stats = mergeStats(this.stats, this.lastRun);
    saveStats(this.stats);
    this.stats = loadStats();

    this.audio.play('GAME_OVER');
    this.listener?.onStatsChange(this.stats);
    this.listener?.onRunEnd(this.lastRun);
    if (this.machine.state === 'PLAYING') this.transition('DIE');
  }

  /* -------------------------------------------------------------- *
   * Diagnostics, used by the browser QA pass
   * -------------------------------------------------------------- */

  diagnostics(): Record<string, number | string> {
    return {
      state: this.machine.state,
      phase: this.game.phase,
      seed: this.runSeed,
      score: Math.round(this.game.score.score),
      combo: this.game.score.consecutiveClears,
      multiplier: this.game.score.combo,
      obstacles: this.game.world.activeCount,
      solids: this.game.world.activePartCount,
      drawCalls: this.renderer?.drawCalls ?? 0,
      materials: this.renderer?.materialCount ?? 0,
      quality: this.renderer?.activeQuality ?? 'none',
      hudPublishes: this.bridge.publishCount,
      frameSkips: this.loop.frameSkips,
      steps: this.loop.stepCount,
      audioSilent: this.audio.isSilent ? 1 : 0,
      audioNodes: this.audio.nodeCount,
      audioUnlockMs: Math.round(this.lastUnlockMs * 100) / 100,
      runStartedAt: this.game.runStartedAt,
      renderDistance: Math.round(this.game.renderDistance * 100) / 100,
      impact: Math.round(this.game.impactProgress * 1000) / 1000,
      tunnelMenu: this.game.world.tunnel.profile.isMenu ? 1 : 0,
      fov: Math.round(this.renderer?.cameraController.currentFov ?? CAMERA.FOV_BASE),
      sensitivity: this.settings.movementSensitivity * MOVEMENT.MAX_LATERAL_SPEED,
    };
  }
}
