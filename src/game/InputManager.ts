/**
 * VOIDRUSH — the input manager: every steering source, one InputState.
 *
 *   InputManager
 *   ├── keyboard (held keys, here)
 *   ├── touch joystick (analog, pushed in through `setAxis`)
 *   └── tilt (analog, an AnalogSource polled in `update`)
 *            ↓
 *   InputState → readSteering → { horizontal, vertical } → stepPlayer
 *
 * Held keys live in a Set, so simultaneous presses produce diagonal motion
 * naturally. Movement keys have their default action suppressed only while
 * PLAYING, so arrow keys still scroll menus and never scroll the page mid-run.
 *
 * Analog sources are summed into `axisX`/`axisY`; the player step clamps the
 * total to unit length, so no combination can exceed full speed.
 *
 * Every listener registered here is removed by `dispose`, and a test asserts
 * the global listener count returns to its baseline.
 */

import type { InputState } from '../types';
import { clamp } from '../utils/MathUtils';

/**
 * An analog source sampled by the game loop, such as tilt. Its own events only
 * update its internal state; `update` advances it by the fixed step.
 */
export interface AnalogSource {
  readonly x: number;
  readonly y: number;
  update(dt: number): void;
  resetOutput(): void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const MOVE_KEYS: Readonly<Record<string, Direction>> = Object.freeze({
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
});

export interface InputCallbacks {
  /** Escape: pauses or resumes a run, or closes an overlay screen. */
  onPauseToggle: () => void;
  onBlur: () => void;
  /** True while the simulation is running, which gates preventDefault. */
  isPlaying: () => boolean;
}

export class InputManager {
  private readonly held = new Set<string>();
  private readonly state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    axisX: 0,
    axisY: 0,
  };
  private readonly callbacks: InputCallbacks;
  private readonly target: Window;
  private attached = false;

  private touchX = 0;
  private touchY = 0;
  private tilt: AnalogSource | null = null;
  private tiltEnabled = false;

  constructor(callbacks: InputCallbacks, target: Window = window) {
    this.callbacks = callbacks;
    this.target = target;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
    this.target.document.addEventListener('visibilitychange', this.handleVisibility);
  }

  dispose(): void {
    if (!this.attached) return;
    this.attached = false;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.target.document.removeEventListener('visibilitychange', this.handleVisibility);
    this.clear();
  }

  /** Current directional state. The same object every call; do not retain it. */
  get input(): InputState {
    return this.state;
  }

  clear(): void {
    this.held.clear();
    this.state.up = false;
    this.state.down = false;
    this.state.left = false;
    this.state.right = false;
    this.touchX = 0;
    this.touchY = 0;
    this.tilt?.resetOutput();
    this.state.axisX = 0;
    this.state.axisY = 0;
  }

  /** Analog steering from the touch joystick, each component in [-1, 1]. */
  setAxis(x: number, y: number): void {
    this.touchX = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
    this.touchY = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
    this.compose();
  }

  /** Registers the tilt source. It is polled by `update` whether or not it steers. */
  setTiltSource(source: AnalogSource | null): void {
    this.tilt = source;
    this.compose();
  }

  /** Whether tilt output reaches the player. */
  setTiltEnabled(enabled: boolean): void {
    if (this.tiltEnabled === enabled) return;
    this.tiltEnabled = enabled;
    this.tilt?.resetOutput();
    this.compose();
  }

  get isTiltEnabled(): boolean {
    return this.tiltEnabled;
  }

  /**
   * Called by the game loop once per fixed step, before the simulation reads
   * `input`. Advances the tilt source's smoothing and folds it in.
   */
  update(dt: number): void {
    this.tilt?.update(dt);
    if (this.tiltEnabled) this.compose();
  }

  private compose(): void {
    let x = this.touchX;
    let y = this.touchY;
    if (this.tiltEnabled && this.tilt) {
      x += this.tilt.x;
      y += this.tilt.y;
    }
    this.state.axisX = clamp(x, -1, 1);
    this.state.axisY = clamp(y, -1, 1);
  }

  private refresh(): void {
    this.state.up = false;
    this.state.down = false;
    this.state.left = false;
    this.state.right = false;
    for (const code of this.held) {
      const direction = MOVE_KEYS[code];
      if (direction) this.state[direction] = true;
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.callbacks.onPauseToggle();
      return;
    }
    if (!(event.code in MOVE_KEYS)) return;
    // Suppress page scrolling for movement keys, but only during gameplay.
    if (this.callbacks.isPlaying()) event.preventDefault();
    if (event.repeat) return;
    this.held.add(event.code);
    this.refresh();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!(event.code in MOVE_KEYS)) return;
    if (this.callbacks.isPlaying()) event.preventDefault();
    this.held.delete(event.code);
    this.refresh();
  };

  /** Losing focus releases every key, so nothing stays stuck down. */
  private readonly handleBlur = (): void => {
    this.clear();
    this.callbacks.onBlur();
  };

  private readonly handleVisibility = (): void => {
    if (this.target.document.visibilityState === 'hidden') {
      this.clear();
      this.callbacks.onBlur();
    }
  };
}
