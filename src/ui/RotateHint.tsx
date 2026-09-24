/**
 * Suggests landscape on a phone or tablet held upright.
 *
 * VOIDRUSH is designed for landscape, but portrait still plays, so this is a
 * small dismissible card rather than a wall: ROTATE DEVICE, FOR BEST
 * EXPERIENCE. Where the browser can hold the screen in landscape (Chrome on
 * Android, in fullscreen) one tap does the rotation. Elsewhere, iOS in
 * particular, the player turns the device and the card goes away on its own.
 */

import { Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { fullscreenSupported, lockLandscape, orientationLockSupported } from './device';

interface RotateHintProps {
  onClick: () => void;
  onDismiss: () => void;
}

export function RotateHint({ onClick, onDismiss }: RotateHintProps): JSX.Element {
  // Hide the button where it can do nothing, or once it has been refused.
  const [canLock, setCanLock] = useState(() => fullscreenSupported() && orientationLockSupported());

  const rotate = (): void => {
    onClick();
    void lockLandscape().then((locked) => {
      if (!locked) setCanLock(false);
    });
  };

  return (
    <div className="rotate-hint" role="status" aria-labelledby="rotate-hint-title">
      <div className="rotate-hint__device" aria-hidden="true">
        <Smartphone size={28} strokeWidth={1.75} />
      </div>
      <div className="rotate-hint__text">
        <span className="rotate-hint__title" id="rotate-hint-title">
          Rotate device
        </span>
        <span className="rotate-hint__body">For best experience</span>
      </div>
      {canLock && (
        <button type="button" className="button button--secondary rotate-hint__action" onClick={rotate}>
          Landscape
        </button>
      )}
      <button
        type="button"
        className="button button--icon rotate-hint__close"
        onClick={onDismiss}
        aria-label="Dismiss and keep playing in portrait"
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
