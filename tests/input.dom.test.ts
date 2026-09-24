/**
 * @vitest-environment jsdom
 *
 * Input handling, listener hygiene and the engine-to-React bridge.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMING } from '../src/config/GameConfig';
import { InputManager } from '../src/game/InputManager';
import { GameBridge } from '../src/app/GameBridge';
import { HUD_EVENTS } from '../src/config/ScoreConfig';

/** Counts live listeners by intercepting add/remove on a target. */
function trackListeners(target: EventTarget): { count: () => number; restore: () => void } {
  const live = new Map<string, number>();
  const originalAdd = target.addEventListener.bind(target);
  const originalRemove = target.removeEventListener.bind(target);

  const add = vi.fn((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    live.set(type, (live.get(type) ?? 0) + 1);
    originalAdd(type, listener, options);
  });
  const remove = vi.fn((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    live.set(type, Math.max(0, (live.get(type) ?? 0) - 1));
    originalRemove(type, listener, options);
  });

  Object.defineProperty(target, 'addEventListener', { value: add, configurable: true });
  Object.defineProperty(target, 'removeEventListener', { value: remove, configurable: true });

  return {
    count: () => [...live.values()].reduce((a, b) => a + b, 0),
    restore: () => {
      Object.defineProperty(target, 'addEventListener', { value: originalAdd, configurable: true });
      Object.defineProperty(target, 'removeEventListener', {
        value: originalRemove,
        configurable: true,
      });
    },
  };
}

function keydown(code: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true });
}

function keyup(code: string): KeyboardEvent {
  return new KeyboardEvent('keyup', { code, cancelable: true, bubbles: true });
}

