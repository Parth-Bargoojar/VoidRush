/**
 * Results screen. No confirmation dialogs: RESTART begins a new run
 * immediately, which is the whole "one more run" loop.
 *
 * The buttons arm a moment after the screen appears. On a touchscreen the
 * player's thumb is usually still steering when the run ends, and a stray tap
 * during the fade must not throw them back to the main menu.
 */

import { Home, RotateCcw, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PersistedStats, RunStats } from '../types';
import { formatNumber, formatTime } from '../utils/MathUtils';
import { Modal } from './Modal';

/** Matches the results fade-in, so the buttons arm as the panel settles. */
const ARM_DELAY_MS = 450;

interface GameOverProps {
  run: RunStats;
  stats: PersistedStats;
  onRestart: () => void;
  onMainMenu: () => void;
  onHover: () => void;
}

export function GameOver({
  run,
  stats,
  onRestart,
  onMainMenu,
  onHover,
}: GameOverProps): JSX.Element {
  const restartRef = useRef<HTMLButtonElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    restartRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Modal
      title="Run Over"
      eyebrow={run.isNewBest ? 'Personal record' : 'Results'}
      backdrop="results"
      size="md"
      className={armed ? 'modal--results' : 'modal--results modal--unarmed'}
      footer={
        <div className="modal__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onMainMenu}
            onMouseEnter={onHover}
          >
            <Home size={20} strokeWidth={2} aria-hidden="true" />
            Main Menu
          </button>
          <button
            ref={restartRef}
            type="button"
            className="button button--primary"
            onClick={onRestart}
            onMouseEnter={onHover}
          >
            <RotateCcw size={20} strokeWidth={2.25} aria-hidden="true" />
            Restart
          </button>
        </div>
      }
    >
      {/* Announced once, rather than statistics being read out every frame. */}
      <div role="status" aria-live="polite" className="visually-hidden">
        Run over. Score {run.score}. {run.obstaclesCleared} obstacles cleared.
      </div>

      <div className="results-hero">
        <span className="stat__label">Score</span>
        <span className="results-hero__value">{formatNumber(run.score)}</span>
        {run.isNewBest && (
          <span className="new-best">
            <Trophy size={14} strokeWidth={2.25} aria-hidden="true" />
            New best
          </span>
        )}
      </div>

      <div className="results-grid">
        <div className="stat">
          <span className="stat__label">Time</span>
          <span className="stat__value">{formatTime(run.timeSeconds)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Best</span>
          <span className="stat__value">{formatNumber(stats.bestScore)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Max Combo</span>
          <span className="stat__value">×{run.maxCombo}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Obstacles</span>
          <span className="stat__value">{formatNumber(run.obstaclesCleared)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Near Misses</span>
          <span className="stat__value">{formatNumber(run.nearMisses)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Top Speed</span>
          <span className="stat__value">{formatNumber(Math.round(run.topSpeed))}</span>
        </div>
      </div>
    </Modal>
  );
}
