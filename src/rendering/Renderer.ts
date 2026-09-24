/**
 * VOIDRUSH — the WebGL renderer.
 *
 * Owns the scene, the camera, the views and post-processing. It reads the
 * simulation and never writes to it, so nothing here can change how a run
 * plays — only how it looks.
 *
 * There is exactly one renderer and one WebGL context for the whole
 * application: the menu's background tunnel is this same scene running at
 * reduced intensity, not a second canvas.
 */

import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CAMERA, RENDER, WORLD } from '../config/GameConfig';
import { VISUAL } from '../config/VisualConfig';
import type { Game } from '../game/Game';
import { clamp } from '../utils/MathUtils';
import type { QualityLevel, Settings } from '../types';
import { createTunnelShape } from '../world/TunnelProfile';
import { CameraController } from './CameraController';
import { disposeGeometries } from './Geometries';
import { FAR_LIGHT_DEPTH, Lighting, NEAR_LIGHT_DEPTH } from './Lighting';
import { MATERIAL_COUNT, disposeMaterials } from './Materials';
import { PostProcessing } from './PostProcessing';
import { blendPalettes, paletteForTier, type ResolvedPalette } from './Palettes';
import { ObstacleView, TunnelView } from './WorldView';

const PIXEL_RATIO: Readonly<Record<QualityLevel, number>> = {
  low: RENDER.PIXEL_RATIO_LOW,
  medium: RENDER.PIXEL_RATIO_MEDIUM,
  high: RENDER.PIXEL_RATIO_HIGH,
  ultra: RENDER.PIXEL_RATIO_ULTRA,
};

const QUALITY_LIGHT_SCALE: Readonly<Record<QualityLevel, number>> = {
  low: 0.5,
  medium: 0.8,
  high: 1,
  ultra: 1.15,
};

/** Order in which quality is given up when frames get expensive. */
const DOWNGRADE_PATH: Readonly<Record<QualityLevel, QualityLevel | null>> = {
  ultra: 'high',
  high: 'medium',
  medium: 'low',
  low: null,
};

