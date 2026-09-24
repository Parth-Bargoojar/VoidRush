/**
 * The shell every pop-up shares: a header with the title and an optional close
 * button, a body that scrolls on its own when the screen is short, and a footer
 * that stays pinned so the primary action is always in reach of a thumb.
 *
 * On phones the panel becomes a sheet anchored to the bottom edge; on short
 * landscape screens it fills the height. Tab and Shift+Tab stay inside it.
 */

import { X } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  /** Small label above the title. */
  eyebrow?: string;
  /** Backdrop style: `menu` over the idle tunnel, `overlay` over a paused run. */
  backdrop: 'menu' | 'overlay' | 'results';
  size?: 'sm' | 'md' | 'lg';
  onClose?: () => void;
  closeLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  eyebrow,
  backdrop,
  size = 'md',
  onClose,
  closeLabel = 'Close',
  footer,
  children,
  className,
}: ModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`screen screen--${backdrop}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={`modal modal--${size}${className ? ` ${className}` : ''}`}
        onKeyDown={trapFocus}
      >
        <header className="modal__header">
          <div className="modal__titles">
            {eyebrow && <span className="modal__eyebrow">{eyebrow}</span>}
            <h2 className="modal__title">{title}</h2>
          </div>
          {onClose && (
            <button
              type="button"
              className="button button--icon modal__close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
