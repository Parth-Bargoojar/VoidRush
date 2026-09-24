/**
 * Tilt calibration: CALIBRATE TILT → KEEP STILL → 3 · 2 · 1 → READY.
 *
 * The countdown doubles as the sampling window. Readings are collected by the
 * tilt source's own event handler; this component only drives the timing and
 * re-renders once per countdown tick, never per sensor event.
 *
 * A device that was moving is asked to hold steady and tried again; after
 * CALIBRATION_RETRIES the average is accepted anyway, so a player on a bus is
 * never locked out. A device that produced no readings at all gets a way out
 * to touch steering.
 */

import { Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TILT } from '../config/TiltConfig';
import type { CalibrationResult } from '../input/tilt';

type Phase =
  | { kind: 'settle'; attempt: number; unsteady: boolean }
  | { kind: 'count'; attempt: number; value: number }
  | { kind: 'ready' }
  | { kind: 'failed' };

interface CalibrationOverlayProps {
  /** Starts collecting readings. */
  onBegin: () => void;
  /** Stops collecting and applies the result where it is usable. */
  onFinish: (acceptUnsteady: boolean) => CalibrationResult;
  /** Calibrated; carry on to whatever asked for it. */
  onComplete: () => void;
  onCancel: () => void;
  /** No signal: give up on tilt for this session. */
  onUseTouch: () => void;
}

export function CalibrationOverlay({
  onBegin,
  onFinish,
  onComplete,
  onCancel,
  onUseTouch,
}: CalibrationOverlayProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'settle', attempt: 0, unsteady: false });

  // The parent re-renders at HUD rate; hold the latest callbacks in a ref so a
  // new identity never restarts the countdown.
  const handlers = useRef({ onBegin, onFinish, onComplete, onCancel });
  handlers.current = { onBegin, onFinish, onComplete, onCancel };
  const collecting = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const after = (ms: number, action: () => void): void => {
      timer = setTimeout(action, ms);
    };

    if (phase.kind === 'settle') {
      after(TILT.CALIBRATION_SETTLE_MS, () => {
        collecting.current = true;
        handlers.current.onBegin();
        setPhase({ kind: 'count', attempt: phase.attempt, value: TILT.CALIBRATION_COUNT_FROM });
      });
    } else if (phase.kind === 'count') {
      after(TILT.CALIBRATION_COUNT_STEP_MS, () => {
        if (phase.value > 1) {
          setPhase({ kind: 'count', attempt: phase.attempt, value: phase.value - 1 });
          return;
        }
        collecting.current = false;
        const accept = phase.attempt >= TILT.CALIBRATION_RETRIES;
        const result = handlers.current.onFinish(accept);
        if (result.ok || (result.reason === 'unsteady' && accept)) {
          setPhase({ kind: 'ready' });
        } else if (result.reason === 'unsteady') {
          setPhase({ kind: 'settle', attempt: phase.attempt + 1, unsteady: true });
        } else {
          setPhase({ kind: 'failed' });
        }
      });
    } else if (phase.kind === 'ready') {
      after(TILT.CALIBRATION_READY_MS, () => handlers.current.onComplete());
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [phase]);

  // Closing mid-countdown must not leave the tilt source collecting forever.
  useEffect(
    () => () => {
      if (collecting.current) handlers.current.onCancel();
    },
    [],
  );

  const cancel = (): void => {
    collecting.current = false;
    onCancel();
  };

  const counting = phase.kind === 'settle' || phase.kind === 'count';

  return (
    <div
      className="calibrate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibrate-title"
      aria-describedby="calibrate-body"
    >
      {counting && (
        <button
          type="button"
          className="button button--icon calibrate__close"
          onClick={cancel}
          aria-label="Cancel calibration"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      <div className="calibrate__panel">
        <span className="calibrate__eyebrow" id="calibrate-title">
          Calibrate tilt
        </span>

        {phase.kind === 'failed' ? (
          <>
            <h2 className="calibrate__status calibrate__status--error">No tilt signal</h2>
            <p className="calibrate__body" id="calibrate-body">
              This device is not reporting motion. Steer with touch instead, or try again.
            </p>
            <div className="calibrate__actions">
              <button type="button" className="button button--primary" onClick={onUseTouch}>
                Use touch controls
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setPhase({ kind: 'settle', attempt: 0, unsteady: false })}
              >
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="calibrate__device" aria-hidden="true">
              <Smartphone size={56} strokeWidth={1.5} />
            </div>
            <p className="calibrate__body" id="calibrate-body">
              Hold your device in your normal playing position.
            </p>
            <div className="calibrate__stage" aria-live="assertive" aria-atomic="true">
              {phase.kind === 'settle' && (
                <span className="calibrate__status calibrate__status--warn">
                  {phase.unsteady ? 'Hold steady' : 'Keep still'}
                </span>
              )}
              {phase.kind === 'count' && (
                // Keyed on the value so each number replays the pop.
                <span key={phase.value} className="calibrate__count">
                  {phase.value}
                </span>
              )}
              {phase.kind === 'ready' && (
                <span className="calibrate__status calibrate__status--ready">Ready</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
