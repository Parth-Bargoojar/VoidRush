/**
 * Results screen. No confirmation dialogs: RESTART begins a new run
 * immediately, which is the whole "one more run" loop.
 */

import { Home, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PersistedStats, RunStats } from '../types';
import { formatNumber, formatTime } from '../utils/MathUtils';

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

  useEffect(() => {
    restartRef.current?.focus();
  }, []);

  return (
    <div
      className="screen screen--results"
      role="dialog"
      aria-modal="true"
      aria-label="Run over"
    >
      <div className="panel panel--wide">
        {/* Announced once, rather than statistics being read out every frame. */}
        <div role="status" aria-live="polite" className="visually-hidden">
          Run over. Score {run.score}. {run.obstaclesCleared} obstacles cleared.
        </div>

        <h2 className="heading">Run Over</h2>
        {run.isNewBest && <div className="new-best">NEW BEST</div>}

        <div className="results-grid">
          <div className="stat">
            <span className="stat__label">Score</span>
            <span className="stat__value stat__value--highlight">{formatNumber(run.score)}</span>
          </div>
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
        </div>

        <div className="stack">
          <button
            ref={restartRef}
            type="button"
            className="button button--primary"
            style={{ width: '100%' }}
            onClick={onRestart}
            onMouseEnter={onHover}
          >
            <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
            Restart
          </button>
          <button
            type="button"
            className="button button--secondary"
            style={{ width: '100%' }}
            onClick={onMainMenu}
            onMouseEnter={onHover}
          >
            <Home size={20} strokeWidth={2} aria-hidden="true" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
