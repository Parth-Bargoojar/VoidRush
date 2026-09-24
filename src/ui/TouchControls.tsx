/**
 * The on-screen joystick, built for a phone held in landscape.
 *
 * DYNAMIC (the default) is the layout most mobile action games settle on. The
 * stick rests as a ghost in the lower corner to show where the thumb goes. A
 * touch anywhere on that side of the screen places the base right under the
 * thumb, so every drag starts from centre with no jump. The base then stays
 * where it was placed for the whole drag: it never slides after the thumb, and
 * past the rim the knob pins to the edge at full deflection. On release it
 * glides back to its corner. FIXED keeps the base in the corner for players who
 * want a physical anchor; a drag must start on or near the stick.
 *
 * The other half of the screen is left alone, so the second thumb can rest or
 * reach the pause button without taking over the stick.
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
import {
  FIXED_GRAB_RADII,
  inSteeringZone,
  readStick,
  spawnCentre,
  stickRadius,
  type Point,
} from './joystick';

interface TouchControlsProps {
  mode: JoystickMode;
  side: JoystickSide;
  /** Radius multiplier from settings. */
  size: number;
  onAxis: (x: number, y: number) => void;
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

  const radius = useCallback(
    (): number => stickRadius(size, window.innerWidth, window.innerHeight),
    [size],
  );

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
    layerRef.current?.style.setProperty('--stick-radius', `${radius()}px`);
    centre.current = restPoint();
    place(centre.current, 0, 0, false);
  }, [place, radius, restPoint]);

  // Park the stick at its resting corner, and again whenever the screen changes.
  // A phone's toolbar sliding away fires resize mid-drag; the stick must not
  // jump out from under the thumb, so it re-parks on release instead.
  useEffect(() => {
    rest();
    const onResize = (): void => {
      if (pointerId.current === null) rest();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [rest]);

  // Leaving the screen (pause, crash, rotation) must never leave the ship steering.
  useEffect(() => () => axisRef.current(0, 0), []);

  const track = (x: number, y: number): void => {
    const reading = readStick(x - centre.current.x, y - centre.current.y, radius());
    onAxis(reading.axisX, reading.axisY);
    place(centre.current, reading.knobX, reading.knobY, true);
  };

  const handleDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (pointerId.current !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const point = { x: event.clientX, y: event.clientY };
    // A touch on the far side belongs to the other thumb; it never claims the stick.
    if (!inSteeringZone(point.x, side, width)) return;

    const r = radius();
    if (mode === 'fixed') {
      const home = restPoint();
      if (Math.hypot(point.x - home.x, point.y - home.y) > r * FIXED_GRAB_RADII) return;
      centre.current = home;
    } else {
      centre.current = spawnCentre(point, r, width, height);
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
    mode === 'dynamic' ? `Touch the ${side} side to steer` : 'Drag the stick to steer';

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
