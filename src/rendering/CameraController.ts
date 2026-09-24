/**
 * VOIDRUSH — camera feel.
 *
 * The camera never leaves the Z axis: it sits at the player's (x, y) and looks
 * straight down -Z. Everything here is presentation — inertial lag, roll, a
 * speed-driven FOV and impact shake — and none of it feeds back into the
 * simulation, so how the camera behaves can never change whether a run is fair.
 */

import type { PerspectiveCamera } from 'three';
import { CAMERA, MOVEMENT, SPEED } from '../config/GameConfig';
import { clamp, damp } from '../utils/MathUtils';
import { mulberry32 } from '../utils/Random';
import type { Player } from '../types';

/**
 * Portrait screens. The FOV setting is vertical, so on a tall phone the same
 * number shows a narrow slit of the tunnel's width. Below a square aspect the
 * vertical FOV is widened by aspect^-PORTRAIT_FOV_EXPONENT — enough to keep
 * the gaps on either side in view without the fisheye a full correction gives.
 */
const PORTRAIT_FOV_EXPONENT = 0.5;
const PORTRAIT_FOV_CAP = 110;
const DEG_TO_RAD = Math.PI / 180;

/** The vertical FOV that gives a portrait viewport a usable horizontal view. */
export function aspectCorrectedFov(fov: number, aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return fov;
  const half = Math.tan((fov * DEG_TO_RAD) / 2) / Math.pow(aspect, PORTRAIT_FOV_EXPONENT);
  return Math.min(PORTRAIT_FOV_CAP, (2 * Math.atan(half)) / DEG_TO_RAD);
}

export class CameraController {
  private readonly camera: PerspectiveCamera;
  private readonly noise = mulberry32(0x5eed);

  private lagX = 0;
  private lagY = 0;
  private roll = 0;
  private fov: number;
  private shake = 0;
  private shakeScale = CAMERA.SHAKE_DEFAULT;
  private baseFov = CAMERA.FOV_BASE;
  private aspect = 16 / 9;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.fov = CAMERA.FOV_BASE;
  }

  /** [Design] The camera-shake setting scales impact shake but never gameplay. */
  setShakeScale(value: number): void {
    this.shakeScale = clamp(value, 0, 1);
  }

  setBaseFov(value: number): void {
    this.baseFov = clamp(value, CAMERA.FOV_MIN, CAMERA.FOV_MAX);
  }

  /** Called on resize so portrait screens can widen the projection. */
  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.fov = aspectCorrectedFov(this.fov, this.aspect);
    this.camera.updateProjectionMatrix();
  }

  /** Adds an impulse. Shake is only ever triggered by events, never sustained. */
  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount * this.shakeScale);
  }

  reset(player: Player): void {
    this.lagX = player.x;
    this.lagY = player.y;
    this.roll = 0;
    this.shake = 0;
    this.fov = this.baseFov;
  }

  /**
   * Advances the camera by `dt` seconds toward the player's state. Called once
   * per rendered frame rather than per simulation step, because it is purely
   * visual.
   */
  update(player: Player, speed: number, dt: number): void {
    this.lagX = damp(this.lagX, player.x, CAMERA.POSITION_LAG_TAU, dt);
    this.lagY = damp(this.lagY, player.y, CAMERA.POSITION_LAG_TAU, dt);

    // [PRD 28] Roll follows lateral velocity, to a maximum of about 5 degrees.
    const targetRoll = -CAMERA.MAX_ROLL * clamp(player.vx / MOVEMENT.MAX_LATERAL_SPEED, -1, 1);
    this.roll = damp(this.roll, targetRoll, CAMERA.ROLL_TAU, dt);

    // [PRD 27] FOV rises with speed and interpolates smoothly; no abrupt jumps.
    const speedFraction = clamp((speed - SPEED.START) / (SPEED.MAX - SPEED.START), 0, 1);
    const targetFov = clamp(
      this.baseFov + CAMERA.FOV_SPEED_GAIN * speedFraction,
      CAMERA.FOV_MIN,
      CAMERA.FOV_MAX,
    );
    this.fov = damp(this.fov, targetFov, CAMERA.FOV_SMOOTH_TAU, dt);

    this.shake = damp(this.shake, 0, CAMERA.SHAKE_DECAY_TAU, dt);
    const jitter = this.shake * this.shake * CAMERA.SHAKE_AMPLITUDE;

    this.camera.position.set(
      this.lagX + (this.noise() - 0.5) * jitter,
      this.lagY + (this.noise() - 0.5) * jitter,
      0,
    );
    this.camera.rotation.set(0, 0, this.roll + (this.noise() - 0.5) * jitter * 0.02);

    const projected = aspectCorrectedFov(this.fov, this.aspect);
    if (Math.abs(this.camera.fov - projected) > 1e-4) {
      this.camera.fov = projected;
      this.camera.updateProjectionMatrix();
    }
  }

  get currentFov(): number {
    return this.fov;
  }

  get currentShake(): number {
    return this.shake;
  }
}
