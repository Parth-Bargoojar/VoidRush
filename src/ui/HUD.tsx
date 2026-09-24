/**
 * The gameplay HUD.
 *
 * Everything here comes from a single throttled snapshot pushed by the engine
 * at 15 Hz. There is no per-frame React state anywhere in this component, and
 * the centre of the screen is left completely clear.
 *
 * The top bar is a three-column grid (score · timer · speed and pause) inset
 * by the device safe areas, so it clears notches and rounded corners on phones
 * and the pause button sits in the corner a thumb reaches without looking.
 */

import { Pause } from 'lucide-react';
import { SURVIVAL_MILESTONES } from '../config/ScoreConfig';
import { VISUAL } from '../config/VisualConfig';
import type { HudSnapshot } from '../types';
import { formatNumber, formatTime, lerp } from '../utils/MathUtils';

/** The top milestone gets the OVERLOAD SURVIVOR treatment. */
const SURVIVOR_MULTIPLIER = SURVIVAL_MILESTONES[SURVIVAL_MILESTONES.length - 1]!.multiplier;

interface HudProps {
  snapshot: HudSnapshot;
  onPause: () => void;
}

export function HUD({ snapshot, onPause }: HudProps): JSX.Element {
  // [Design] The HUD steps back as the run intensifies, so late-game geometry
  // is never competing with the interface for attention.
  const opacity = lerp(1, VISUAL.HUD_MIN_OPACITY, snapshot.visualIntensity);
  const overload = snapshot.survivalMultiplier >= SURVIVOR_MULTIPLIER;

  return (
    <div className="hud">
      <div className="hud__bar" style={{ opacity }}>
        <div className="hud__score">
          <div className="hud__label">Score</div>
          <div className="hud__value">{formatNumber(snapshot.score)}</div>
          {snapshot.survivalMultiplier > 1 && (
            <div className={overload ? 'hud__survival hud__survival--overload' : 'hud__survival'}>
              ×{snapshot.survivalMultiplier} {overload ? 'Overload survivor' : 'Survival'}
            </div>
          )}
        </div>

        <div className="hud__centre">
          <div className="hud__timer">{formatTime(snapshot.timeSeconds)}</div>
          {snapshot.combo >= 1 && (
            <div className="hud__combo-wrap">
              {/* Keyed on the count so every clear replays the pop. */}
              <div key={snapshot.combo} className="hud__combo">
                ×{snapshot.combo}
              </div>
              <div className="hud__label">Combo</div>
            </div>
          )}
        </div>

        <div className="hud__right">
          <div className="hud__speed">
            <div className="hud__value hud__value--speed">{snapshot.speed}</div>
            <div className="hud__label">Cubes/s</div>
          </div>
          <button
            type="button"
            className="button button--icon hud__pause"
            onClick={onPause}
            aria-label="Pause the run"
          >
            <Pause size={20} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
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
