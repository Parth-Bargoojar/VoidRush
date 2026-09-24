/**
 * [PRD 6 / 16 / 17] Procedural tunnel variation: the tunnel changes width,
 * height, cross-section, roll, wall pattern and light placement — and none of
 * it can ever reach into the box the player flies in, or reveal a gap around an
 * obstacle that the player could not actually use.
 */

import { describe, expect, it } from 'vitest';
import { SPEED, WORLD } from '../src/config/GameConfig';
import { COLLISION } from '../src/config/GameConfig';
import { OBSTACLE_FRAME_OUTER, TUNNEL } from '../src/config/TunnelConfig';
import { DifficultyManager, createDifficultyState } from '../src/game/DifficultyManager';
import { ALL_OBSTACLE_TYPES, ObstacleFactory } from '../src/obstacles/ObstacleFactory';
import { CombinationObstacle } from '../src/obstacles/CombinationObstacle';
import type { BaseObstacle } from '../src/obstacles/Obstacle';
import { Rng } from '../src/utils/Random';
import type { Opening } from '../src/types';
import {
  BLOCKS_PER_SEGMENT,
  blockSeparation,
  generateSegmentPattern,
  type TunnelPattern,
} from '../src/world/TunnelGenerator';
import {
  SECTION_LENGTH,
  TunnelProfile,
  allowedRoll,
  createTunnelShape,
} from '../src/world/TunnelProfile';

const REACHABLE = WORLD.PLAYER_CLAMP + WORLD.PLAYER_RADIUS;
const difficulty = new DifficultyManager();

/** Keyframe index at which the run has been going `seconds`. */
function keyframeAt(seconds: number): number {
  return Math.floor(difficulty.distanceAt(seconds) / SECTION_LENGTH);
}

describe('tunnel fairness', () => {
  it('never places a block inside the reachable box, at any width, roll or roughness', () => {
    const pattern: TunnelPattern = [];
    let worst = Number.POSITIVE_INFINITY;
    let blocks = 0;
    for (let seed = 1; seed <= 25; seed += 1) {
      const profile = new TunnelProfile();
      profile.reset(seed * 104729);
      // Every 3rd segment out to ~6 minutes at top speed covers every phase.
      for (let index = 0; index < 900; index += 3) {
        generateSegmentPattern(seed * 104729, index, pattern, profile);
        for (const block of pattern) {
          worst = Math.min(worst, blockSeparation(block, REACHABLE));
        }
        blocks += pattern.length;
      }
    }
    expect(blocks).toBeGreaterThan(1_000_000);
    // Separating-axis distance, not a centre-point test: rotated and chamfered
    // blocks are checked against their true footprint.
    expect(worst).toBeGreaterThanOrEqual(-1e-9);
  });

  it('never fills a segment to the instance-buffer capacity', () => {
    const pattern: TunnelPattern = [];
    let most = 0;
    for (let seed = 1; seed <= 15; seed += 1) {
      const profile = new TunnelProfile();
      profile.reset(seed);
      for (let index = 0; index < 900; index += 1) {
        generateSegmentPattern(seed, index, pattern, profile);
        most = Math.max(most, pattern.length);
      }
    }
    // Hitting the cap would silently drop blocks and open holes in the wall.
    expect(most).toBeLessThan(BLOCKS_PER_SEGMENT);
  });

  it('bounds roll by what each cross-section can afford', () => {
    expect(allowedRoll(TUNNEL.SAFE_HALF)).toBe(0);
    expect(allowedRoll(TUNNEL.SAFE_HALF * 0.9)).toBe(0);
    expect(allowedRoll(TUNNEL.SAFE_HALF * 2)).toBeCloseTo(Math.PI / 4);
    // A wider inner face affords more roll, never less.
    expect(allowedRoll(14)).toBeGreaterThan(allowedRoll(12.5));
  });

  it('keeps spinning-obstacle frames beyond near-miss range of the reachable box', () => {
    expect(TUNNEL.SPIN_FRAME_INNER - REACHABLE).toBeGreaterThan(COLLISION.NEAR_MISS_CLOSE);
  });
});

