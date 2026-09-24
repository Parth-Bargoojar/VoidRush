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
 *
 * Accents and obstacles share one procedural edge texture: a full-brightness
 * rim around a slightly darker face. Instance colour multiplies it, so the rim
 * becomes a saturated neon outline that blooms while the face stays solid.
 * Obstacles also get a cheap normal-based face shade, since being unlit they
 * would otherwise render every face identically and lose their 3D shape.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  UnsignedByteType,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { VISUAL } from '../config/VisualConfig';

export interface MaterialSet {
  readonly tunnel: MeshStandardMaterial;
  readonly tunnelAccent: MeshBasicMaterial;
  readonly obstacle: MeshBasicMaterial;
}

const EDGE_TEXTURE_SIZE = 128;
/** Full-brightness rim width, in texels. */
const EDGE_RIM = 7;
/** Texels over which the rim fades into the face. */
const EDGE_FALLOFF = 5;
/** Distance from the edge of the inner bezel line, in texels. */
const EDGE_BEZEL = 17;
/** Spacing of the faint grid across the face, in texels. */
const EDGE_GRID = 32;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Antialiased line of roughly one and a half texels centred on `distance` 0. */
function line(distance: number): number {
  return 1 - smoothstep(0.25, 1.25, Math.abs(distance));
}

/**
 * Builds the voxel edge texture: a white rim with a soft inner falloff, an
 * inset bezel line and a faint grid, over a face at OBSTACLE_FACE_INTERIOR.
 * Nothing is darker than that interior, which is the value the contrast test
 * holds the obstacle palette to. The data is linear (no colour space), so the
 * factors multiply the instance colour exactly.
 */
export function createVoxelEdgeTexture(): DataTexture {
  const size = EDGE_TEXTURE_SIZE;
  const interior = VISUAL.OBSTACLE_FACE_INTERIOR;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const edge = Math.min(px, size - px, py, size - py);

      const rim = 1 - smoothstep(EDGE_RIM, EDGE_RIM + EDGE_FALLOFF, edge);
      const bezel = line(edge - EDGE_BEZEL);
      // Grid lines stop short of the bezel so the frame reads as one border.
      const gridX = line(((px + EDGE_GRID / 2) % EDGE_GRID) - EDGE_GRID / 2);
      const gridY = line(((py + EDGE_GRID / 2) % EDGE_GRID) - EDGE_GRID / 2);
      const grid = edge > EDGE_BEZEL + 2 ? Math.max(gridX, gridY) : 0;

      let value = interior;
      value = Math.max(value, interior + (0.95 - interior) * bezel);
      value = Math.max(value, interior + (0.91 - interior) * grid);
      value = interior + (1 - interior) * rim + (value - interior) * (1 - rim);

      const byte = Math.round(Math.min(1, value) * 255);
      const i = (y * size + x) * 4;
      data[i] = byte;
      data[i + 1] = byte;
      data[i + 2] = byte;
      data[i + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  // Side faces are seen at grazing angles at speed; a little anisotropy keeps
  // their rims from smearing into the face. Clamped to what the GPU supports.
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const edgeTexture = createVoxelEdgeTexture();

/** Formats a number as a GLSL float literal. */
function glslFloat(value: number): string {
  return value.toFixed(4);
}

/**
 * Normal-based face shading for the unlit obstacle material. The camera-facing
 * face stays at full brightness; side faces drop to OBSTACLE_SIDE_SHADE, with
 * faces pointing up in view space a little lighter and those pointing down a
 * little darker, so rotation stays legible.
 *
 * Obstacle instance matrices are translation and scale only, so the instance
 * matrix keeps a box normal on its axis and a normalise is enough; no inverse
 * transpose is needed.
 */
function applyFaceShading(shader: WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFaceShade;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec3 faceNormal = normal;
#ifdef USE_INSTANCING
faceNormal = mat3( instanceMatrix ) * faceNormal;
#endif
faceNormal = normalize( normalMatrix * faceNormal );
vFaceShade = clamp(
  mix( ${glslFloat(VISUAL.OBSTACLE_SIDE_SHADE)}, 1.0, max( faceNormal.z, 0.0 ) ) +
    ${glslFloat(VISUAL.OBSTACLE_TOP_LIFT)} * faceNormal.y,
  0.0,
  1.0
);`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFaceShade;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vFaceShade;');
}

/** [PRD 24] Tunnel blocks are matte, roughness around 0.7-0.9. */
const tunnel = new MeshStandardMaterial({
  color: 0xffffff,
  // A touch of metalness catches the moving point lights as a brushed sheen.
  roughness: 0.75,
  metalness: 0.12,
  fog: true,
});

const tunnelAccent = new MeshBasicMaterial({
  color: 0xffffff,
  map: edgeTexture,
  fog: true,
  toneMapped: false,
});

const obstacle = new MeshBasicMaterial({
  color: 0xffffff,
  map: edgeTexture,
  fog: true,
  toneMapped: false,
});
obstacle.onBeforeCompile = applyFaceShading;

export const MATERIALS: MaterialSet = { tunnel, tunnelAccent, obstacle };

/** Distinct material instances in play. Asserted against the budget. */
export const MATERIAL_COUNT = 3;

export function disposeMaterials(): void {
  tunnel.dispose();
  tunnelAccent.dispose();
  obstacle.dispose();
  edgeTexture.dispose();
}