export class RendererError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererError';
  }
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly cameraController: CameraController;

  private readonly renderer: WebGLRenderer;
  private readonly lighting = new Lighting();
  private readonly tunnelView = new TunnelView();
  private readonly obstacleView = new ObstacleView();
  private readonly post: PostProcessing;
  private readonly fog: Fog;

  private quality: QualityLevel = 'medium';
  /** The player's Visual intensity setting, in [0, 1]. */
  private visualIntensityScale = 1;
  private palette: ResolvedPalette;
  private paletteFrom: ResolvedPalette;
  private paletteTo: ResolvedPalette;
  private paletteBlend = 1;
  private repaintRequested = true;

  private readonly nearLightShape = createTunnelShape();
  private readonly farLightShape = createTunnelShape();

  private frameSamples: number[] = [];
  private downgraded = false;
  private contextLostHandler: ((event: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      throw new RendererError(
        error instanceof Error ? error.message : 'WebGL context could not be created',
      );
    }
    this.renderer = renderer;
    this.renderer.setClearColor(0x000000, 1);

    this.camera = new PerspectiveCamera(
      CAMERA.FOV_BASE,
      1,
      CAMERA.NEAR_CLIP,
      CAMERA.FAR_CLIP,
    );
    this.camera.position.set(0, 0, 0);
    this.cameraController = new CameraController(this.camera);

    this.palette = paletteForTier('INTRO');
    this.paletteFrom = this.palette;
    this.paletteTo = this.palette;

    this.fog = new Fog(this.palette.background, RENDER.FOG_NEAR, RENDER.FOG_FAR);
    this.scene.fog = this.fog;
    this.scene.background = new Color(this.palette.background);

    this.scene.add(this.lighting.group, this.tunnelView.group, this.obstacleView.group);
    this.lighting.applyPalette(this.palette);

    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.attachContextHandlers();
  }

  /* -------------------------------------------------------------- *
   * Lifecycle
   * -------------------------------------------------------------- */

  private attachContextHandlers(): void {
    this.contextLostHandler = (event: Event): void => {
      // Prevent the default so the browser will attempt a restore.
      event.preventDefault();
      this.onContextLost?.();
    };
    this.contextRestoredHandler = (): void => {
      this.repaintRequested = true;
      this.onContextRestored?.();
    };
    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  /** Set by the app so it can show the recovery screen. */
  onContextLost: (() => void) | null = null;
  onContextRestored: (() => void) | null = null;

  dispose(): void {
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }
    this.post.dispose();
    this.tunnelView.dispose();
    this.obstacleView.dispose();
    this.lighting.dispose();
    disposeMaterials();
    disposeGeometries();
    this.renderer.dispose();
  }

  /* -------------------------------------------------------------- *
   * Configuration
   * -------------------------------------------------------------- */

  applySettings(settings: Settings): void {
    this.setQuality(settings.quality);
    this.cameraController.setBaseFov(settings.fov);
    this.cameraController.setShakeScale(settings.cameraShake);
    this.post.setBloom(settings.bloom, settings.bloomIntensity);
    this.post.setEffectsIntensity(settings.effectsIntensity);
    this.visualIntensityScale = clamp(settings.visualIntensity, 0, 1);
  }

  setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.lighting.setQualityScale(QUALITY_LIGHT_SCALE[quality]);
    this.post.setQuality(quality);
    this.applyPixelRatio();
  }

  private applyPixelRatio(): void {
    const device = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const ratio = Math.min(device, RENDER.PIXEL_RATIO_CAP, PIXEL_RATIO[this.quality]);
    this.renderer.setPixelRatio(ratio);
    this.post.setSize(this.canvas.clientWidth, this.canvas.clientHeight, ratio);
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.cameraController.setAspect(w / h);
    this.renderer.setSize(w, h, false);
    this.applyPixelRatio();
    this.post.setSize(w, h, this.renderer.getPixelRatio());
  }

  /** Forces every instance buffer to be rebuilt, after a palette change. */
  requestRepaint(): void {
    this.repaintRequested = true;
  }

  /** Drops obstacle mesh assignments, for a restart or a return to the menu. */
  clearObstacles(): void {
    this.obstacleView.clear();
  }

  /* -------------------------------------------------------------- *
   * Frame
   * -------------------------------------------------------------- */

  /**
   * Draws one frame from the current simulation state. `dt` is real elapsed
   * time, used only for visual smoothing.
   */
  render(game: Game, dt: number, menuMode: boolean): void {
    const started = performance.now();

    this.updatePalette(game, dt);

    const distance = game.renderDistance;
    const repaint = this.repaintRequested;
    this.repaintRequested = false;

    this.tunnelView.sync(game.world.tunnel.segments, distance, this.palette, repaint);
    const profile = game.world.tunnel.profile;
    this.lighting.placeLights(
      profile.sample(distance + NEAR_LIGHT_DEPTH, this.nearLightShape),
      profile.sample(distance + FAR_LIGHT_DEPTH, this.farLightShape),
    );
    if (menuMode) {
      this.obstacleView.clear();
    } else {
      this.obstacleView.sync(game.world.active, distance, game.time, this.palette, repaint);
    }

    this.cameraController.update(game.player, game.speed, dt);
    // [PRD 16 / 17] Effects build with the run, scaled by the player's setting.
    // The menu background stays at the calm opening look.
    this.post.setVisualIntensity(
      menuMode ? 0 : game.state.visualIntensity * this.visualIntensityScale,
    );
    // Overdrive past 150 s pulses the frame, on simulation time so a paused or
    // crashed run holds still.
    this.post.setOverload(
      menuMode ? 0 : game.state.overdrive * this.visualIntensityScale,
      game.time,
    );
    // [PRD 11] Collision distortion and the fade into the results screen.
    this.post.setImpact(menuMode ? 0 : game.impactProgress);
    this.post.render();

    this.trackFrameCost(performance.now() - started);
  }

  /** Cross-fades between phase palettes over the configured duration. */
  private updatePalette(game: Game, dt: number): void {
    const target = paletteForTier(game.state.tier);
    if (target.id !== this.paletteTo.id) {
      this.paletteFrom = this.palette;
      this.paletteTo = target;
      this.paletteBlend = 0;
    }
    if (this.paletteBlend < 1) {
      this.paletteBlend = clamp(this.paletteBlend + dt / VISUAL.PALETTE_LERP_SECONDS, 0, 1);
      this.palette = blendPalettes(this.paletteFrom, this.paletteTo, this.paletteBlend);
      this.fog.color.setHex(this.palette.background);
      (this.scene.background as Color).setHex(this.palette.background);
      this.lighting.applyPalette(this.palette);
      // Instance colours are baked, so a fade has to rebuild them.
      this.repaintRequested = true;
    }
  }

  /**
   * Watches the frame cost and gives up quality rather than frames.
   * [PRD 26 / Design 9] The downgrade is logged once so it is never silent.
   */
  private trackFrameCost(costMs: number): void {
    if (this.downgraded) return;
    this.frameSamples.push(costMs);
    if (this.frameSamples.length < RENDER.FRAME_TIME_SAMPLES) return;

    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.frameSamples = [];

    if (median <= RENDER.FRAME_TIME_BUDGET_MS) return;

    const next = DOWNGRADE_PATH[this.quality];
    if (next === null) {
      // Nothing left to give up: cut effects instead, readability order first.
      this.post.setReadabilityBudget(0.4);
      this.downgraded = true;
      console.warn(
        `VOIDRUSH: frame cost ${median.toFixed(1)} ms exceeds the ${RENDER.FRAME_TIME_BUDGET_MS} ms budget at the lowest quality; reducing post-processing.`,
      );
      return;
    }

    console.warn(
      `VOIDRUSH: frame cost ${median.toFixed(1)} ms exceeds the ${RENDER.FRAME_TIME_BUDGET_MS} ms budget; quality reduced from ${this.quality} to ${next}.`,
    );
    this.setQuality(next);
  }

  /* -------------------------------------------------------------- *
   * Diagnostics
   * -------------------------------------------------------------- */

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  get instancedDrawCalls(): number {
    return this.tunnelView.drawCalls + this.obstacleView.drawCalls;
  }

  get materialCount(): number {
    return MATERIAL_COUNT;
  }

  get activeQuality(): QualityLevel {
    return this.quality;
  }

  get currentPalette(): ResolvedPalette {
    return this.palette;
  }

  /** Exposed for diagnostics and for the browser QA pass. */
  get info(): { calls: number; triangles: number; segments: number } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      segments: WORLD.SEGMENT_COUNT,
    };
  }
}
