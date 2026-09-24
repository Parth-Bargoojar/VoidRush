/**
 * VOIDRUSH — the endless tunnel.
 *
 * A fixed ring of pooled segments. When a segment falls behind the player it is
 * re-seeded and moved to the far end with a fresh pattern index, so the tunnel
 * never repeats and never allocates after warm-up.
 *
 * The tunnel is decorative: its walls are not collidable. The player clamp box
 * is the boundary, which avoids deaths caused by wall ornamentation.
 */

import { WORLD } from '../config/GameConfig';
import type { DifficultyManager } from '../game/DifficultyManager';
import { TunnelProfile } from './TunnelProfile';
import { TunnelSegment } from './TunnelSegment';

export class Tunnel {
  readonly segments: TunnelSegment[] = [];
  /** [PRD 6] The tunnel's shape along the run; shared by every segment. */
  readonly profile: TunnelProfile;
  private seed = 1;
  private nextIndex = 0;
  /** Largest zeroDistance in play: the segment currently furthest ahead. */
  private farthestZeroDistance = 0;
  private recycles = 0;

  constructor(difficulty?: DifficultyManager) {
    this.profile = new TunnelProfile(difficulty);
    for (let i = 0; i < WORLD.SEGMENT_COUNT; i += 1) {
      this.segments.push(new TunnelSegment());
    }
  }

  /**
   * Rebuilds every segment from the start of the run. `menu` holds the tunnel
   * at its opening shape, for the background behind the main menu.
   */
  reset(seed: number, menu = false): void {
    this.seed = seed >>> 0;
    this.profile.reset(this.seed, menu);
    this.nextIndex = 0;
    this.recycles = 0;
    for (let i = 0; i < this.segments.length; i += 1) {
      // Segment 0 sits just in front of the camera; the rest stretch ahead.
      const zeroDistance = (i - 1) * WORLD.SEGMENT_LENGTH;
      this.segments[i]!.reseed(this.seed, this.nextIndex, zeroDistance, this.profile);
      this.nextIndex += 1;
      this.farthestZeroDistance = Math.max(this.farthestZeroDistance, zeroDistance);
    }
    this.farthestZeroDistance = (this.segments.length - 2) * WORLD.SEGMENT_LENGTH;
  }

  /** Recycles any segment that has passed entirely behind the player. */
  update(distance: number): void {
    for (const segment of this.segments) {
      if (segment.zAt(distance) - WORLD.SEGMENT_LENGTH > WORLD.DESPAWN_Z) {
        this.farthestZeroDistance += WORLD.SEGMENT_LENGTH;
        segment.reseed(this.seed, this.nextIndex, this.farthestZeroDistance, this.profile);
        this.nextIndex += 1;
        this.recycles += 1;
      }
    }
  }

  get recycleCount(): number {
    return this.recycles;
  }

  get segmentCount(): number {
    return this.segments.length;
  }
}
