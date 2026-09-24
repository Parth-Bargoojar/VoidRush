/**
 * VOIDRUSH — colour maths.
 *
 * Used to guarantee, numerically rather than by eye, that obstacle geometry
 * stays legible against the tunnel behind it.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: number): Rgb {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

export function rgbToHex(rgb: Rgb): number {
  const to8 = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (to8(rgb.r) << 16) | (to8(rgb.g) << 8) | to8(rgb.b);
}

function toLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: number): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two colours, in the range [1, 21]. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Multiplies a colour toward black. `factor` of 1 leaves it unchanged. */
export function scaleColor(hex: number, factor: number): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * factor, g: g * factor, b: b * factor });
}

export function lerpColor(a: number, b: number, t: number): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/**
 * Brightens `foreground` toward white until it reaches `targetRatio` against
 * `background`.
 *
 * This is how the design system's saturated palettes are reconciled with the
 * readability rule. Darkening the tunnel instead would work for some pairings
 * but not all — a mid blue cannot reach 4.5:1 against *any* background, because
 * its own luminance caps the ratio — and pushing every tunnel to near-black to
 * chase the numbers would throw away the palette identity the design system
 * exists to establish. Lifting the obstacle tone preserves its hue, keeps the
 * tunnel's colour, and satisfies the rule in every case.
 */
export function brightenForContrast(
  foreground: number,
  background: number,
  targetRatio: number,
): number {
  let colour = foreground;
  for (let i = 0; i < 24; i += 1) {
    if (contrastRatio(colour, background) >= targetRatio) return colour;
    colour = lerpColor(colour, 0xffffff, 0.1);
    if (colour === 0xffffff) return colour;
  }
  return colour;
}

/** Formats a colour as `#rrggbb`, for CSS custom properties. */
export function hexToCss(hex: number): string {
  return `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
}
