/**
 * VOIDRUSH — PWA layer.
 *
 * Service-worker registration, update state and install state, kept entirely
 * outside the engine and the render loop. It is a tiny external store: React
 * reads it through `usePwa` and re-renders only when one of these rare events
 * fires (update found, install offered, app installed). Nothing polls per frame.
 *
 * Updates never apply themselves. A new worker waits (`registerType: 'prompt'`)
 * until the player taps UPDATE on a safe screen; `applyUpdate` then activates
 * it and reloads once. The worker is production-only (see vite.config.ts).
 */

import { useSyncExternalStore } from 'react';

/** Chromium's install prompt event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** A new version is downloaded and waiting for the player to accept it. */
  updateReady: boolean;
  /** The browser offered a programmatic install prompt (Chromium). */
  canPrompt: boolean;
  /** iOS/iPadOS, not yet installed: installing is manual via Share. */
  manualInstall: boolean;
  /** Running as an installed app (standalone/fullscreen display mode). */
  installed: boolean;
}

/** How often an open session checks for a new deployment. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let state: PwaState = {
  updateReady: false,
  canPrompt: false,
  manualInstall: false,
  installed: false,
};
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>): void {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof PwaState)[]).every((key) => next[key] === state[key])) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/** iPhone, iPod or iPad — including iPadOS, which reports itself as a Mac. */
function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

let started = false;

/** Wires up install and update tracking. Call once, before React renders. */
export function initPwa(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const installed = isStandalone();
  set({ installed, manualInstall: !installed && isAppleMobile() });

  // Chromium fires this when the app is installable. Keep it for the menu's
  // INSTALL action instead of letting the browser show its own mini-infobar.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    set({ canPrompt: false, manualInstall: false });
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (event) => {
    if (event.matches) set({ installed: true, canPrompt: false, manualInstall: false });
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // The virtual module exists only when the PWA plugin builds; loading it
  // lazily keeps it out of the critical path and out of unit tests.
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh: () => set({ updateReady: true }),
        onRegisteredSW: (_url, registration) => {
          if (!registration) return;
          const check = (): void => {
            if (navigator.onLine && registration.installing === null) {
              void registration.update().catch(() => undefined);
            }
          };
          window.setInterval(check, UPDATE_CHECK_MS);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
        },
        onRegisterError: () => undefined,
      });
    })
    .catch(() => undefined);
}

/** Activates the waiting worker and reloads once it takes control. */
export function applyUpdate(): void {
  if (updateSW) void updateSW(true);
  else window.location.reload();
}

/** Shows Chromium's install dialog. Resolves true if the player accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  set({ canPrompt: false });
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): PwaState => state;

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
