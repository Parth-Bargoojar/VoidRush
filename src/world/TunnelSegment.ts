/**
 * VOIDRUSH — a single pooled tunnel segment.
 *
 * The segment holds only data. Its Z position is derived from the run's
 * accumulated distance, exactly as obstacles are, so nothing integrates and
 * nothing drifts.
 */

import { WORLD } from '../config/GameConfig';
import { generateSegmentPattern, hashPattern, type TunnelPattern } from './TunnelGenerator';
import type { TunnelProfile } from './TunnelProfile';

export class TunnelSegment {
  /** Monotonic pattern index. Re-seeded, never repeated, when recycled. */
  index = 0;
  /** Accumulated run distance at which this segment's origin sits at z = 0. */
  zeroDistance = 0;
  readonly pattern: TunnelPattern = [];

  reseed(seed: number, index: number, zeroDistance: number, profile?: TunnelProfile): void {
    this.index = index;
    this.zeroDistance = zeroDistance;
    generateSegmentPattern(seed, index, this.pattern, profile, zeroDistance);
  }

  /** Current Z of the segment origin, given the run's accumulated distance. */
  zAt(distance: number): number {
    return distance - this.zeroDistance;
  }

  get patternHash(): number {
    return hashPattern(this.pattern);
  }

  /** The far end of the segment, used to decide when to recycle. */
  farZ(distance: number): number {
    return this.zAt(distance) - WORLD.SEGMENT_LENGTH;
  }
}
