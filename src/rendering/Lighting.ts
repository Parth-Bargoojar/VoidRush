/**
 * VOIDRUSH — lighting.
 *
 * [PRD 25] Ambient fill, one directional key and a small number of local
 * coloured lights. Deliberately few: obstacles are unlit and emissive, so
 * lighting exists to give the tunnel depth rather than to illuminate gameplay.
 * No obstacle ever gets its own light.
 */

import { AmbientLight, Color, DirectionalLight, Group, HemisphereLight, PointLight } from 'three';
import { VISUAL } from '../config/VisualConfig';
import { WORLD } from '../config/GameConfig';
import { TUNNEL } from '../config/TunnelConfig';
import type { TunnelShape } from '../world/TunnelProfile';
import type { ResolvedPalette } from './Palettes';

/** Depths, ahead of the camera, at which the two local lights ride. */
export const NEAR_LIGHT_DEPTH = WORLD.SEGMENT_LENGTH * 0.5;
export const FAR_LIGHT_DEPTH = WORLD.SEGMENT_LENGTH * 2.5;

export class Lighting {
  readonly group = new Group();
  private readonly ambient: AmbientLight;
  private readonly hemisphere: HemisphereLight;
  private readonly key: DirectionalLight;
  private readonly near: PointLight;
  private readonly far: PointLight;

  constructor() {
    this.ambient = new AmbientLight(0xffffff, VISUAL.AMBIENT_INTENSITY);
    this.hemisphere = new HemisphereLight(0xffffff, 0x000000, VISUAL.HEMISPHERE_INTENSITY);
    this.key = new DirectionalLight(0xffffff, VISUAL.KEY_INTENSITY);
    this.key.position.set(0.4, 1, 0.6);

    // Two point lights ride ahead of the camera to pick out tunnel depth.
    this.near = new PointLight(
      0xffffff,
      VISUAL.POINT_INTENSITY,
      VISUAL.POINT_DISTANCE,
      VISUAL.POINT_DECAY,
    );
    this.near.position.set(0, 0, -NEAR_LIGHT_DEPTH);
    this.far = new PointLight(
      0xffffff,
      VISUAL.POINT_INTENSITY * 0.7,
      VISUAL.POINT_DISTANCE * 1.6,
      VISUAL.POINT_DECAY,
    );
    this.far.position.set(0, 0, -FAR_LIGHT_DEPTH);

    this.group.add(this.ambient, this.hemisphere, this.key, this.near, this.far);
  }

  applyPalette(palette: ResolvedPalette): void {
    const accent = new Color(palette.tunnelAccent);
    this.near.color.copy(accent);
    this.far.color.copy(accent);
    this.hemisphere.color.copy(accent);
    this.hemisphere.groundColor.set(palette.background);
  }

  /**
   * [PRD 6] Moves the local lights to the placement the tunnel profile asks
   * for at their depth — central, overhead, underfoot or on a wall — rolled
   * with the cross-section. The profile eases between keyframes, so the
   * lights glide rather than jump.
   */
  placeLights(near: TunnelShape, far: TunnelShape): void {
    placeLight(this.near, near);
    placeLight(this.far, far);
  }

  /** Quality scaling turns the local lights down rather than changing gameplay. */
  setQualityScale(scale: number): void {
    this.near.intensity = VISUAL.POINT_INTENSITY * scale;
    this.far.intensity = VISUAL.POINT_INTENSITY * 0.7 * scale;
    this.key.intensity = VISUAL.KEY_INTENSITY * (0.6 + 0.4 * scale);
  }

  dispose(): void {
    this.group.clear();
  }
}

function placeLight(light: PointLight, shape: TunnelShape): void {
  const lx = shape.lightX * shape.halfWidth * TUNNEL.LIGHT_OFFSET_FRACTION;
  const ly = shape.lightY * shape.halfHeight * TUNNEL.LIGHT_OFFSET_FRACTION;
  const cos = Math.cos(shape.roll);
  const sin = Math.sin(shape.roll);
  light.position.x = lx * cos - ly * sin;
  light.position.y = lx * sin + ly * cos;
}
