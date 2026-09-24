/**
 * VOIDRUSH — device capabilities the interface adapts to.
 *
 * Touch is tracked as a small external store rather than decided once, because
 * hybrid devices (a laptop with a touchscreen, a tablet with a keyboard) change
 * hands mid-session: the on-screen joystick appears the moment someone touches
 * the screen and steps aside again when they go back to the keyboard.
 */

import { useSyncExternalStore } from 'react';

type Listener = () => void;

function media(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** A phone or tablet: the primary pointer is a finger. */
function primaryIsTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  return media('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !media('(hover: hover)'));
}

const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

let touchActive = primaryIsTouch();
const listeners = new Set<Listener>();
let detach: (() => void) | null = null;

function setTouch(next: boolean): void {
  if (next === touchActive) return;
  touchActive = next;
  for (const listener of listeners) listener();
}

function attach(): void {
  if (detach || typeof window === 'undefined') return;
  const onPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') setTouch(true);
  };
  const onKey = (event: KeyboardEvent): void => {
    // Steering with the keyboard on a hybrid device hands control back to it.
    if (MOVE_CODES.has(event.code) && !media('(pointer: coarse)')) setTouch(false);
  };
  window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
  window.addEventListener('keydown', onKey, { capture: true, passive: true });
  detach = (): void => {
    window.removeEventListener('pointerdown', onPointer, { capture: true });
    window.removeEventListener('keydown', onKey, { capture: true });
    detach = null;
  };
}

function subscribeTouch(listener: Listener): () => void {
  listeners.add(listener);
  attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach?.();
  };
}

/** True while the player is using a touchscreen. */
export function useTouchInput(): boolean {
  return useSyncExternalStore(
    subscribeTouch,
    () => touchActive,
    () => false,
  );
}

/** Hover sounds only make sense where a pointer can hover without clicking. */
export function canHover(): boolean {
  return media('(hover: hover) and (pointer: fine)');
}

/* ------------------------------------------------------------------ *
 * Fullscreen
 * ------------------------------------------------------------------ */

interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

function fullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Enters fullscreen. Must be called from inside a user gesture. Resolves true
 * once the page is fullscreen and false if it was refused; never rejects.
 */
export function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported()) return Promise.resolve(false);
  if (fullscreenElement()) return Promise.resolve(true);
  const root = document.documentElement as WebkitElement;
  try {
    const result = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen?.();
    if (result instanceof Promise) {
      return result.then(
        () => true,
        () => false,
      );
    }
    // The prefixed API returns nothing; it either worked synchronously or not.
    return Promise.resolve(fullscreenElement() !== null);
  } catch {
    // Refused (no gesture, or a policy): the game plays the same in a window.
    return Promise.resolve(false);
  }
}

export function toggleFullscreen(): void {
  if (!fullscreenElement()) {
    void (landscapeRequired() ? lockLandscape() : enterFullscreen());
    return;
  }
  const doc = document as WebkitDocument;
  try {
    const result = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.();
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // Nothing to undo.
  }
}

function subscribeFullscreen(listener: Listener): () => void {
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
  return () => {
    document.removeEventListener('fullscreenchange', listener);
    document.removeEventListener('webkitfullscreenchange', listener);
  };
}

export function useFullscreen(): boolean {
  return useSyncExternalStore(
    subscribeFullscreen,
    () => fullscreenElement() !== null,
    () => false,
  );
}

/* ------------------------------------------------------------------ *
 * Orientation
 *
 * VOIDRUSH is a landscape game on phones and tablets: the stick sits under one
 * thumb and the tunnel gets the full width of the screen. Portrait is never
 * played; the interface asks for a rotation instead (see RotateGate).
 * ------------------------------------------------------------------ */

const PORTRAIT_QUERY = '(orientation: portrait)';
const COARSE_QUERY = '(pointer: coarse)';

const mediaLists = new Map<string, MediaQueryList>();

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  let list = mediaLists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    mediaLists.set(query, list);
  }
  return list;
}

function subscribeMedia(query: string, listener: Listener): () => void {
  const list = mediaList(query);
  // Rotation also fires resize, and older Safari only has addListener; listen
  // to both so a missed media event can never leave the gate stale.
  if (list?.addEventListener) list.addEventListener('change', listener);
  else list?.addListener?.(listener);
  window.addEventListener('resize', listener);
  window.addEventListener('orientationchange', listener);
  return () => {
    if (list?.removeEventListener) list.removeEventListener('change', listener);
    else list?.removeListener?.(listener);
    window.removeEventListener('resize', listener);
    window.removeEventListener('orientationchange', listener);
  };
}

const subscribePortrait = (listener: Listener): (() => void) =>
  subscribeMedia(PORTRAIT_QUERY, listener);
const subscribeCoarse = (listener: Listener): (() => void) =>
  subscribeMedia(COARSE_QUERY, listener);

/** True while the viewport is taller than it is wide. */
export function isPortrait(): boolean {
  return mediaList(PORTRAIT_QUERY)?.matches ?? false;
}

/**
 * True on phones and tablets, where the game must be played in landscape.
 * Keyed on the primary pointer, not on recent touches, so a touchscreen laptop
 * is never asked to rotate.
 */
export function landscapeRequired(): boolean {
  return mediaList(COARSE_QUERY)?.matches ?? false;
}

/** True while a touch device is held in portrait and play must wait. */
export function useRotateRequired(): boolean {
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, () => false);
  const coarse = useSyncExternalStore(subscribeCoarse, landscapeRequired, () => false);
  return portrait && coarse;
}

interface LockableOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

/** Whether the browser exposes an orientation lock at all. */
export function orientationLockSupported(): boolean {
  if (typeof screen === 'undefined' || !screen.orientation) return false;
  return typeof (screen.orientation as LockableOrientation).lock === 'function';
}

/**
 * Goes fullscreen and holds the screen in landscape, so tilting a phone
 * mid-run cannot flip the view. Browsers only allow the lock in fullscreen
 * (Chrome on Android); elsewhere it is refused and the player rotates by hand.
 * Must be called from inside a user gesture. Resolves true if the lock took.
 */
export async function lockLandscape(): Promise<boolean> {
  const fullscreen = await enterFullscreen();
  if (!fullscreen || !orientationLockSupported()) return false;
  try {
    await (screen.orientation as LockableOrientation).lock!('landscape');
    return true;
  } catch {
    return false;
  }
}

/** Whether the device can vibrate. iOS Safari cannot. */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
