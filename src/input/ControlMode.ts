/**
 * VOIDRUSH — which steering source is in charge.
 *
 * The keyboard is always listening, so a tablet with a keyboard case steers
 * either way. The control mode decides whether tilt is fed to the player as
 * well, and therefore whether the on-screen joystick is needed.
 */

import type { ActiveControl, ControlMode, TiltStatus } from '../types';

export interface ControlCapabilities {
  /** The primary pointer is a finger: a phone or tablet. */
  touchPrimary: boolean;
  /** The tilt source's current status. */
  tilt: TiltStatus;
}

/**
 * True while tilt could still work: it is supported, not refused, and has not
 * been found to have no sensor behind it. A temporarily lost signal still
 * counts, because it usually comes back.
 */
export function tiltUsable(status: TiltStatus): boolean {
  return status !== 'unsupported' && status !== 'denied' && status !== 'unavailable';
}

/**
 * AUTO picks tilt on a phone or tablet that can provide it, and the keyboard
 * (with the joystick on touchscreens) everywhere else. TILT asks for tilt
 * wherever it is usable, including a touchscreen laptop, and falls back to the
 * keyboard when it is not, so the game is never left without steering.
 */
export function resolveControlMode(
  preference: ControlMode,
  capabilities: ControlCapabilities,
): ActiveControl {
  if (preference === 'keyboard') return 'keyboard';
  if (!tiltUsable(capabilities.tilt)) return 'keyboard';
  if (preference === 'tilt') return 'tilt';
  return capabilities.touchPrimary ? 'tilt' : 'keyboard';
}

/**
 * Feature detection for a phone or tablet: the primary pointer is coarse, or
 * there is touch and nothing can hover. No user-agent sniffing.
 */
export function detectTouchPrimary(win: Window | undefined = globalThis.window): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const hover = win.matchMedia('(hover: hover)').matches;
  const touchPoints = win.navigator?.maxTouchPoints ?? 0;
  return coarse || (touchPoints > 0 && !hover);
}
