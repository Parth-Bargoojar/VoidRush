/**
 * VOIDRUSH — shared geometry.
 *
 * The entire world is built from one unit cube. Every block, arm, slab and rim
 * is that cube scaled by an instance matrix, which keeps the geometry count at
 * one and lets whole obstacles render in a single draw call.
 */

import { BoxGeometry } from 'three';

/** The unit cube every solid in the game is an instance of. */
export const UNIT_BOX = new BoxGeometry(1, 1, 1);

export function disposeGeometries(): void {
  UNIT_BOX.dispose();
}
