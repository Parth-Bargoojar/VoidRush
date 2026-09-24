/**
 * VOIDRUSH — the audio graph.
 *
 * [Design 14] If audio cannot start, gameplay continues. The engine begins in a
 * silent no-op state and only builds a real graph after the first user gesture;
 * if construction fails for any reason it stays silent for the rest of the
 * session and every call becomes a cheap no-op. Nothing in the game ever waits
 * on audio.
 *
 * Live voices are counted and capped, and each voice disconnects itself when it
 * ends, so the node graph does not grow across a long session.
 *
 * [PRD 29] Music: if the build shipped `public/soundtrack.mp3`, that track
 * fades in on the first user gesture. Otherwise, or if the file fails to load
 * or play, the procedural synthwave sequencer plays instead. Both follow the
 * run's speed and duck while paused.
 */

import { AUDIO, MUSIC, type SoundId } from '../config/AudioConfig';
import { SPEED } from '../config/GameConfig';
import { clamp } from '../utils/MathUtils';
import { MusicSequencer } from './MusicSequencer';
import { MAX_VOICES, Voice, specFor } from './SoundBank';

type AudioContextConstructor = new () => AudioContext;

/** Set at build time by vite.config.ts when public/soundtrack.mp3 exists. */
const SOUNDTRACK_URL: string | null =
  typeof __VOIDRUSH_HAS_SOUNDTRACK__ !== 'undefined' && __VOIDRUSH_HAS_SOUNDTRACK__
    ? `${import.meta.env.BASE_URL}soundtrack.mp3`
    : null;

/** How far an external track speeds up at maximum forward speed. */
const TRACK_MAX_RATE_GAIN = 0.06;

