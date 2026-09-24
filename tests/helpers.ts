/**
 * Shared test scaffolding: a renderer-free simulation, a scripted input source
 * and an autopilot bot. The bot is the same one the soak harness drives, so the
 * statistics the tests assert and the statistics the soak reports come from
 * identical play.
 */

import { TIMING, WORLD } from '../src/config/GameConfig';
import { Game } from '../src/game/Game';
import { effectiveLateralSpeed } from '../src/game/Player';
import { CombinationObstacle } from '../src/obstacles/CombinationObstacle';
import type { BaseObstacle } from '../src/obstacles/Obstacle';
import { ObstacleFactory } from '../src/obstacles/ObstacleFactory';
import { DifficultyManager } from '../src/game/DifficultyManager';
import { ObstacleGenerator } from '../src/world/ObstacleGenerator';
import { Rng } from '../src/utils/Random';
import type { InputState } from '../src/types';

export const DT = TIMING.FIXED_DT;

/** A generator wired up on its own, for reachability sweeps. */
export function makeGenerator(seed: number): {
  generator: ObstacleGenerator;
  factory: ObstacleFactory;
} {
  const factory = new ObstacleFactory();
  const difficulty = new DifficultyManager();
  const rng = new Rng(seed);
  const generator = new ObstacleGenerator(factory, difficulty, rng);
  generator.reset(rng, effectiveLateralSpeed(1));
  return { generator, factory };
}

/**
 * Autopilot: steers toward the opening of the nearest approaching obstacle,
 * with a reaction delay and human-like aim.
 *
 * The bot deliberately does not lock onto the exact centre of a gap. A player
 * aims *into* the opening, not at its midpoint, so the bot picks a random point
 * within the middle portion of the gap and adds a little control error on top.
 * Aiming at dead centre would make near misses essentially impossible and would
 * make the harness a poor proxy for real play.
 */
export class AutopilotBot {
  private readonly rng: Rng;
  private readonly reactionDelay: number;
  private readonly jitter: number;
  /** Fraction of the opening's half-extent the aim point may wander across. */
  private readonly aimSpread: number;
  private aimX = 0;
  private aimY = 0;
  private aimSetAt = -1;
  private aimForId = -1;

  constructor(seed: number, reactionDelay = 0.15, jitter = 0.25, aimSpread = 0.7) {
    this.rng = new Rng(seed);
    this.reactionDelay = reactionDelay;
    this.jitter = jitter;
    this.aimSpread = aimSpread;
  }

  reset(): void {
    this.aimSetAt = -1;
    this.aimForId = -1;
    this.aimX = 0;
    this.aimY = 0;
  }

  /** Chooses an input for this step. */
  input(game: Game, out: InputState): InputState {
    const target = this.nearestTarget(game);
    if (target && target.id !== this.aimForId) {
      this.aimForId = target.id;
      this.aimSetAt = game.time + this.reactionDelay;
      // Uniform over a disc inside the gap, plus a little control error.
      const spread = target.half * this.aimSpread;
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = Math.sqrt(this.rng.next()) * spread;
      this.aimX = target.x + Math.cos(angle) * radius + this.rng.range(-this.jitter, this.jitter);
      this.aimY = target.y + Math.sin(angle) * radius + this.rng.range(-this.jitter, this.jitter);
    }

    const engaged = this.aimSetAt >= 0 && game.time >= this.aimSetAt;
    const goalX = engaged ? this.aimX : game.player.x;
    const goalY = engaged ? this.aimY : game.player.y;

    const dx = goalX - game.player.x;
    const dy = goalY - game.player.y;
    const dead = 0.12;

    out.left = dx < -dead;
    out.right = dx > dead;
    out.down = dy < -dead;
    out.up = dy > dead;
    return out;
  }

  /**
   * The opening the player should be heading for right now.
   *
   * A combination is followed layer by layer: the validator proves each layer
   * from the exit of the one before, and the next obstacle from the exit of the
   * last layer, so aiming only at the first layer would leave the bot off the
   * proven path for everything that follows.
   */
  private nearestTarget(game: Game): { id: number; x: number; y: number; half: number } | null {
    let best: BaseObstacle | null = null;
    for (const obstacle of game.world.active) {
      if (obstacle.state !== 'APPROACHING') continue;
      if (obstacle.z - obstacle.depthHalf > WORLD.CLEAR_Z) continue;
      if (best === null || obstacle.zeroDistance < best.zeroDistance) best = obstacle;
    }
    if (!best) return null;

    let body: BaseObstacle = best;
    let tCross = best.tCross;
    let id = best.id;
    if (best instanceof CombinationObstacle) {
      const index = best.layers.findIndex(
        (layer) => best.z + layer.zOffset - layer.obstacle.depthHalf <= WORLD.CLEAR_Z,
      );
      const layer = best.layers[Math.max(0, index)]!;
      body = layer.obstacle;
      tCross = layer.tCross;
      // Negative, so a layer id can never collide with a plain obstacle id.
      id = -(best.id * 16 + Math.max(0, index) + 1);
    }

    const opening = body.getOpenings(tCross)[0];
    if (!opening) return null;
    return { id, x: opening.cx, y: opening.cy, half: Math.min(opening.hx, opening.hy) };
  }
}

export interface BotRunResult {
  survivedSeconds: number;
  cleared: number;
  nearMisses: number;
  score: number;
  crashed: boolean;
  maxActive: number;
  maxParts: number;
  stepTimesMs: number[];
}

/** Runs the autopilot for up to `seconds`, returning play statistics. */
export function runBot(
  game: Game,
  bot: AutopilotBot,
  seconds: number,
  options: { measure?: boolean; restartOnCrash?: boolean } = {},
): BotRunResult {
  const input: InputState = { up: false, down: false, left: false, right: false };
  const steps = Math.round(seconds / DT);
  const stepTimes: number[] = [];
  let cleared = 0;
  let nearMisses = 0;
  let crashed = false;
  let maxActive = 0;
  let maxParts = 0;
  let survived = 0;

  for (let i = 0; i < steps; i += 1) {
    bot.input(game, input);
    const start = options.measure ? performance.now() : 0;
    game.step(DT, input);
    if (options.measure) stepTimes.push(performance.now() - start);

    maxActive = Math.max(maxActive, game.world.activeCount);
    maxParts = Math.max(maxParts, game.world.activePartCount);

    if (game.phase === 'FLYING') survived = game.time;
    if (game.phase === 'IMPACT' || game.phase === 'ENDED') {
      crashed = true;
      cleared += game.score.obstaclesCleared;
      nearMisses += game.score.nearMisses;
      if (!options.restartOnCrash) break;
      game.startRun(game.currentSeed + i + 1);
      bot.reset();
    }
  }

  if (!crashed) {
    cleared = game.score.obstaclesCleared;
    nearMisses = game.score.nearMisses;
  }

  return {
    survivedSeconds: survived,
    cleared,
    nearMisses,
    score: game.score.score,
    crashed,
    maxActive,
    maxParts,
    stepTimesMs: stepTimes,
  };
}

/** Deterministic scripted input, a pure function of the step index. */
export function scriptedInput(step: number, out: InputState): InputState {
  const phase = Math.floor(step / 37) % 6;
  out.up = phase === 0 || phase === 4;
  out.down = phase === 1;
  out.left = phase === 2 || phase === 4;
  out.right = phase === 3;
  return out;
}
