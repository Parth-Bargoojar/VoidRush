/**
 * VOIDRUSH — the React root.
 *
 * React owns the screens and a HUD that updates from a 15 Hz snapshot. It never
 * touches per-frame simulation state: the only channel from the engine is
 * `GameBridge`, read here through `useSyncExternalStore`.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { VoidrushApp } from './app/AppState';
import { DEFAULT_STATS } from './persistence/ScoreStorage';
import { DEFAULT_SETTINGS } from './persistence/SettingsStorage';
import { Credits } from './ui/Credits';
import { GameOver } from './ui/GameOver';
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsMenu } from './ui/SettingsMenu';
import type { GameState, PersistedStats, RunStats, Settings } from './types';
import './ui/ui.css';

const CANVAS_LABEL =
  'VOIDRUSH gameplay area. Use W A S D to move through incoming obstacles. Press Escape to pause.';

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<VoidrushApp | null>(null);

  const [state, setState] = useState<GameState>('MENU');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<PersistedStats>(DEFAULT_STATS);
  const [results, setResults] = useState<RunStats | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [, setMountTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new VoidrushApp();
    appRef.current = app;

    const ok = app.mount(canvas, {
      onStateChange: setState,
      onSettingsChange: setSettings,
      onStatsChange: setStats,
      onRunEnd: setResults,
      onFatal: setFatal,
    });
    // Force one render so the screens can read the now-mounted controller.
    setMountTick((tick) => tick + 1);
    if (!ok) return () => app.dispose();

    return () => {
      app.dispose();
      appRef.current = null;
    };
  }, []);

  const app = appRef.current;

  // The single subscription that carries engine state into React, at 15 Hz.
  const snapshot = useSyncExternalStore(
    app ? app.bridge.subscribe : EMPTY_SUBSCRIBE,
    app ? app.bridge.getSnapshot : EMPTY_SNAPSHOT,
    app ? app.bridge.getSnapshot : EMPTY_SNAPSHOT,
  );

  const hover = useCallback(() => appRef.current?.playSound('UI_HOVER'), []);
  const click = useCallback(<T,>(action: (instance: VoidrushApp) => T) => {
    return (): void => {
      const instance = appRef.current;
      if (!instance) return;
      instance.playSound('UI_CLICK');
      action(instance);
    };
  }, []);

  if (fatal !== null) {
    return (
      <>
        <canvas ref={canvasRef} aria-label={CANVAS_LABEL} />
        <div className="fatal" role="alert">
          <h1 className="fatal__title">Unable to start</h1>
          <p className="fatal__body">
            Your browser or graphics hardware does not support the required graphics features.
            Please try the latest version of Chrome.
          </p>
          <p className="caption">{fatal}</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} aria-label={CANVAS_LABEL} tabIndex={-1} />

      {state === 'PLAYING' && (
        <HUD snapshot={snapshot} onPause={click((instance) => instance.togglePause())} />
      )}

      {state === 'MENU' && (
        <MainMenu
          stats={stats}
          onPlay={click((instance) => instance.startRun())}
          onSettings={click((instance) => instance.openSettings())}
          onCredits={click((instance) => instance.openCredits())}
          onHover={hover}
        />
      )}

      {state === 'PAUSED' && (
        <PauseMenu
          onResume={click((instance) => instance.resume())}
          onRestart={click((instance) => instance.startRun())}
          onMainMenu={click((instance) => instance.returnToMenu())}
          onSettings={click((instance) => instance.openSettings())}
          onHover={hover}
        />
      )}

      {state === 'GAME_OVER' && results && (
        <GameOver
          run={results}
          stats={stats}
          onRestart={click((instance) => instance.startRun())}
          onMainMenu={click((instance) => instance.returnToMenu())}
          onHover={hover}
        />
      )}

      {state === 'SETTINGS' && (
        <SettingsMenu
          settings={settings}
          onChange={(patch) => appRef.current?.updateSettings(patch)}
          onReset={click((instance) => instance.resetSettings())}
          onBack={click((instance) => instance.back())}
          onHover={hover}
        />
      )}

      {state === 'CREDITS' && (
        <Credits onBack={click((instance) => instance.back())} onHover={hover} />
      )}
    </>
  );
}

/** Placeholders used for the single render before the controller exists. */
const EMPTY_SUBSCRIBE = (): (() => void) => () => undefined;
const EMPTY_SNAPSHOT = (): ReturnType<VoidrushApp['bridge']['getSnapshot']> => FALLBACK_SNAPSHOT;
const FALLBACK_SNAPSHOT = Object.freeze({
  score: 0,
  combo: 1,
  speed: 0,
  timeSeconds: 0,
  tier: 'INTRO' as const,
  visualIntensity: 0,
  survivalMultiplier: 1,
  events: Object.freeze([]),
});