describe('input manager', () => {
  let manager: InputManager;
  let paused = 0;
  let blurred = 0;
  let playing = true;

  beforeEach(() => {
    paused = 0;
    blurred = 0;
    playing = true;
    manager = new InputManager({
      onPauseToggle: () => (paused += 1),
      onBlur: () => (blurred += 1),
      isPlaying: () => playing,
    });
    manager.attach();
  });

  afterEach(() => manager.dispose());

  it('tracks held keys and produces diagonal motion', () => {
    window.dispatchEvent(keydown('KeyW'));
    expect(manager.input).toMatchObject({ up: true, down: false, left: false, right: false });

    window.dispatchEvent(keydown('KeyD'));
    expect(manager.input).toMatchObject({ up: true, right: true });

    window.dispatchEvent(keyup('KeyW'));
    expect(manager.input).toMatchObject({ up: false, right: true });
  });

  it('treats the arrow keys as aliases for WASD', () => {
    window.dispatchEvent(keydown('ArrowLeft'));
    window.dispatchEvent(keydown('ArrowUp'));
    expect(manager.input).toMatchObject({ left: true, up: true });
    window.dispatchEvent(keyup('ArrowLeft'));
    expect(manager.input.left).toBe(false);
  });

  it('keeps a key held down across auto-repeat', () => {
    window.dispatchEvent(keydown('KeyA'));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyA', repeat: true, cancelable: true }),
    );
    expect(manager.input.left).toBe(true);
    window.dispatchEvent(keyup('KeyA'));
    expect(manager.input.left).toBe(false);
  });

  it('suppresses page scrolling only while playing', () => {
    const during = keydown('ArrowDown');
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);

    playing = false;
    const outside = keydown('ArrowDown');
    window.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
  });

  it('suppresses context menu only while playing', () => {
    const during = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);

    playing = false;
    const outside = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    window.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
  });

  it('never suppresses keys it does not own', () => {
    const tab = keydown('Tab');
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('toggles pause on Escape', () => {
    window.dispatchEvent(keydown('Escape'));
    expect(paused).toBe(1);
  });

  it('releases every key and pauses when focus is lost', () => {
    window.dispatchEvent(keydown('KeyW'));
    window.dispatchEvent(keydown('KeyD'));
    window.dispatchEvent(new Event('blur'));
    expect(blurred).toBe(1);
    expect(manager.input).toMatchObject({ up: false, down: false, left: false, right: false });
  });

  it('pauses when the tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(blurred).toBe(1);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });
});

describe('listener hygiene', () => {
  it('returns the listener count to baseline on dispose', () => {
    const windowTracker = trackListeners(window);
    const documentTracker = trackListeners(document);
    try {
      const baseline = windowTracker.count() + documentTracker.count();

      const manager = new InputManager({
        onPauseToggle: () => undefined,
        onBlur: () => undefined,
        isPlaying: () => true,
      });
      manager.attach();
      expect(windowTracker.count() + documentTracker.count()).toBeGreaterThan(baseline);

      manager.dispose();
      expect(windowTracker.count() + documentTracker.count()).toBe(baseline);
    } finally {
      windowTracker.restore();
      documentTracker.restore();
    }
  });

  it('is safe to attach twice and dispose twice', () => {
    const windowTracker = trackListeners(window);
    try {
      const baseline = windowTracker.count();
      const manager = new InputManager({
        onPauseToggle: () => undefined,
        onBlur: () => undefined,
        isPlaying: () => true,
      });
      manager.attach();
      manager.attach();
      manager.dispose();
      manager.dispose();
      expect(windowTracker.count()).toBe(baseline);
    } finally {
      windowTracker.restore();
    }
  });
});

describe('engine to React bridge', () => {
  const values = {
    score: 0,
    combo: 1,
    speed: 30,
    timeSeconds: 0,
    tier: 'INTRO' as const,
    visualIntensity: 0.15,
    survivalMultiplier: 1,
  };

  it('publishes a stable snapshot reference when nothing displayed changed', () => {
    const bridge = new GameBridge();
    bridge.publish(values, 0);
    const first = bridge.getSnapshot();

    // A fractional score change that rounds to the same integer must not
    // produce a new snapshot, or React would re-render for nothing.
    expect(bridge.publish({ ...values, score: 0.4 }, 0.1)).toBe(false);
    expect(bridge.getSnapshot()).toBe(first);
  });

  it('publishes a new snapshot when a displayed value changes', () => {
    const bridge = new GameBridge();
    bridge.publish(values, 0);
    const first = bridge.getSnapshot();
    expect(bridge.publish({ ...values, score: 120 }, 0.1)).toBe(true);
    expect(bridge.getSnapshot()).not.toBe(first);
    expect(bridge.getSnapshot().score).toBe(120);
  });

  it('notifies subscribers only when it publishes', () => {
    const bridge = new GameBridge();
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);

    bridge.publish(values, 0);
    expect(listener).toHaveBeenCalledTimes(1);
    bridge.publish(values, 0.1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    bridge.publish({ ...values, score: 999 }, 0.2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.listenerCount).toBe(0);
  });

  it('caps visible notifications and expires them', () => {
    const bridge = new GameBridge();
    for (let i = 0; i < 10; i += 1) {
      bridge.emit('NEAR_MISS', 'NEAR MISS', 500, 0);
    }
    bridge.publish(values, 0);
    expect(bridge.getSnapshot().events.length).toBe(HUD_EVENTS.MAX_VISIBLE);

    // Past the lifetime they are gone.
    bridge.publish(values, HUD_EVENTS.LIFETIME_SECONDS + 0.1);
    expect(bridge.getSnapshot().events.length).toBe(0);
  });

  it('publishes at most 15 times a second of simulated play', () => {
    // The loop calls publish at HUD_PUSH_HZ; this asserts the rate the engine
    // is allowed to wake React at, which is the whole architectural boundary.
    expect(TIMING.HUD_PUSH_HZ).toBe(15);
    const stepsPerPublish = 1 / TIMING.HUD_PUSH_HZ / TIMING.FIXED_DT;
    expect(stepsPerPublish).toBe(8);
  });
});
