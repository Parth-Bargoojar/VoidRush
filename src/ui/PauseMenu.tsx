/**
 * Pause overlay. The simulation is fully stopped behind it: the loop does not
 * step, obstacles do not move, the timer does not run and the music is ducked.
 *
 * This is also the only way out of a run on a phone, where there is no Esc
 * key, and where tilt is recalibrated mid-session.
 */

import { Crosshair, Hand, Home, Maximize, Minimize, Play, RotateCcw, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatNumber, formatTime } from '../utils/MathUtils';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from './device';
import { Modal } from './Modal';

interface PauseMenuProps {
  score: number;
  timeSeconds: number;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onSettings: () => void;
  onHover: () => void;
  /** Tilt is steering, so recalibration is offered. */
  tilt?: boolean;
  /** Why the run is on hold, when it was not the player's choice. */
  note?: string | null;
  onRecalibrate?: () => void;
  /** Offered with a note about a failing sensor: steer by touch instead. */
  onUseTouch?: () => void;
}

export function PauseMenu({
  score,
  timeSeconds,
  onResume,
  onRestart,
  onMainMenu,
  onSettings,
  onHover,
  tilt = false,
  note = null,
  onRecalibrate,
  onUseTouch,
}: PauseMenuProps): JSX.Element {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useFullscreen();

  useEffect(() => {
    resumeRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Modal
      title="Paused"
      eyebrow="Run on hold"
      backdrop="overlay"
      size="sm"
      onClose={onResume}
      closeLabel="Resume the run"
      className="modal--pause"
    >
      <div className="pause-summary">
        <div>
          <span className="stat__label">Score</span>
          <span className="pause-summary__value">{formatNumber(score)}</span>
        </div>
        <div>
          <span className="stat__label">Time</span>
          <span className="pause-summary__value">{formatTime(timeSeconds)}</span>
        </div>
      </div>

      {note && (
        <p className="pause-note" role="status">
          {note}
        </p>
      )}

      <div className="pause-actions">
        <button
          ref={resumeRef}
          type="button"
          className="button button--primary button--block pause-actions__resume"
          onClick={onResume}
          onMouseEnter={onHover}
        >
          <Play size={20} strokeWidth={2.25} aria-hidden="true" />
          Resume
        </button>
        <button
          type="button"
          className="button button--secondary button--block"
          onClick={onRestart}
          onMouseEnter={onHover}
        >
          <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
          Restart
        </button>
        {tilt && onRecalibrate && (
          <button
            type="button"
            className="button button--secondary button--block"
            onClick={onRecalibrate}
            onMouseEnter={onHover}
          >
            <Crosshair size={20} strokeWidth={2} aria-hidden="true" />
            Recalibrate tilt
          </button>
        )}
        {note && onUseTouch && (
          <button
            type="button"
            className="button button--secondary button--block"
            onClick={onUseTouch}
            onMouseEnter={onHover}
          >
            <Hand size={20} strokeWidth={2} aria-hidden="true" />
            Use touch controls
          </button>
        )}
        <button
          type="button"
          className="button button--secondary button--block"
          onClick={onSettings}
          onMouseEnter={onHover}
        >
          <Settings size={20} strokeWidth={2} aria-hidden="true" />
          Settings
        </button>
        <button
          type="button"
          className="button button--secondary button--block"
          onClick={onMainMenu}
          onMouseEnter={onHover}
        >
          <Home size={20} strokeWidth={2} aria-hidden="true" />
          Main Menu
        </button>
        {fullscreenSupported() && (
          <button
            type="button"
            className="button button--ghost button--block"
            onClick={toggleFullscreen}
            onMouseEnter={onHover}
          >
            {fullscreen ? (
              <Minimize size={18} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Maximize size={18} strokeWidth={2} aria-hidden="true" />
            )}
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        )}
      </div>
    </Modal>
  );
}
