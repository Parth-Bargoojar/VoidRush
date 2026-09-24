/**
 * The on-screen joystick.
 *
 * FLOATING (the default) spawns the stick wherever the thumb lands, so there is
 * no target to find by feel, and drags it along when the thumb travels past its
 * edge, so steering never "runs out". FIXED keeps it in a corner for players who
 * prefer a physical anchor.
 *
 * The output is analog: a half-pushed stick flies at half speed, which is what
 * makes threading a narrow gap possible on glass. A small radial dead zone keeps
 * a resting thumb from drifting.
 *
 * Like the HUD, this never causes a per-frame React render: pointer moves write
 * transforms straight to the DOM and the axis straight to the input manager.
 * React only re-renders to hide the first-run hint.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { JoystickMode, JoystickSide } from '../types';

interface TouchControlsProps {
  mode: JoystickMode;
  side: JoystickSide;
  /** Radius multiplier from settings. */
  size: number;
  onAxis: (x: number, y: number) => void;
}

/** Base radius in CSS pixels at size 1. */
const BASE_RADIUS = 60;
/** Fraction of the radius the stick ignores, so a resting thumb does not drift. */
const DEAD_ZONE = 0.12;
/** In FIXED mode, a touch must start within this many radii of the stick. */
const FIXED_GRAB_RADII = 2.2;
/** Keeps a floating stick fully on screen. */
const EDGE_MARGIN = 8;

interface Point {
  x: number;
  y: number;
}

export function TouchControls({
  mode,
  side,
  size,
  onAxis: onAxisProp,
}: TouchControlsProps): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const pointerId = useRef<number | null>(null);
  const centre = useRef<Point>({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(true);

  // The parent re-renders with the HUD; route through a ref so a new callback
  // identity can never reset the stick mid-drag.
  const axisRef = useRef(onAxisProp);
  axisRef.current = onAxisProp;
  const onAxis = (x: number, y: number): void => axisRef.current(x, y);

  const radius = useCallback((): number => {
    // Never let the stick take more than a fifth of the short side of the screen.
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(40, Math.min(BASE_RADIUS * size, shortSide * 0.2));
  }, [size]);

  const restPoint = useCallback((): Point => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const place = useCallback((point: Point, knobX: number, knobY: number, active: boolean) => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    if (!stick || !knob) return;
    stick.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    knob.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;
    stick.dataset.active = active ? 'true' : 'false';
  }, []);

  const rest = useCallback(() => {
    const r = radius();
    layerRef.current?.style.setProperty('--stick-radius', `${r}px`);
    centre.current = restPoint();
    place(centre.current, 0, 0, false);
  }, [place, radius, restPoint]);

  // Park the stick at its resting corner, and again whenever the screen changes.
  useEffect(() => {
    rest();
    window.addEventListener('resize', rest);
    return () => window.removeEventListener('resize', rest);
  }, [rest]);

  // Leaving the screen (pause, crash) must never leave the ship steering.
  useEffect(() => () => axisRef.current(0, 0), []);

  const track = (x: number, y: number): void => {
    const r = radius();
    let dx = x - centre.current.x;
    let dy = y - centre.current.y;
    let distance = Math.hypot(dx, dy);

    if (distance > r) {
      if (mode === 'floating') {
        // Drag the base along behind the thumb so it stays under it.
        const pull = 1 - r / distance;
        centre.current = { x: centre.current.x + dx * pull, y: centre.current.y + dy * pull };
        dx = x - centre.current.x;
        dy = y - centre.current.y;
      } else {
        dx *= r / distance;
        dy *= r / distance;
      }
      distance = r;
    }

    const magnitude = distance / r;
    if (magnitude < DEAD_ZONE) {
      onAxis(0, 0);
    } else {
      // Rescale past the dead zone so the output still starts from zero.
      const scaled = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE);
      onAxis((dx / distance) * scaled, (-dy / distance) * scaled);
    }
    place(centre.current, dx, dy, true);
  };

  const handleDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (pointerId.current !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const r = radius();
    const point = { x: event.clientX, y: event.clientY };
    if (mode === 'fixed') {
      const home = restPoint();
      if (Math.hypot(point.x - home.x, point.y - home.y) > r * FIXED_GRAB_RADII) return;
      centre.current = home;
    } else {
      centre.current = {
        x: Math.min(Math.max(point.x, r + EDGE_MARGIN), window.innerWidth - r - EDGE_MARGIN),
        y: Math.min(Math.max(point.y, r + EDGE_MARGIN), window.innerHeight - r - EDGE_MARGIN),
      };
    }

    event.preventDefault();
    pointerId.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; moves still arrive while the finger is over the layer.
    }
    if (showHint) setShowHint(false);
    track(point.x, point.y);
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== pointerId.current) return;
    event.preventDefault();
    track(event.clientX, event.clientY);
  };

  const handleUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    onAxis(0, 0);
    rest();
  };

  const hint =
    mode === 'floating' ? 'Touch and drag anywhere to steer' : 'Drag the stick to steer';

  return (
    <div
      ref={layerRef}
      className={`touch-layer touch-layer--${mode}`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
      onContextMenu={(event) => event.preventDefault()}
      aria-hidden="true"
    >
      <div ref={anchorRef} className={`touch-anchor touch-anchor--${side}`} />
      <div ref={stickRef} className="stick" data-active="false">
        <div className="stick__base">
          <span className="stick__chevron stick__chevron--up" />
          <span className="stick__chevron stick__chevron--right" />
          <span className="stick__chevron stick__chevron--down" />
          <span className="stick__chevron stick__chevron--left" />
        </div>
        <div ref={knobRef} className="stick__knob" />
      </div>
      {showHint && <div className={`touch-hint touch-hint--${side}`}>{hint}</div>}
    </div>
  );
}
