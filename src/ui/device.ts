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

/** Enters fullscreen. Must be called from inside a user gesture; failures are ignored. */
export function enterFullscreen(): void {
  if (!fullscreenSupported() || fullscreenElement()) return;
  const root = document.documentElement as WebkitElement;
  try {
    const result = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen?.();
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // Refused (no gesture, or a policy): the game plays the same in a window.
  }
}

export function toggleFullscreen(): void {
  if (!fullscreenElement()) {
    enterFullscreen();
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

/** Whether the device can vibrate. iOS Safari cannot. */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
