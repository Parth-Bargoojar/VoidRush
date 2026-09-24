/**
 * Main menu. The live tunnel renders behind at reduced intensity through the
 * same renderer and the same WebGL context — this screen is an overlay on the
 * game, not a separate page.
 */

import { Info, Play, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PersistedStats } from '../types';
import { formatNumber } from '../utils/MathUtils';

interface MainMenuProps {
  stats: PersistedStats;
  onPlay: () => void;
  onSettings: () => void;
  onCredits: () => void;
  onHover: () => void;
}

export function MainMenu({
  stats,
  onPlay,
  onSettings,
  onCredits,
  onHover,
}: MainMenuProps): JSX.Element {
  const playRef = useRef<HTMLButtonElement>(null);

  // Focus lands on PLAY so the whole game is reachable from the keyboard alone.
  useEffect(() => {
    playRef.current?.focus();
  }, []);

  return (
    <div className="screen screen--menu">
      <div className="stack">
        <h1 className="title">VOIDRUSH</h1>
        <p className="subtitle">ENDLESS FLIGHT</p>

        <button
          ref={playRef}
          type="button"
          className="button button--primary button--play"
          onClick={onPlay}
          onMouseEnter={onHover}
        >
          <Play size={20} strokeWidth={2} aria-hidden="true" />
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

        {stats.bestScore > 0 && (
          <p className="caption" style={{ marginTop: 'var(--space-6)' }}>
            BEST {formatNumber(stats.bestScore)} · {stats.totalRuns} RUN
            {stats.totalRuns === 1 ? '' : 'S'}
          </p>
        )}
        <p className="caption">W A S D TO MOVE · ESC TO PAUSE</p>
      </div>
    </div>
  );
}
