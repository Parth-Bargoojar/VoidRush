/**
 * VOIDRUSH — the on-screen joystick's geometry, kept free of the DOM so it can
 * be tested directly. TouchControls owns the pointer events and the drawing.
 */

import type { JoystickSide } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface StickReading {
  /** Steering axis, each component in [-1, 1], +Y up. */
  axisX: number;
  axisY: number;
  /** Knob offset from the base centre in CSS pixels, clamped to the rim. */
  knobX: number;
  knobY: number;
}

/** Base radius in CSS pixels at size 1. */
export const BASE_RADIUS = 60;
/** Fraction of the radius the stick ignores, so a resting thumb does not drift. */
export const DEAD_ZONE = 0.12;
/**
 * Share of the screen width, from the stick's edge, that belongs to the steering
 * thumb. The other side is left alone for the other hand and the pause button.
 */
export const ZONE_FRACTION = 0.5;
/** In FIXED mode, a touch must start within this many radii of the stick. */
export const FIXED_GRAB_RADII = 2.2;
/** Keeps a spawned stick clear of the screen edge. */
export const EDGE_MARGIN = 8;

/** The stick's radius: scaled by the setting, never over a fifth of the short side. */
export function stickRadius(size: number, width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(40, Math.min(BASE_RADIUS * size, shortSide * 0.2));
}

/** Whether a touch at `x` lands on the steering thumb's side of the screen. */
export function inSteeringZone(x: number, side: JoystickSide, width: number): boolean {
  return side === 'left' ? x < width * ZONE_FRACTION : x >= width * (1 - ZONE_FRACTION);
}

/**
 * Where a DYNAMIC stick appears for a touch: right under the thumb, nudged in
 * only as far as needed to keep the whole base on screen.
 */
export function spawnCentre(point: Point, radius: number, width: number, height: number): Point {
  const inset = radius + EDGE_MARGIN;
  return {
    x: Math.min(Math.max(point.x, inset), Math.max(inset, width - inset)),
    y: Math.min(Math.max(point.y, inset), Math.max(inset, height - inset)),
  };
}

/**
 * Converts the thumb's offset from the stick centre into a steering axis.
 *
 * The base never moves during a drag: past the rim the knob pins to the edge
 * and the output holds at full deflection in the thumb's direction. Inside the
 * dead zone the output is zero, and beyond it the magnitude is rescaled so it
 * still rises smoothly from zero to one.
 */
export function readStick(dx: number, dy: number, radius: number): StickReading {
  const distance = Math.hypot(dx, dy);
  if (!(distance > 0) || !(radius > 0)) return { axisX: 0, axisY: 0, knobX: 0, knobY: 0 };

  const clamped = Math.min(distance, radius);
  const unitX = dx / distance;
  const unitY = dy / distance;
  const knobX = unitX * clamped;
  const knobY = unitY * clamped;

  const magnitude = clamped / radius;
  if (magnitude < DEAD_ZONE) return { axisX: 0, axisY: 0, knobX, knobY };

  const scaled = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE);
  // Screen Y grows downwards; steering Y is up. `0 -` keeps a level stick at +0.
  return { axisX: unitX * scaled, axisY: 0 - unitY * scaled, knobX, knobY };
}
