/**
 * The optional INSTALL VOIDRUSH action. Renders nothing unless installing is
 * actually possible: Chromium offered a prompt, or this is iOS/iPadOS, where the
 * only route is Share → Add to Home Screen and the steps are shown on request.
 * Hidden once installed or when running as the installed app.
 */

import { Download, Share, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { promptInstall, usePwa } from './pwa';

interface InstallActionProps {
  onHover: () => void;
  onClick: () => void;
}

export function InstallAction({ onHover, onClick }: InstallActionProps): JSX.Element | null {
  const { canPrompt, manualInstall, installed } = usePwa();
  const [guide, setGuide] = useState(false);

  if (installed || (!canPrompt && !manualInstall)) return null;

  return (
    <>
      <button
        type="button"
        className="button button--ghost pwa-install"
        onMouseEnter={onHover}
        onClick={() => {
          onClick();
          if (canPrompt) void promptInstall();
          else setGuide(true);
        }}
      >
        <Download size={16} strokeWidth={2} aria-hidden="true" />
        Install VOIDRUSH
      </button>

      {guide && (
        <Modal
          title="Install VOIDRUSH"
          eyebrow="Home Screen"
          backdrop="menu"
          size="sm"
          onClose={() => setGuide(false)}
          footer={
            <button
              type="button"
              className="button button--primary button--block"
              onClick={() => setGuide(false)}
            >
              Got it
            </button>
          }
        >
          <ol className="pwa-steps">
            <li>
              <Share size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                Tap <strong>Share</strong> in the browser toolbar.
              </span>
            </li>
            <li>
              <SquarePlus size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </span>
            </li>
          </ol>
          <p className="caption">
            VOIDRUSH then opens full screen from its icon and plays offline. Scores and settings
            stay on this device.
          </p>
        </Modal>
      )}
    </>
  );
}
