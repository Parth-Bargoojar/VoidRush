/**
 * Main menu. The live tunnel renders behind at reduced intensity through the
 * same renderer and the same WebGL context — this screen is an overlay on the
 * game, not a separate page.
 */

import { Info, Maximize, Minimize, Play, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { JoystickSide, PersistedStats } from '../types';
import { formatNumber, formatTime } from '../utils/MathUtils';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from './device';

interface MainMenuProps {
  stats: PersistedStats;
  touch: boolean;
  /** Tilt steers: the hint describes tilting instead of the joystick. */
  tilt: boolean;
  /** A short line about the controls, e.g. why tilt is not in use. */
  controlNote?: string | null;
  /** The half of the screen the joystick answers on. */
  side: JoystickSide;
  onPlay: () => void;
  onSettings: () => void;
  onCredits: () => void;
  onHover: () => void;
}

export function MainMenu({
  stats,
  touch,
  tilt,
  controlNote = null,
  side,
  onPlay,
  onSettings,
  onCredits,
  onHover,
}: MainMenuProps): JSX.Element {
  const playRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useFullscreen();

  // Focus lands on PLAY so the whole game is reachable from the keyboard alone.
  useEffect(() => {
    playRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="screen screen--menu screen--main">
      {fullscreenSupported() && (
        <button
          type="button"
          className="button button--icon screen__corner"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullscreen ? (
            <Minimize size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Maximize size={20} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      )}

      <div className="menu">
        <div className="menu__brand">
          <h1 className="title">VOIDRUSH</h1>
          <p className="subtitle">Endless flight</p>
          <p className="menu__creator">
            Created by <span className="menu__creator-name">Parth Bargoojar</span>
          </p>
        </div>

        <div className="menu__actions">
          <button
            ref={playRef}
            type="button"
            className="button button--primary button--play"
            onClick={onPlay}
            onMouseEnter={onHover}
          >
            <Play size={22} strokeWidth={2.25} aria-hidden="true" />
            Play
          </button>

          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={onSettings}
              onMouseEnter={onHover}
            >
              <Settings size={20} strokeWidth={2} aria-hidden="true" />
              Settings
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={onCredits}
              onMouseEnter={onHover}
            >
              <Info size={20} strokeWidth={2} aria-hidden="true" />
              Credits
            </button>
          </div>
        </div>

        {stats.bestScore > 0 && (
          <dl className="menu__stats">
            <div>
              <dt>Best</dt>
              <dd>{formatNumber(stats.bestScore)}</dd>
            </div>
            <div>
              <dt>Longest</dt>
              <dd>{formatTime(stats.bestTime)}</dd>
            </div>
            <div>
              <dt>Runs</dt>
              <dd>{formatNumber(stats.totalRuns)}</dd>
            </div>
          </dl>
        )}

        <p className="caption menu__hint">
          {tilt ? (
            'Tilt to steer · Tap ❚❚ to pause'
          ) : touch ? (
            `Drag on the ${side} to steer · Tap ❚❚ to pause`
          ) : (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> to steer · <kbd>Esc</kbd> to pause
            </>
          )}
          {controlNote && (
            <span className="menu__note" role="status">
              {controlNote}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
