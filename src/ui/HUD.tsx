/**
 * The gameplay HUD.
 *
 * Everything here comes from a single throttled snapshot pushed by the engine
 * at 15 Hz. There is no per-frame React state anywhere in this component, and
 * the centre of the screen is left completely clear.
 */

import { Pause } from 'lucide-react';
import { SURVIVAL_MILESTONES } from '../config/ScoreConfig';
import { VISUAL } from '../config/VisualConfig';

/** The top milestone gets the OVERLOAD SURVIVOR treatment. */
const SURVIVOR_MULTIPLIER = SURVIVAL_MILESTONES[SURVIVAL_MILESTONES.length - 1]!.multiplier;
import type { HudSnapshot } from '../types';
import { formatNumber, formatTime, lerp } from '../utils/MathUtils';

interface HudProps {
  snapshot: HudSnapshot;
  onPause: () => void;
}

export function HUD({ snapshot, onPause }: HudProps): JSX.Element {
  // [Design] The HUD steps back as the run intensifies, so late-game geometry
  // is never competing with the interface for attention.
  const opacity = lerp(1, VISUAL.HUD_MIN_OPACITY, snapshot.visualIntensity);

  return (
    <div className="hud" style={{ opacity }}>
      <div className="hud__score">
        <div className="hud__label">Score</div>
        <div className="hud__value">{formatNumber(snapshot.score)}</div>
        {snapshot.survivalMultiplier > 1 && (
          <div
            className={
              snapshot.survivalMultiplier >= SURVIVOR_MULTIPLIER
                ? 'hud__survival hud__survival--overload'
                : 'hud__survival'
            }
          >
            ×{snapshot.survivalMultiplier}{' '}
            {snapshot.survivalMultiplier >= SURVIVOR_MULTIPLIER ? 'Overload survivor' : 'Survival'}
          </div>
        )}
      </div>

      <div className="hud__centre">
        {snapshot.combo >= 2 && (
          <>
            <div className="hud__combo">×{snapshot.combo}</div>
            <div className="hud__label">Combo</div>
          </>
        )}
        <div className="hud__timer">{formatTime(snapshot.timeSeconds)}</div>
      </div>

      <div className="hud__speed">
        <div className="hud__value hud__value--speed">{snapshot.speed}</div>
        <div className="hud__label">Cubes/s</div>
      </div>

      <div className="hud__pause">
        <button
          type="button"
          className="button button--icon"
          onClick={onPause}
          aria-label="Pause the run"
        >
          <Pause size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="hud__events" aria-live="polite" aria-atomic="false">
        {snapshot.events.map((event) => (
          <div
            key={event.id}
            className={event.kind === 'NEAR_MISS' ? 'notification' : 'notification notification--combo'}
          >
            {event.kind === 'NEAR_MISS'
              ? `${event.label} +${formatNumber(event.value)}`
              : event.kind === 'MILESTONE'
                ? `${event.label} ×${event.value}`
                : event.label}
          </div>
        ))}
      </div>
    </div>
  );
}
