/**
 * Readability is checked numerically, not by eye: obstacle geometry must clear
 * the contrast threshold against the tunnel behind it in every palette.
 */

import { describe, expect, it } from 'vitest';
import { PALETTES, TIER_PALETTE, VISUAL } from '../src/config/VisualConfig';
import { RESOLVED_PALETTES, blendPalettes, paletteForTier } from '../src/rendering/Palettes';
import {
  brightenForContrast,
  contrastRatio,
  hexToCss,
  lerpColor,
  relativeLuminance,
} from '../src/utils/Color';

describe('colour maths', () => {
  it('computes known WCAG luminances', () => {
    expect(relativeLuminance(0x000000)).toBeCloseTo(0, 6);
    expect(relativeLuminance(0xffffff)).toBeCloseTo(1, 6);
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 1);
    expect(contrastRatio(0x123456, 0x123456)).toBeCloseTo(1, 6);
  });

  it('formats CSS hex strings', () => {
    expect(hexToCss(0x080a0f)).toBe('#080a0f');
    expect(hexToCss(0xffffff)).toBe('#ffffff');
  });

  it('interpolates between colours', () => {
    expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it('lifts a foreground whose own luminance caps the ratio', () => {
    // A mid blue cannot reach 4.5:1 against black, let alone anything lighter:
    // darkening the background could never fix this pairing.
    expect(contrastRatio(0x3155e7, 0x000000)).toBeLessThan(4.5);
    const lifted = brightenForContrast(0x3155e7, 0x000000, 4.5);
    expect(contrastRatio(lifted, 0x000000)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a foreground alone when it already clears the bar', () => {
    expect(brightenForContrast(0xffffff, 0x000000, 4.5)).toBe(0xffffff);
  });
});

describe('resolved palettes', () => {
  it('provides one resolved palette per design palette', () => {
    expect(RESOLVED_PALETTES.length).toBe(PALETTES.length);
    expect(RESOLVED_PALETTES.length).toBe(4);
  });

  it('clears the obstacle contrast threshold in every palette', () => {
    for (const palette of RESOLVED_PALETTES) {
      const primary = contrastRatio(palette.obstaclePrimary, palette.tunnelBase);
      const secondary = contrastRatio(palette.obstacleSecondary, palette.tunnelBase);
      const accent = contrastRatio(palette.obstacleAccent, palette.tunnelBase);
      expect(primary, `${palette.name} primary`).toBeGreaterThanOrEqual(
        VISUAL.MIN_OBSTACLE_CONTRAST,
      );
      expect(secondary, `${palette.name} secondary`).toBeGreaterThanOrEqual(
        VISUAL.MIN_OBSTACLE_CONTRAST,
      );
      expect(accent, `${palette.name} accent`).toBeGreaterThanOrEqual(
        VISUAL.MIN_OBSTACLE_CONTRAST,
      );
    }
  });

  it('keeps obstacle faces readable under the edge texture interior', () => {
    // The camera-facing face renders at OBSTACLE_FACE_INTERIOR of the instance
    // colour (a linear factor, so luminance scales by it directly).
    const k = VISUAL.OBSTACLE_FACE_INTERIOR;
    for (const palette of RESOLVED_PALETTES) {
      const base = relativeLuminance(palette.tunnelBase);
      for (const tone of [
        palette.obstaclePrimary,
        palette.obstacleSecondary,
        palette.obstacleAccent,
      ]) {
        const face = k * relativeLuminance(tone);
        expect((face + 0.05) / (base + 0.05), `${palette.name} ${hexToCss(tone)}`).toBeGreaterThanOrEqual(
          VISUAL.MIN_OBSTACLE_CONTRAST,
        );
      }
    }
  });

  it('keeps the background no brighter than the tunnel', () => {
    for (const palette of RESOLVED_PALETTES) {
      expect(relativeLuminance(palette.background)).toBeLessThanOrEqual(
        relativeLuminance(palette.tunnelBase) + 1e-9,
      );
    }
  });

  it('maps each difficulty phase onto a distinct palette', () => {
    const ids = new Set(
      (['INTRO', 'BUILD', 'INTENSE', 'OVERLOAD'] as const).map((tier) => paletteForTier(tier).id),
    );
    expect(ids.size).toBe(4);
    expect(paletteForTier('INTRO').id).toBe('A');
    expect(TIER_PALETTE.OVERLOAD).toBe(3);
  });

  it('blends palettes without losing readability at the endpoints', () => {
    const from = RESOLVED_PALETTES[0]!;
    const to = RESOLVED_PALETTES[1]!;
    expect(blendPalettes(from, to, 0)).toBe(from);
    expect(blendPalettes(from, to, 1)).toBe(to);
    const middle = blendPalettes(from, to, 0.5);
    expect(middle.tunnelBase).not.toBe(from.tunnelBase);
    expect(middle.tunnelBase).not.toBe(to.tunnelBase);
  });

  it('reports the contrast it actually measured', () => {
    for (const palette of RESOLVED_PALETTES) {
      expect(palette.measuredContrast).toBeCloseTo(
        contrastRatio(palette.obstaclePrimary, palette.tunnelBase),
        6,
      );
    }
  });
});
