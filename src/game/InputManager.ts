/**
 * VOIDRUSH — keyboard input.
 *
 * Held keys live in a Set, so simultaneous presses produce diagonal motion
 * naturally. Movement keys have their default action suppressed only while
 * PLAYING, so arrow keys still scroll menus and never scroll the page mid-run.
 *
 * The touch joystick writes an analog axis through `setAxis`; the keyboard and
 * the stick can be used together and the player step clamps their sum.
 *
 * Every listener registered here is removed by `dispose`, and a test asserts
 * the global listener count returns to its baseline.
 */

import type { InputState } from '../types';

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
    this.state.axisX = 0;
    this.state.axisY = 0;
  }

  /** Analog steering from the touch joystick, each component in [-1, 1]. */
  setAxis(x: number, y: number): void {
    this.state.axisX = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    this.state.axisY = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
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
