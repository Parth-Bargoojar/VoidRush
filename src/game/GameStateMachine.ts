/**
 * VOIDRUSH — application state machine.
 *
 * A single transition function owns every screen change. Illegal transitions
 * throw in development so they surface immediately, and are ignored in
 * production so a stray keypress can never strand the player on a dead screen.
 */

import type { GameState } from '../types';

export type GameAction =
  | 'PLAY'
  | 'RESTART'
  | 'PAUSE'
  | 'RESUME'
  | 'DIE'
  | 'MAIN_MENU'
  | 'OPEN_SETTINGS'
  | 'OPEN_CREDITS'
  | 'BACK';

/** Screens that remember where they were opened from. */
const OVERLAY_STATES: ReadonlySet<GameState> = new Set<GameState>(['SETTINGS', 'CREDITS']);

const TRANSITIONS: Readonly<Record<GameState, Partial<Record<GameAction, GameState>>>> =
  Object.freeze({
    MENU: { PLAY: 'PLAYING', OPEN_SETTINGS: 'SETTINGS', OPEN_CREDITS: 'CREDITS' },
    PLAYING: { PAUSE: 'PAUSED', DIE: 'GAME_OVER' },
    PAUSED: {
      RESUME: 'PLAYING',
      RESTART: 'PLAYING',
      MAIN_MENU: 'MENU',
      OPEN_SETTINGS: 'SETTINGS',
    },
    GAME_OVER: { RESTART: 'PLAYING', PLAY: 'PLAYING', MAIN_MENU: 'MENU' },
    SETTINGS: { BACK: 'MENU', MAIN_MENU: 'MENU' },
    CREDITS: { BACK: 'MENU', MAIN_MENU: 'MENU' },
  });

export class IllegalTransitionError extends Error {
  constructor(from: GameState, action: GameAction) {
    super(`Illegal transition: ${from} cannot handle ${action}`);
    this.name = 'IllegalTransitionError';
  }
}

export class GameStateMachine {
  private current: GameState = 'MENU';
  /** Where SETTINGS / CREDITS should return to. */
  private returnTo: GameState = 'MENU';
  private readonly strict: boolean;

  constructor(initial: GameState = 'MENU', strict = true) {
    this.current = initial;
    this.strict = strict;
  }

  get state(): GameState {
    return this.current;
  }

  get previousState(): GameState {
    return this.returnTo;
  }

  canTransition(action: GameAction): boolean {
    return TRANSITIONS[this.current][action] !== undefined;
  }

  /**
   * Applies `action`. Returns the resulting state, which is unchanged when the
   * action is not legal and strict mode is off.
   */
  dispatch(action: GameAction): GameState {
    const next = TRANSITIONS[this.current][action];
    if (next === undefined) {
      if (this.strict) throw new IllegalTransitionError(this.current, action);
      return this.current;
    }

    if (OVERLAY_STATES.has(next) && !OVERLAY_STATES.has(this.current)) {
      this.returnTo = this.current;
    }
    // BACK out of an overlay returns to wherever it was opened from.
    if (action === 'BACK' && OVERLAY_STATES.has(this.current)) {
      this.current = this.returnTo;
      return this.current;
    }

    this.current = next;
    return this.current;
  }

  reset(state: GameState = 'MENU'): void {
    this.current = state;
    this.returnTo = 'MENU';
  }
}

/** Exposed so tests can enumerate every legal edge. */
export const LEGAL_TRANSITIONS = TRANSITIONS;