describe('tunnel variation', () => {
  it('keeps the large rectangular tunnel through INTRO and BUILD', () => {
    const profile = new TunnelProfile();
    for (let seed = 1; seed <= 10; seed += 1) {
      profile.reset(seed);
      const last = keyframeAt(59);
      for (let k = 0; k <= last; k += 1) {
        const keyframe = profile.keyframe(k);
        expect(keyframe.crossSection).toBe('RECT');
        expect(keyframe.roll).toBe(0);
        expect(keyframe.halfWidth).toBe(keyframe.halfHeight);
        // Larger than the narrowest the tunnel will ever become.
        expect(keyframe.halfWidth).toBeGreaterThan(TUNNEL.WIDTH_END);
      }
    }
  });

  it('introduces every cross-section, both size variants and roll from INTENSE on', () => {
    const profile = new TunnelProfile();
    const sections = new Set<string>();
    const widths = new Set<number>();
    const patterns = new Set<string>();
    let rolled = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      profile.reset(seed);
      for (let k = keyframeAt(61); k < keyframeAt(300); k += 1) {
        const keyframe = profile.keyframe(k);
        sections.add(keyframe.crossSection);
        widths.add(Math.round(keyframe.halfWidth * 10) / 10);
        patterns.add(keyframe.pattern);
        if (Math.abs(keyframe.roll) > 1e-3) rolled += 1;
      }
    }
    expect([...sections].sort()).toEqual(['IRREGULAR', 'POLYGONAL', 'RECT']);
    expect([...patterns].sort()).toEqual(['RIBS', 'RINGS', 'SCATTER', 'STRIPES']);
    expect(widths.size).toBeGreaterThanOrEqual(3);
    expect(rolled).toBeGreaterThan(0);
  });

  it('narrows the tunnel as difficulty rises', () => {
    const state = createDifficultyState();
    let previous = Number.POSITIVE_INFINITY;
    for (let t = 0; t <= 200; t += 5) {
      difficulty.stateAt(t, state);
      expect(state.tunnelWidth).toBeLessThanOrEqual(previous + 1e-12);
      previous = state.tunnelWidth;
    }
    expect(difficulty.stateAt(0, state).tunnelWidth).toBe(TUNNEL.WIDTH_START);
    expect(difficulty.stateAt(200, state).tunnelWidth).toBeCloseTo(TUNNEL.WIDTH_END);
  });

  it('changes progressively rather than jumping', () => {
    const profile = new TunnelProfile();
    profile.reset(77);
    const a = createTunnelShape();
    const b = createTunnelShape();
    const stride = 1;
    let biggestStep = 0;
    let biggestRoll = 0;
    for (let d = 0; d < SPEED.MAX * 300; d += stride) {
      profile.sample(d, a);
      profile.sample(d + stride, b);
      biggestStep = Math.max(
        biggestStep,
        Math.abs(b.halfWidth - a.halfWidth),
        Math.abs(b.halfHeight - a.halfHeight),
      );
      biggestRoll = Math.max(biggestRoll, Math.abs(b.roll - a.roll));
    }
    // One world unit of travel never moves a wall more than a few centimetres.
    expect(biggestStep).toBeLessThan(0.1);
    expect(biggestRoll).toBeLessThan((1 * Math.PI) / 180);
  });

  it('keeps the menu tunnel at its calm opening shape', () => {
    const profile = new TunnelProfile();
    profile.reset(5, true);
    for (let k = 0; k < 400; k += 1) {
      const keyframe = profile.keyframe(k);
      expect(keyframe.crossSection).toBe('RECT');
      expect(keyframe.roll).toBe(0);
      expect(keyframe.halfWidth).toBe(TUNNEL.WIDTH_START);
    }
  });

  it('is reproducible from the seed', () => {
    const a: TunnelPattern = [];
    const b: TunnelPattern = [];
    const pa = new TunnelProfile();
    const pb = new TunnelProfile();
    pa.reset(2026);
    pb.reset(2026);
    for (let index = 0; index < 400; index += 7) {
      generateSegmentPattern(2026, index, a, pa);
      generateSegmentPattern(2026, index, b, pb);
      expect(b).toEqual(a);
    }
  });
});

describe('obstacles meet the widest tunnel wall', () => {
  /**
   * A grid over the whole band between the reachable box (plus near-miss
   * range) and the frame's outer edge. Any rolled or widened wall section can
   * put its inner face anywhere in this band, so all of it must be solid.
   */
  const probes: Array<[number, number]> = [];
  const inner = TUNNEL.SPIN_FRAME_INNER + 0.05;
  const outer = OBSTACLE_FRAME_OUTER - 0.3;
  for (let x = -outer; x <= outer; x += 1.9) {
    for (let y = -outer; y <= outer; y += 1.9) {
      const ring = Math.max(Math.abs(x), Math.abs(y));
      if (ring >= inner && ring <= outer) probes.push([x, y]);
    }
  }

  function insideOpening(opening: Opening, px: number, py: number): boolean {
    if (opening.shape === 'circle') {
      return Math.hypot(px - opening.cx, py - opening.cy) <= opening.hx;
    }
    return Math.abs(px - opening.cx) <= opening.hx && Math.abs(py - opening.cy) <= opening.hy;
  }

  function bodies(obstacle: BaseObstacle): BaseObstacle[] {
    return obstacle instanceof CombinationObstacle
      ? obstacle.layers.map((layer) => layer.obstacle)
      : [obstacle];
  }

  it('leaves no open air between any obstacle and the widest wall', () => {
    const factory = new ObstacleFactory();
    expect(probes.length).toBeGreaterThan(200);
    for (const type of ALL_OBSTACLE_TYPES) {
      for (let seed = 1; seed <= 3; seed += 1) {
        const obstacle = factory.acquire(type);
        obstacle.spawn(
          {
            id: 1,
            z: 0,
            tCross: 70,
            targetX: 3,
            targetY: -2,
            openingHalf: 3,
            difficulty: 0.8,
            speed: SPEED.MAX,
          },
          new Rng(seed),
        );
        for (const body of bodies(obstacle)) {
          // Moving and spinning bodies are checked across a full period's worth
          // of sample times, not only at the crossing.
          for (let t = 60; t <= 80; t += 2.3) {
            const openings = body.getOpenings(t);
            for (const [px, py] of probes) {
              // The body's own opening is the one gap it is allowed. A sliding
              // gate carries it outward away from the crossing time; that is
              // the planned passage moving, not open air beside the obstacle.
              if (openings.some((o) => insideOpening(o, px, py))) continue;
              const inside = body.distanceToSolid(px, py, 0, t, 0);
              expect(inside, `${type} open at (${px}, ${py}) t=${t.toFixed(2)}`).toBeLessThan(0);
            }
          }
        }
        factory.release(obstacle);
      }
    }
  });

  it('sizes the frame from the tunnel limits rather than a guess', () => {
    const widestReach =
      TUNNEL.HALF_CAP * (Math.cos(TUNNEL.ROLL_MAX) + Math.sin(TUNNEL.ROLL_MAX));
    expect(OBSTACLE_FRAME_OUTER).toBeGreaterThan(widestReach);
  });
});
