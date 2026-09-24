/**
 * Asks for landscape.
 *
 * On a phone or tablet held upright this covers every screen, so a run can
 * never start, or carry on, in portrait. A run that is rotated away from is
 * paused first (App), and the pause menu is waiting when the device turns back.
 *
 * Where the browser can hold the screen in landscape (Chrome on Android, in
 * fullscreen) one tap does the rotation. Elsewhere, iOS in particular, the
 * player turns the device and the gate lifts on its own.
 */

import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import { fullscreenSupported, lockLandscape, orientationLockSupported } from './device';

interface RotateGateProps {
  onClick: () => void;
}

export function RotateGate({ onClick }: RotateGateProps): JSX.Element {
  // Hide the button where it can do nothing, or once it has been refused.
  const [canLock, setCanLock] = useState(() => fullscreenSupported() && orientationLockSupported());

  const rotate = (): void => {
    onClick();
    void lockLandscape().then((locked) => {
      if (!locked) setCanLock(false);
    });
  };

  return (
    <div
      className="rotate-gate"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rotate-gate-title"
      aria-describedby="rotate-gate-body"
    >
      <div className="rotate-gate__device" aria-hidden="true">
        <Smartphone size={72} strokeWidth={1.5} />
      </div>
      <h2 className="rotate-gate__title" id="rotate-gate-title">
        Rotate your device
      </h2>
      <p className="rotate-gate__body" id="rotate-gate-body">
        VOIDRUSH is played in landscape. Turn your phone sideways to fly.
      </p>
      {canLock ? (
        <button type="button" className="button button--primary" onClick={rotate}>
          Switch to landscape
        </button>
      ) : (
        <p className="caption rotate-gate__caption">
          Screen not turning? Switch off rotation lock.
        </p>
      )}
    </div>
  );
}
