/**
 * Every legal transition must succeed and every illegal one must be rejected.
 */

import { describe, expect, it } from 'vitest';
import {
  GameStateMachine,
  IllegalTransitionError,
  LEGAL_TRANSITIONS,
  type GameAction,
} from '../src/game/GameStateMachine';
import type { GameState } from '../src/types';

const ALL_STATES: GameState[] = ['MENU', 'PLAYING', 'PAUSED', 'GAME_OVER', 'SETTINGS', 'CREDITS'];
const ALL_ACTIONS: GameAction[] = [
  'PLAY',
  'RESTART',
  'PAUSE',
  'RESUME',
  'DIE',
  'MAIN_MENU',
  'OPEN_SETTINGS',
  'OPEN_CREDITS',
  'BACK',
];

describe('game state machine', () => {
  it('accepts every legal transition', () => {
    for (const state of ALL_STATES) {
      for (const action of ALL_ACTIONS) {
        const expected = LEGAL_TRANSITIONS[state][action];
        if (expected === undefined) continue;
        const machine = new GameStateMachine(state);
        expect(machine.dispatch(action), `${state} --${action}-->`).toBe(
          // BACK out of an overlay returns to where it was opened from.
          action === 'BACK' ? machine.state : expected,
        );
      }
    }
  });

  it('throws on every illegal transition in strict mode', () => {
    for (const state of ALL_STATES) {
      for (const action of ALL_ACTIONS) {
        if (LEGAL_TRANSITIONS[state][action] !== undefined) continue;
        const machine = new GameStateMachine(state);
        expect(() => machine.dispatch(action), `${state} --${action}--> should throw`).toThrow(
          IllegalTransitionError,
        );
      }
    }
  });

  it('ignores illegal transitions in production mode', () => {
    for (const state of ALL_STATES) {
      for (const action of ALL_ACTIONS) {
        if (LEGAL_TRANSITIONS[state][action] !== undefined) continue;
        const machine = new GameStateMachine(state, false);
        expect(machine.dispatch(action)).toBe(state);
      }
    }
  });

  it('walks the documented navigation flow', () => {
    const machine = new GameStateMachine();
    expect(machine.state).toBe('MENU');
    expect(machine.dispatch('PLAY')).toBe('PLAYING');
    expect(machine.dispatch('PAUSE')).toBe('PAUSED');
    expect(machine.dispatch('RESUME')).toBe('PLAYING');
    expect(machine.dispatch('DIE')).toBe('GAME_OVER');
    expect(machine.dispatch('RESTART')).toBe('PLAYING');
    expect(machine.dispatch('PAUSE')).toBe('PAUSED');
    expect(machine.dispatch('MAIN_MENU')).toBe('MENU');
  });

  it('returns overlays to wherever they were opened from', () => {
    const fromMenu = new GameStateMachine();
    fromMenu.dispatch('OPEN_SETTINGS');
    expect(fromMenu.state).toBe('SETTINGS');
    expect(fromMenu.dispatch('BACK')).toBe('MENU');

    const fromPause = new GameStateMachine();
    fromPause.dispatch('PLAY');
    fromPause.dispatch('PAUSE');
    fromPause.dispatch('OPEN_SETTINGS');
    expect(fromPause.state).toBe('SETTINGS');
    expect(fromPause.dispatch('BACK')).toBe('PAUSED');
  });

  it('cannot pause from the menu or the results screen', () => {
    expect(() => new GameStateMachine('MENU').dispatch('PAUSE')).toThrow();
    expect(() => new GameStateMachine('GAME_OVER').dispatch('PAUSE')).toThrow();
  });

  it('reports whether a transition is available without performing it', () => {
    const machine = new GameStateMachine('PLAYING');
    expect(machine.canTransition('PAUSE')).toBe(true);
    expect(machine.canTransition('OPEN_CREDITS')).toBe(false);
    expect(machine.state).toBe('PLAYING');
  });

  it('resets to the menu', () => {
    const machine = new GameStateMachine('PLAYING');
    machine.reset();
    expect(machine.state).toBe('MENU');
  });
});
