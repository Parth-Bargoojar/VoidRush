/**
 * VOIDRUSH — tilt (device orientation) steering constants.
 *
 * Every number the gyroscope pipeline uses lives here so the feel can be tuned
 * in one place. Angles are in degrees, times in milliseconds unless noted.
 *
 * The pipeline these feed, in order:
 *   DeviceOrientation → screen-frame roll/pitch → minus calibrated neutral
 *   → dead zone → sensitivity → response curve → smoothing → clamp to ±1
 */

import { frozen } from './frozen';

export const TILT = frozen({
  /** Tilt inside this band around neutral produces no movement. */
  DEAD_ZONE_DEFAULT: 2,
  DEAD_ZONE_MIN: 0,
  DEAD_ZONE_MAX: 8,

  /** Tilt beyond neutral that produces full deflection, at sensitivity 1. */
  MAX_TILT: 22,
  /**
   * Sensitivity divides MAX_TILT: at 2× full deflection arrives at 11°. The
   * effective maximum is never allowed closer than this to the dead zone, so
   * the curve always has room to rise.
   */
  MIN_RESPONSE_SPAN: 4,

  SENSITIVITY_DEFAULT: 1,
  SENSITIVITY_MIN: 0.5,
  SENSITIVITY_MAX: 2,

  /**
   * Output = normalised^EXPONENT. Above 1 gives fine control near neutral and
   * still reaches full deflection; 1.35 keeps small corrections precise without
   * making medium tilts feel sluggish.
   */
  RESPONSE_EXPONENT: 1.35,

  /**
   * Time constant of the low-pass applied in the game loop, in seconds. The
   * player already has its own 0.1 s damping, so this only needs to remove
   * sensor jitter; a larger value would add felt latency.
   */
  SMOOTHING_TAU: 0.035,

  /** No valid reading for this long marks the sensor lost. */
  SENSOR_TIMEOUT_MS: 500,
  /**
   * After listening starts, a device that has not produced one valid reading
   * within this long is treated as having no sensor (desktop browsers expose
   * the API with nothing behind it).
   */
  PROBE_TIMEOUT_MS: 1500,

  /** Calibration: short settle, then samples averaged across the countdown. */
  CALIBRATION_SETTLE_MS: 700,
  CALIBRATION_COUNT_STEP_MS: 350,
  CALIBRATION_COUNT_FROM: 3,
  CALIBRATION_READY_MS: 450,
  /** Fewer samples than this means the sensor is not really delivering. */
  CALIBRATION_MIN_SAMPLES: 5,
  /** Larger angular spread than this means the device was moving. */
  CALIBRATION_MAX_SPREAD: 7,
  /** Unsteady attempts retried before the average is accepted anyway. */
  CALIBRATION_RETRIES: 2,
});