function resolveAudioContext(): AudioContextConstructor | null {
  const scope = globalThis as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneSources: OscillatorNode[] = [];
  private sequencer: MusicSequencer | null = null;
  private track: HTMLAudioElement | null = null;
  private trackNodes: AudioNode[] = [];
  private musicStarted = false;

  private readonly live = new Set<Voice>();
  private volumes: AudioVolumes = { master: 1, music: 0.8, sfx: 1 };
  private failed = false;
  private ducked = false;

  /** True when no real audio graph exists; every call is then a no-op. */
  get isSilent(): boolean {
    return this.context === null;
  }

  get liveVoiceCount(): number {
    return this.live.size;
  }

  /** Total nodes the engine is holding open. Asserted not to grow. */
  get nodeCount(): number {
    const fixed = this.context === null ? 0 : 4 + this.droneSources.length;
    const music = (this.sequencer?.liveVoiceCount ?? 0) + this.trackNodes.length;
    return fixed + this.live.size + music;
  }

  get isMusicPlaying(): boolean {
    return this.sequencer?.isPlaying === true || this.track !== null;
  }

  /**
   * Builds the graph. Must be called from a user gesture; safe to call
   * repeatedly. Returns false if audio is unavailable, which is not an error.
   */
  unlock(): boolean {
    if (this.context) {
      void this.context.resume().catch(() => undefined);
      return true;
    }
    if (this.failed) return false;

    const Ctor = resolveAudioContext();
    if (!Ctor) {
      this.failed = true;
      return false;
    }

    try {
      const context = new Ctor();
      const master = context.createGain();
      const music = context.createGain();
      const sfx = context.createGain();
      master.connect(context.destination);
      music.connect(master);
      sfx.connect(master);

      this.context = context;
      this.masterGain = master;
      this.musicGain = music;
      this.sfxGain = sfx;
      this.applyVolumes();
      this.startDrone();
      void context.resume().catch(() => undefined);
      return true;
    } catch {
      // Blocked, unsupported, or out of resources: stay silent and carry on.
      this.failed = true;
      this.context = null;
      return false;
    }
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = {
      master: clamp(volumes.master, 0, 1),
      music: clamp(volumes.music, 0, 1),
      sfx: clamp(volumes.sfx, 0, 1),
    };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.masterGain || !this.musicGain || !this.sfxGain) return;
    this.masterGain.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music * (this.ducked ? AUDIO.PAUSE_DUCK : 1);
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  /** A low ambient drone whose filter cutoff tracks forward speed. */
  private startDrone(): void {
    const context = this.context;
    if (!context || !this.musicGain) return;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = AUDIO.DRONE_CUTOFF_MIN;

    const gain = context.createGain();
    gain.gain.value = AUDIO.DRONE_GAIN;

    filter.connect(gain);
    gain.connect(this.musicGain);

    for (const detune of [-AUDIO.DRONE_DETUNE, 0, AUDIO.DRONE_DETUNE]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = AUDIO.DRONE_BASE_FREQ;
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      oscillator.start();
      this.droneSources.push(oscillator);
    }
    this.droneFilter = filter;
  }

  private stopDrone(): void {
    for (const source of this.droneSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped.
      }
    }
    this.droneSources = [];
    this.droneFilter?.disconnect();
    this.droneFilter = null;
  }

  /**
   * [PRD 29] Starts the soundtrack. The graph only exists after `unlock`, so
   * this is a no-op until a user gesture has happened, and safe to call on
   * every gesture. Prefers the shipped track; falls back to the sequencer.
   */
  startMusic(): void {
    if (this.musicStarted || !this.context || !this.musicGain) return;
    this.musicStarted = true;
    if (SOUNDTRACK_URL !== null && this.startTrack(SOUNDTRACK_URL)) return;
    this.startSequencer();
  }

  private startSequencer(): void {
    if (!this.context || !this.musicGain || this.sequencer?.isPlaying) return;
    this.sequencer = new MusicSequencer(this.context, this.musicGain);
    this.sequencer.start();
  }

  /** Streams the external track through the music bus, fading it in. */
  private startTrack(url: string): boolean {
    const context = this.context;
    if (!context || !this.musicGain || typeof Audio === 'undefined') return false;
    if (typeof context.createMediaElementSource !== 'function') return false;
    try {
      const element = new Audio(url);
      element.loop = true;
      element.preload = 'auto';
      const source = context.createMediaElementSource(element);
      const fade = context.createGain();
      fade.gain.setValueAtTime(0, context.currentTime);
      fade.gain.linearRampToValueAtTime(1, context.currentTime + MUSIC.TRACK_FADE_SECONDS);
      source.connect(fade);
      fade.connect(this.musicGain);

      // A missing, undecodable or blocked file hands over to the synth.
      const fallBack = (): void => {
        if (this.track !== element) return;
        this.stopTrack();
        this.startSequencer();
      };
      element.addEventListener('error', fallBack, { once: true });
      void element.play().catch(fallBack);

      this.track = element;
      this.trackNodes = [source, fade];
      // The drone belongs to the synth mix; under a produced track it is mud.
      this.stopDrone();
      return true;
    } catch {
      return false;
    }
  }

  private stopTrack(): void {
    if (this.track) {
      this.track.pause();
      this.track.removeAttribute('src');
      this.track.load();
      this.track = null;
    }
    for (const node of this.trackNodes) {
      try {
        node.disconnect();
      } catch {
        // Already detached.
      }
    }
    this.trackNodes = [];
  }

  /** Music follows the run: the drone opens up and the soundtrack speeds up. */
  setSpeed(speed: number): void {
    const fraction = clamp((speed - SPEED.START) / (SPEED.MAX - SPEED.START), 0, 1);
    this.sequencer?.setIntensity(fraction);
    if (this.track) this.track.playbackRate = 1 + TRACK_MAX_RATE_GAIN * fraction;
    if (!this.droneFilter) return;
    const target =
      AUDIO.DRONE_CUTOFF_MIN + (AUDIO.DRONE_CUTOFF_MAX - AUDIO.DRONE_CUTOFF_MIN) * fraction;
    this.droneFilter.frequency.value = target;
  }

  /** [PRD 5 / Design] Audio dims while the game is paused. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolumes();
  }

  play(id: SoundId): void {
    const context = this.context;
    if (!context || !this.sfxGain) return;
    // Drop the oldest voice rather than letting the graph grow without limit.
    if (this.live.size >= MAX_VOICES) {
      const oldest = this.live.values().next().value;
      if (oldest) oldest.dispose();
    }
    try {
      const voice = new Voice(context, specFor(id), this.sfxGain, 1);
      voice.onRetire = (): void => {
        this.live.delete(voice);
      };
      this.live.add(voice);
    } catch {
      // A failed voice must never interrupt gameplay.
    }
  }

  /** Stops every live sound effect, for a restart or a return to the menu. */
  stopAll(): void {
    for (const voice of [...this.live]) voice.dispose();
    this.live.clear();
  }

  dispose(): void {
    this.stopAll();
    this.sequencer?.stop();
    this.sequencer = null;
    this.stopTrack();
    this.stopDrone();
    this.sfxGain?.disconnect();
    this.musicGain?.disconnect();
    this.masterGain?.disconnect();
    this.sfxGain = null;
    this.musicGain = null;
    this.masterGain = null;
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
  }
}
