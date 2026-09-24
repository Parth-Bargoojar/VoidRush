/**
 * "A new version is ready" notice. App mounts it only on safe screens (menu,
 * pause, game over) — never over an active run — and nothing reloads until the
 * player taps UPDATE.
 */

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { applyUpdate } from './pwa';

interface UpdateBannerProps {
  /** Paused mid-run: say that updating ends the run. */
  midRun: boolean;
}

export function UpdateBanner({ midRun }: UpdateBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  if (dismissed) return null;

  return (
    <div className="pwa-banner" role="status" aria-live="polite">
      <div className="pwa-banner__text">
        <strong className="pwa-banner__title">Update available</strong>
        <span>
          A new version of VOIDRUSH is ready.{midRun ? ' Updating ends the current run.' : ''}
        </span>
      </div>
      <div className="pwa-banner__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setDismissed(true)}
        >
          Later
        </button>
        <button
          type="button"
          className="button button--primary pwa-banner__update"
          disabled={applying}
          onClick={() => {
            setApplying(true);
            applyUpdate();
          }}
        >
          <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
          Update
        </button>
      </div>
    </div>
  );
}
