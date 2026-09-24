/**
 * VOIDRUSH — shared materials.
 *
 * Three materials cover the whole game. They are shared across every mesh, so
 * a run never creates a material at play time.
 *
 *  - Tunnel blocks are lit, matte and slightly rough, so the voxel walls read
 *    as architecture and give the tunnel depth.
 *  - Tunnel accents and obstacles are unlit: at full brightness they cross the
 *    bloom threshold and glow, which is what makes obstacles pop out of the
 *    environment at speed instead of being shaded into it.
 */

import { MeshBasicMaterial, MeshStandardMaterial } from 'three';

export interface MaterialSet {
  readonly tunnel: MeshStandardMaterial;
  readonly tunnelAccent: MeshBasicMaterial;
  readonly obstacle: MeshBasicMaterial;
}

/** [PRD 24] Tunnel blocks are matte, roughness around 0.7-0.9. */
const tunnel = new MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.05,
  fog: true,
});

const tunnelAccent = new MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });

const obstacle = new MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });

export const MATERIALS: MaterialSet = { tunnel, tunnelAccent, obstacle };

/** Distinct material instances in play. Asserted against the budget. */
export const MATERIAL_COUNT = 3;

export function disposeMaterials(): void {
  tunnel.dispose();
  tunnelAccent.dispose();
  obstacle.dispose();
}
