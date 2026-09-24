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
import { RotateHint } from './ui/RotateHint';
import { SettingsMenu } from './ui/SettingsMenu';
import { TouchControls } from './ui/TouchControls';
import { CalibrationOverlay } from './ui/CalibrationOverlay';
import {
  canHover,
  enterFullscreen,
  isPortrait,
  landscapeRequired,
  lockLandscape,
  useRotateSuggested,
  useTouchInput,
} from './ui/device';
import type { ControlInfo, GameState, PersistedStats, RunStats, Settings } from './types';
import './ui/ui.css';

const CANVAS_LABEL =
  'VOIDRUSH gameplay area. Use W A S D, device tilt or the on-screen joystick to move through incoming obstacles. Press Escape or the pause button to pause.';

/** What happens once tilt calibration finishes. */
type AfterCalibration = 'start' | 'resume' | 'return';

const INITIAL_CONTROL: ControlInfo = Object.freeze({
  active: 'keyboard' as const,
  status: 'off' as const,
  calibrated: false,
  touchPrimary: false,
});

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<VoidrushApp | null>(null);

  const [state, setState] = useState<GameState>('MENU');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<PersistedStats>(DEFAULT_STATS);
  const [results, setResults] = useState<RunStats | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [control, setControl] = useState<ControlInfo>(INITIAL_CONTROL);
  const [calibration, setCalibration] = useState<AfterCalibration | null>(null);
  const [rotateDismissed, setRotateDismissed] = useState(false);
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
      onControlChange: setControl,
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

  const touchDetected = useTouchInput();
  const tiltSteering = control.active === 'tilt';
  // Tilt replaces the joystick unless the player forced the stick on as well.
  const showTouchControls =
    (settings.touchControls === 'on' || (settings.touchControls === 'auto' && touchDetected)) &&
    (!tiltSteering || settings.touchControls === 'on');

  // Landscape is suggested on phones and tablets, never required. Turning the
  // device mid-run pauses it, so the new layout (and, for tilt, the new grip)
  // never lands the player straight into an obstacle. Tilt also pauses itself
  // on any quarter turn, since its axes change (see VoidrushApp).
  const rotateSuggested = useRotateSuggested();
  const wasPortrait = useRef(rotateSuggested);
  useEffect(() => {
    if (wasPortrait.current !== rotateSuggested && state === 'PLAYING') appRef.current?.pause();
    wasPortrait.current = rotateSuggested;
  }, [rotateSuggested, state]);

  // Stop the page panning or bouncing under a thumb during a run, while menus
  // keep their normal scrolling (see body[data-state] in ui.css).
  useEffect(() => {
    document.body.dataset.state = state;
  }, [state]);

  // On a touchscreen, mouseenter fires as part of a tap and would double every
  // click sound, so hover feedback is only for real hovering pointers.
  const hover = useCallback(() => {
    if (canHover()) appRef.current?.playSound('UI_HOVER');
  }, []);
  const steer = useCallback((x: number, y: number) => appRef.current?.setTouchAxis(x, y), []);
  const click = useCallback(<T,>(action: (instance: VoidrushApp) => T) => {
    return (): void => {
      const instance = appRef.current;
      if (!instance) return;
      instance.playSound('UI_CLICK');
      action(instance);
    };
  }, []);

  /**
   * Starts or resumes a run, calibrating tilt first when it has no neutral
   * pose. Must run synchronously inside the tap: `prepareTilt` makes the iOS
   * motion-access request before anything else can spend the gesture. Without
   * tilt it completes synchronously, exactly as before.
   */
  const launch = useCallback((instance: VoidrushApp, next: 'start' | 'resume') => {
    const go = (): void => {
      if (instance.needsCalibration) setCalibration(next);
      else if (next === 'start') instance.startRun();
      else instance.resume();
    };
    const tilt = instance.prepareTilt();
    if (tilt) void tilt.then(go);
    else go();
  }, []);

  const afterCalibration = (instance: VoidrushApp, next: AfterCalibration): void => {
    setCalibration(null);
    if (next === 'start') instance.startRun();
    else if (next === 'resume') instance.resume();
  };

  // Tilt was wanted but cannot be used: say why, and that touch has taken over.
  const tiltWanted =
    settings.controlMode === 'tilt' || (settings.controlMode === 'auto' && control.touchPrimary);
  const controlNote = !tiltWanted
    ? null
    : control.status === 'denied'
      ? 'Motion access denied · steering by touch. Enable it in Settings.'
      : control.status === 'unavailable'
        ? 'No tilt sensor responded · steering by touch.'
        : null;
  const pauseNote =
    tiltSteering && control.status === 'lost'
      ? 'Tilt signal lost. Hold your device normally and resume, or steer by touch.'
      : tiltSteering && !control.calibrated
        ? 'Screen rotated. Tilt recalibrates when you resume.'
        : null;

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

      {state === 'PLAYING' && showTouchControls && (
        <TouchControls
          mode={settings.joystickMode}
          side={settings.joystickSide}
          size={settings.joystickSize}
          onAxis={steer}
        />
      )}

      {state === 'PLAYING' && (
        <HUD snapshot={snapshot} onPause={click((instance) => instance.togglePause())} />
      )}

      {state === 'MENU' && calibration === null && (
        <MainMenu
          stats={stats}
          touch={showTouchControls}
          tilt={tiltSteering}
          controlNote={controlNote}
          side={settings.joystickSide}
          onPlay={click((instance) => {
            // Motion access first: iOS prompts only from an unspent gesture.
            launch(instance, 'start');
            // Phones lose a fifth of the screen to browser chrome; take it back
            // while the tap still counts as a user gesture. Already sideways,
            // hold the screen in landscape so tilting the phone mid-run cannot
            // flip the view; held upright, respect the choice to play that way.
            if (landscapeRequired() && !isPortrait()) void lockLandscape();
            else if (touchDetected) void enterFullscreen();
          })}
          onSettings={click((instance) => instance.openSettings())}
          onCredits={click((instance) => instance.openCredits())}
          onHover={hover}
        />
      )}

      {state === 'PAUSED' && calibration === null && (
        <PauseMenu
          score={snapshot.score}
          timeSeconds={snapshot.timeSeconds}
          tilt={tiltSteering}
          note={pauseNote}
          onResume={click((instance) => launch(instance, 'resume'))}
          onRestart={click((instance) => launch(instance, 'start'))}
          onMainMenu={click((instance) => instance.returnToMenu())}
          onSettings={click((instance) => instance.openSettings())}
          onRecalibrate={click(() => setCalibration('return'))}
          onUseTouch={click((instance) => instance.disableTiltForSession())}
          onHover={hover}
        />
      )}

      {state === 'GAME_OVER' && results && calibration === null && (
        <GameOver
          run={results}
          stats={stats}
          onRestart={click((instance) => launch(instance, 'start'))}
          onMainMenu={click((instance) => instance.returnToMenu())}
          onHover={hover}
        />
      )}

      {state === 'SETTINGS' && calibration === null && (
        <SettingsMenu
          settings={settings}
          touch={touchDetected}
          control={control}
          onChange={(patch) => appRef.current?.updateSettings(patch)}
          onEnableTilt={click((instance) => void instance.enableTilt())}
          onRecalibrate={click((instance) => {
            if (instance.controlInfo.active === 'tilt') setCalibration('return');
          })}
          onReset={click((instance) => instance.resetSettings())}
          onBack={click((instance) => instance.back())}
          onHover={hover}
        />
      )}

      {state === 'CREDITS' && (
        <Credits onBack={click((instance) => instance.back())} onHover={hover} />
      )}

      {calibration !== null && app && (
        <CalibrationOverlay
          onBegin={() => app.beginCalibration()}
          onFinish={(acceptUnsteady) => app.finishCalibration(acceptUnsteady)}
          onComplete={() => afterCalibration(app, calibration)}
          onCancel={() => {
            app.cancelCalibration();
            setCalibration(null);
          }}
          onUseTouch={() => {
            app.playSound('UI_CLICK');
            app.disableTiltForSession();
            afterCalibration(app, calibration);
          }}
        />
      )}

      {rotateSuggested && !rotateDismissed && state !== 'PLAYING' && calibration === null && (
        <RotateHint
          onClick={() => appRef.current?.playSound('UI_CLICK')}
          onDismiss={() => {
            appRef.current?.playSound('UI_CLICK');
            setRotateDismissed(true);
          }}
        />
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
