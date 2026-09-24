/**
 * VOIDRUSH — the one and only channel from the engine to React.
 *
 * The architectural rule this file exists to enforce: React never touches
 * per-frame simulation state. The engine pushes an immutable snapshot at a
 * fixed 15 Hz and React subscribes to it through `useSyncExternalStore`. There
 * is no other path, so a gameplay frame can never cause a render.
 *
 * A new snapshot object is created only when a value actually changed, so
 * `useSyncExternalStore` sees a stable reference between pushes and skips the
 * re-render entirely.
 */

import { HUD_EVENTS } from '../config/ScoreConfig';
import type { DifficultyTier, HudEvent, HudSnapshot } from '../types';

const EMPTY_EVENTS: readonly HudEvent[] = Object.freeze([]);

const INITIAL: HudSnapshot = Object.freeze({
  score: 0,
  combo: 1,
  speed: 0,
  timeSeconds: 0,
  tier: 'INTRO' as DifficultyTier,
  visualIntensity: 0,
  survivalMultiplier: 1,
  events: EMPTY_EVENTS,
});

interface PendingEvent extends HudEvent {
  expiresAt: number;
}

export class GameBridge {
  private snapshot: HudSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private readonly pending: PendingEvent[] = [];
  private nextEventId = 1;
  private pushes = 0;

  /** React subscribes here; the returned function unsubscribes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): HudSnapshot => this.snapshot;

  /** Number of snapshots actually published. Used by render-count assertions. */
  get publishCount(): number {
    return this.pushes;
  }

  /**
   * Queues a transient HUD notification. Called from the engine's event hooks,
   * not per frame.
   */
  emit(kind: HudEvent['kind'], label: string, value: number, now: number): void {
    this.pending.push({
      id: this.nextEventId,
      kind,
      label,
      value,
      expiresAt: now + HUD_EVENTS.LIFETIME_SECONDS,
    });
    this.nextEventId += 1;
    // [PRD 15] At most four notifications are ever visible.
    while (this.pending.length > HUD_EVENTS.MAX_VISIBLE) this.pending.shift();
  }

  /**
   * Publishes a snapshot. Called by the loop at HUD_PUSH_HZ, never per frame.
   * Returns true when a new object was published.
   */
  publish(
    values: {
      score: number;
      combo: number;
      speed: number;
      timeSeconds: number;
      tier: DifficultyTier;
      visualIntensity: number;
      survivalMultiplier: number;
    },
    now: number,
  ): boolean {
    const before = this.pending.length;
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      if (this.pending[i]!.expiresAt <= now) this.pending.splice(i, 1);
    }
    const eventsChanged = before !== this.pending.length || this.pending.length > 0;

    const previous = this.snapshot;
    const score = Math.round(values.score);
    const speed = Math.round(values.speed);
    const seconds = Math.floor(values.timeSeconds);

    // Compare on displayed precision: a fractional score change that rounds to
    // the same integer must not wake React.
    if (
      !eventsChanged &&
      previous.score === score &&
      previous.combo === values.combo &&
      previous.speed === speed &&
      previous.timeSeconds === seconds &&
      previous.tier === values.tier &&
      previous.survivalMultiplier === values.survivalMultiplier &&
      Math.abs(previous.visualIntensity - values.visualIntensity) < 0.02
    ) {
      return false;
    }

    this.snapshot = Object.freeze({
      score,
      combo: values.combo,
      speed,
      timeSeconds: seconds,
      tier: values.tier,
      visualIntensity: values.visualIntensity,
      survivalMultiplier: values.survivalMultiplier,
      events:
        this.pending.length === 0
          ? EMPTY_EVENTS
          : Object.freeze(
              this.pending.map((event) => ({
                id: event.id,
                kind: event.kind,
                label: event.label,
                value: event.value,
              })),
            ),
    });
    this.pushes += 1;
    for (const listener of this.listeners) listener();
    return true;
  }

  /** Clears transient state between runs. */
  reset(): void {
    this.pending.length = 0;
    this.snapshot = INITIAL;
    for (const listener of this.listeners) listener();
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
