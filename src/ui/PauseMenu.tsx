/**
 * Pause overlay. The simulation is fully stopped behind it: the loop does not
 * step, obstacles do not move, the timer does not run and the music is ducked.
 */

import { Home, Play, RotateCcw, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onSettings: () => void;
  onHover: () => void;
}

export function PauseMenu({
  onResume,
  onRestart,
  onMainMenu,
  onSettings,
  onHover,
}: PauseMenuProps): JSX.Element {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div className="screen screen--overlay" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="panel">
        <h2 className="heading">Paused</h2>
        <div className="stack">
          <button
            ref={resumeRef}
            type="button"
            className="button button--primary"
            style={{ width: '100%' }}
            onClick={onResume}
            onMouseEnter={onHover}
          >
            <Play size={20} strokeWidth={2} aria-hidden="true" />
            Resume
          </button>
          <button
            type="button"
            className="button button--secondary"
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
            onClick={onSettings}
            onMouseEnter={onHover}
          >
            <Settings size={20} strokeWidth={2} aria-hidden="true" />
            Settings
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
