/**
 * The procedural edge texture is built from maths alone, so its guarantees are
 * checked here in Node: a full-brightness rim, and a face never darker than
 * the interior the contrast test holds the obstacle palette to.
 */

import { describe, expect, it } from 'vitest';
import { ClampToEdgeWrapping } from 'three';
import { VISUAL } from '../src/config/VisualConfig';
import { createVoxelEdgeTexture } from '../src/rendering/Materials';

describe('voxel edge texture', () => {
  const texture = createVoxelEdgeTexture();
  const { data, width, height } = texture.image as { data: Uint8Array; width: number; height: number };
  const at = (x: number, y: number): number => data[(y * width + x) * 4]!;

  it('is 128 by 128 and clamps at the edges', () => {
    expect(width).toBe(128);
    expect(height).toBe(128);
    expect(texture.wrapS).toBe(ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(ClampToEdgeWrapping);
    expect(texture.generateMipmaps).toBe(true);
  });

  it('has a white rim and a darker face', () => {
    expect(at(0, 64)).toBe(255);
    expect(at(64, 3)).toBe(255);
    expect(at(40, 40)).toBeLessThan(255);
  });

  it('never drops below the readable interior', () => {
    const floor = Math.round(VISUAL.OBSTACLE_FACE_INTERIOR * 255);
    let min = 255;
    for (let i = 0; i < data.length; i += 4) min = Math.min(min, data[i]!);
    expect(min).toBe(floor);
  });

  it('is symmetric, so orientation on a face does not matter', () => {
    for (let y = 0; y < height; y += 7) {
      for (let x = 0; x < width; x += 7) {
        expect(at(x, y)).toBe(at(width - 1 - x, y));
        expect(at(x, y)).toBe(at(x, height - 1 - y));
      }
    }
  });
});
