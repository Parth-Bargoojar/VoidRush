/**
 * VOIDRUSH — post-processing.
 *
 * [PRD 26] Bloom, vignette and colour grading are required; chromatic
 * aberration is optional and edge-only.
 *
 * [PRD 11] The same grading pass carries the collision feedback: a whole-screen
 * warp, channel split and desaturation after the hit-stop, then a fade toward
 * black that hands over to the results screen.
 *
 * The readability rule overrides everything here: if an effect would obscure an
 * upcoming obstacle it is reduced, in the order chromatic aberration, then
 * bloom, then vignette. `setReadabilityBudget` is how that ordering is applied,
 * and the automatic quality downgrade drives it when frames get expensive. The
 * collision feedback is exempt, because by then the run is already over.
 */

import type { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import { Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { IMPACT } from '../config/GameConfig';
import { QUALITY_BLOOM, VISUAL } from '../config/VisualConfig';
import { clamp, lerp, smoothstep } from '../utils/MathUtils';
import type { QualityLevel } from '../types';

/**
 * Vignette, grading, edge-only chromatic aberration and the impact effects in
 * a single pass. The gameplay aberration is scaled by the squared distance from
 * the centre, so the middle of the screen — where the next obstacle is — stays
 * clean while the run is live.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: VISUAL.VIGNETTE_STRENGTH },
    uSaturation: { value: VISUAL.GRADE_SATURATION },
    uContrast: { value: VISUAL.GRADE_CONTRAST },
    uAberration: { value: 0 },
    uImpact: { value: 0 },
    uImpactAberration: { value: 0 },
    uImpactWarp: { value: 0 },
    uWarpFrequency: { value: VISUAL.IMPACT_WARP_FREQUENCY },
    uWarpPhase: { value: 0 },
    uDesaturate: { value: 0 },
    uFlash: { value: 0 },
    uFade: { value: 0 },
    uPulse: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uAberration;
    uniform float uImpactAberration;
    uniform float uImpactWarp;
    uniform float uWarpFrequency;
    uniform float uWarpPhase;
    uniform float uDesaturate;
    uniform float uFlash;
    uniform float uFade;
    uniform float uPulse;
    varying vec2 vUv;

    void main() {
      vec2 centred = vUv - 0.5;
      float radius = dot(centred, centred);
      float dist = sqrt(radius);

      // Impact ripple: a radial wave pushing the image in and out from the
      // centre. Zero while the run is live.
      vec2 direction = dist > 1e-4 ? centred / dist : vec2(0.0);
      vec2 uv = vUv + direction * sin(dist * uWarpFrequency - uWarpPhase) * uImpactWarp;

      // Edge-only gameplay aberration plus the whole-screen impact split.
      vec2 offset = centred * uAberration * radius + direction * uImpactAberration;
      vec4 colour;
      colour.r = texture2D(tDiffuse, uv + offset).r;
      colour.g = texture2D(tDiffuse, uv).g;
      colour.b = texture2D(tDiffuse, uv - offset).b;
      colour.a = 1.0;

      float luma = dot(colour.rgb, vec3(0.2126, 0.7152, 0.0722));
      float saturation = uSaturation * (1.0 - uDesaturate) * (1.0 + uPulse * ${VISUAL.OVERLOAD_PULSE_SATURATION.toFixed(3)});
      colour.rgb = mix(vec3(luma), colour.rgb, saturation);
      colour.rgb *= 1.0 + uPulse * ${VISUAL.OVERLOAD_PULSE_BRIGHTNESS.toFixed(3)};
      colour.rgb = (colour.rgb - 0.5) * uContrast + 0.5;

      float vignette = smoothstep(0.8, 0.15, radius * 2.0);
      colour.rgb *= mix(1.0, vignette, uVignette);

      colour.rgb += vec3(uFlash);
      colour.rgb *= 1.0 - uFade;

      gl_FragColor = colour;
    }
  `,
};

export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private bloomEnabled = true;
  private bloomScale = 1;
  private effectsScale = 1;
  private readabilityBudget = 1;
  /** Difficulty × the Visual intensity setting, in [0, 1]. */
  private visualIntensity = 0;
  private quality: QualityLevel = 'medium';
  private overloadPhase = 0;
  private overloadClock = 0;
  private width = 1;
  private height = 1;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      VISUAL.BLOOM_STRENGTH,
      VISUAL.BLOOM_RADIUS,
      VISUAL.BLOOM_THRESHOLD,
    );
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.applyBloomResolution();
  }

  /** [TRD Quality Scaling] Low quality runs a cheaper, weaker bloom. */
  setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.applyBloomResolution();
    this.applyStrengths();
  }

  private applyBloomResolution(): void {
    const scale = QUALITY_BLOOM.resolution[this.quality];
    this.bloom.resolution.set(
      Math.max(1, Math.round(this.width * scale)),
      Math.max(1, Math.round(this.height * scale)),
    );
  }

  setBloom(enabled: boolean, intensity: number): void {
    this.bloomEnabled = enabled;
    this.bloomScale = clamp(intensity, 0, 2);
    this.applyStrengths();
  }

  setEffectsIntensity(value: number): void {
    this.effectsScale = clamp(value, 0, 1);
    this.applyStrengths();
  }

  /**
   * Reduces effects in the order the readability rule demands. A budget of 1
   * is full strength; lower values cut chromatic aberration first, then bloom,
   * then the vignette. Obstacle visibility is never what gets cut.
   */
  setReadabilityBudget(budget: number): void {
    this.readabilityBudget = clamp(budget, 0, 1);
    this.applyStrengths();
  }

  /**
   * [PRD 16 / 17] Effects follow the run's visual intensity: minimal in INTRO,
   * aggressive in OVERLOAD. `intensity` is already scaled by the player's
   * Visual intensity setting.
   */
  setVisualIntensity(intensity: number): void {
    const next = clamp(intensity, 0, 1);
    // Bloom and vignette only need re-deriving when the value visibly moves.
    if (Math.abs(next - this.visualIntensity) > 1e-3) {
      this.visualIntensity = next;
      this.applyStrengths();
    }

    const from = VISUAL.CHROMATIC_ABERRATION_FROM_INTENSITY;
    const over = Math.max(0, next - from);
    const range = Math.max(1e-6, 1 - from);
    const aberration =
      (over / range) *
      VISUAL.CHROMATIC_ABERRATION_MAX *
      this.effectsScale *
      // Aberration is the first thing sacrificed, so it fades out fastest.
      Math.max(0, this.readabilityBudget * 2 - 1);
    this.grade.uniforms.uAberration!.value = aberration;
  }

  /**
   * [PRD 11] Drives the collision feedback from the sequence's progress, 0 to
   * 1. The distortion peaks during the ~100 ms hit-stop and relaxes as the
   * frame fades; the fade itself is held at its final value behind the results
   * screen so the scene never snaps back to full brightness.
   *
   * The distortion honours the Effects intensity setting; the fade and flash
   * do not, so the collision always reads even with effects turned off.
   */
  setImpact(progress: number): void {
    const u = this.grade.uniforms;
    const p = clamp(progress, 0, 1);
    if (p <= 0) {
      u.uImpactAberration!.value = 0;
      u.uImpactWarp!.value = 0;
      u.uDesaturate!.value = 0;
      u.uFlash!.value = 0;
      u.uFade!.value = 0;
      return;
    }

    const hold = IMPACT.FREEZE_SECONDS / IMPACT.TOTAL_SECONDS;
    // Full strength through the hit-stop, then an ease-out to nothing.
    const relax = p <= hold ? 1 : 1 - (p - hold) / (1 - hold);
    const distortion = relax * relax * this.effectsScale;

    u.uImpactAberration!.value = VISUAL.IMPACT_ABERRATION * distortion;
    u.uImpactWarp!.value = VISUAL.IMPACT_WARP * distortion;
    u.uWarpPhase!.value = p * VISUAL.IMPACT_WARP_FREQUENCY * 0.5;
    u.uDesaturate!.value = VISUAL.IMPACT_DESATURATE * Math.min(1, relax * 1.5);
    u.uFlash!.value = p <= hold ? VISUAL.IMPACT_FLASH * (1 - p / hold) : 0;
    u.uFade!.value =
      VISUAL.IMPACT_FADE_TO *
      smoothstep((p - VISUAL.IMPACT_FADE_FROM) / (1 - VISUAL.IMPACT_FADE_FROM));
  }

  /**
   * Overload colour pulse past 150 s. `overdrive` is already scaled by the
   * Visual intensity setting. `simTime` is simulation time, so the pulse
   * freezes whenever the simulation does: paused, crashed or in a menu.
   */
  setOverload(overdrive: number, simTime: number): void {
    // A new run restarts the clock; never step backwards.
    const dt = simTime >= this.overloadClock ? simTime - this.overloadClock : 0;
    this.overloadClock = simTime;
    const amount = clamp(overdrive, 0, 1);
    if (amount <= 0) {
      this.grade.uniforms.uPulse!.value = 0;
      return;
    }
    const hz = lerp(VISUAL.OVERLOAD_PULSE_HZ_MIN, VISUAL.OVERLOAD_PULSE_HZ_MAX, amount);
    this.overloadPhase = (this.overloadPhase + Math.PI * 2 * hz * dt) % (Math.PI * 2);
    const wave = 0.5 + 0.5 * Math.sin(this.overloadPhase);
    this.grade.uniforms.uPulse!.value = amount * wave * this.effectsScale;
  }

  private applyStrengths(): void {
    const intensityBloom = lerp(VISUAL.BLOOM_INTENSITY_FLOOR, 1, this.visualIntensity);
    const intensityVignette = lerp(VISUAL.VIGNETTE_INTENSITY_FLOOR, 1, this.visualIntensity);

    this.bloom.enabled = this.bloomEnabled && this.readabilityBudget > 0.15;
    this.bloom.strength =
      VISUAL.BLOOM_STRENGTH *
      QUALITY_BLOOM.strength[this.quality] *
      intensityBloom *
      this.bloomScale *
      this.effectsScale *
      Math.min(1, this.readabilityBudget * 1.4);
    this.grade.uniforms.uVignette!.value =
      VISUAL.VIGNETTE_STRENGTH *
      intensityVignette *
      this.effectsScale *
      Math.min(1, this.readabilityBudget * 2);
    this.grade.uniforms.uSaturation!.value = VISUAL.GRADE_SATURATION;
    this.grade.uniforms.uContrast!.value = VISUAL.GRADE_CONTRAST;
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.bloom.dispose();
    this.grade.dispose();
  }
}
