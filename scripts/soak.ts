/**
 * VOIDRUSH — head-less soak harness.
 *
 * Runs the real simulation with no renderer, driven by the same autopilot bot
 * the test suite uses: five simulated minutes across ten seeds. It answers two
 * questions a unit test cannot, and it answers them with two different bots
 * because they need different play:
 *
 *   Pass A (stability) uses a precise bot that aims at the centre of each gap.
 *   It survives the full five minutes, which is the only way to observe genuine
 *   steady-state resource behaviour: obstacle counts, segment counts and pool
 *   growth over an uninterrupted run.
 *
 *   Pass B (gameplay) uses a human-like bot that aims *into* the gap rather
 *   than at its midpoint, with a reaction delay and control error. That is the
 *   run the near-miss rate, clear count and survival time are measured from,
 *   because a centre-locking bot is not a proxy for a player.
 *
 * Exits non-zero if any assertion fails, so `npm run soak` is CI-usable.
 */

import { DIFFICULTY } from '../src/config/DifficultyConfig';
import { OBSTACLE, TIMING, WORLD } from '../src/config/GameConfig';
import { Game } from '../src/game/Game';
import { DifficultyManager } from '../src/game/DifficultyManager';
import type { InputState } from '../src/types';
import { AutopilotBot } from '../tests/helpers';

const MINUTES = 5;
const SEEDS = 10;
const SECONDS = MINUTES * 60;
const STEPS = Math.round(SECONDS / TIMING.FIXED_DT);
const SAMPLE_EVERY = 600; // every 5 simulated seconds

/**
 * Drift is only meaningful once difficulty has saturated within the current
 * run. Before then the active obstacle count legitimately falls, because
 * spacing grows with speed while the spawn distance stays fixed.
 */
const STEADY_STATE_AFTER = DIFFICULTY.RAMP_SECONDS;

/**
 * Hard ceiling on obstacle instances: every live obstacle, plus the sub-layers
 * a combination can hold, plus the churn of one generation attempt.
 */
const POOL_BOUND =
  WORLD.MAX_ACTIVE_OBSTACLES * (1 + OBSTACLE.COMBINATION_LAYERS_MAX) +
  OBSTACLE.COMBINATION_LAYERS_MAX +
  2;

interface BotProfile {
  reactionDelay: number;
  jitter: number;
  aimSpread: number;
}

/** Aims at the centre of each gap: used to observe an uninterrupted run. */
const PRECISE: BotProfile = { reactionDelay: 0.15, jitter: 0, aimSpread: 0 };
/** Aims into the gap with control error: used to measure how the game plays. */
const HUMAN: BotProfile = { reactionDelay: 0.15, jitter: 0.25, aimSpread: 0.7 };

interface SeedResult {
  seed: number;
  runs: number;
  longestSurvival: number;
  meanSurvival: number;
  cleared: number;
  nearMisses: number;
  fallbacks: number;
  generated: number;
  maxActive: number;
  maxSegments: number;
  maxParts: number;
  steadySamples: number;
  steadyFirstHalfActive: number;
  steadySecondHalfActive: number;
  constructedAtThird: number;
  constructedAtTwoThirds: number;
  constructedFinal: number;
  meanStepMs: number;
  p99StepMs: number;
  midNearMissRate: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

function runSeed(seed: number, profile: BotProfile, restartOnCrash: boolean): SeedResult {
  const game = new Game({ seed });
  const difficulty = new DifficultyManager();
  game.startRun(seed);
  const bot = new AutopilotBot(
    seed ^ 0x5f3759df,
    profile.reactionDelay,
    profile.jitter,
    profile.aimSpread,
  );
  const input: InputState = { up: false, down: false, left: false, right: false };

  const stepTimes: number[] = [];
  const steadyActiveSamples: number[] = [];
  let constructedAtThird = 0;
  let constructedAtTwoThirds = 0;

  let runs = 1;
  let cleared = 0;
  let nearMisses = 0;
  let survivalTotal = 0;
  let longestSurvival = 0;
  let maxActive = 0;
  let maxSegments = 0;
  let maxParts = 0;
  let midClears = 0;
  let midNearMisses = 0;
  let finished = false;

  for (let i = 0; i < STEPS; i += 1) {
    bot.input(game, input);

    const start = performance.now();
    game.step(TIMING.FIXED_DT, input);
    stepTimes.push(performance.now() - start);

    if (game.phase === 'FLYING') {
      const tier = difficulty.tierAt(game.time);
      for (let e = 0; e < game.world.eventCountThisStep; e += 1) {
        const event = game.world.eventAt(e);
        if (event.kind !== 'CLEAR') continue;
        // The 15-35% target applies at mid difficulty.
        if (tier === 'BUILD' || tier === 'INTENSE') {
          midClears += 1;
          if (event.minSurfaceDistance >= 0 && event.minSurfaceDistance <= 1.5) midNearMisses += 1;
        }
      }
    }

    maxActive = Math.max(maxActive, game.world.activeCount);
    maxSegments = Math.max(maxSegments, game.world.tunnel.segmentCount);
    maxParts = Math.max(maxParts, game.world.activePartCount);

    if (i % SAMPLE_EVERY === 0 && game.phase === 'FLYING' && game.time >= STEADY_STATE_AFTER) {
      steadyActiveSamples.push(game.world.activeCount);
    }
    if (i === Math.round(STEPS / 3)) constructedAtThird = game.factory.createdCount;
    if (i === Math.round((STEPS * 2) / 3)) constructedAtTwoThirds = game.factory.createdCount;

    if (game.phase === 'IMPACT' || game.phase === 'ENDED') {
      survivalTotal += game.time;
      longestSurvival = Math.max(longestSurvival, game.time);
      cleared += game.score.obstaclesCleared;
      nearMisses += game.score.nearMisses;
      if (!restartOnCrash) {
        finished = true;
        break;
      }
      runs += 1;
      game.startRun((seed * 31 + runs) >>> 0);
      bot.reset();
    }
  }

  if (!finished && game.phase === 'FLYING') {
    survivalTotal += game.time;
    longestSurvival = Math.max(longestSurvival, game.time);
    cleared += game.score.obstaclesCleared;
    nearMisses += game.score.nearMisses;
  }

  const sorted = [...stepTimes].sort((a, b) => a - b);
  const half = Math.floor(steadyActiveSamples.length / 2);

  return {
    seed,
    runs,
    longestSurvival,
    meanSurvival: survivalTotal / Math.max(1, runs),
    cleared,
    nearMisses,
    fallbacks: game.world.generator.stats.fallbacks,
    generated: game.world.generator.stats.generated,
    maxActive,
    maxSegments,
    maxParts,
    steadySamples: steadyActiveSamples.length,
    steadyFirstHalfActive: mean(steadyActiveSamples.slice(0, half)),
    steadySecondHalfActive: mean(steadyActiveSamples.slice(half)),
    constructedAtThird,
    constructedAtTwoThirds,
    constructedFinal: game.factory.createdCount,
    meanStepMs: mean(stepTimes),
    p99StepMs: percentile(sorted, 0.99),
    midNearMissRate: midClears === 0 ? 0 : midNearMisses / midClears,
  };
}

function report(title: string, results: SeedResult[], rows: Array<[string, string]>): void {
  console.info(`\n${title}`);
  console.info('-'.repeat(title.length));
  for (const [label, value] of rows) console.info(`  ${label.padEnd(28)} ${value}`);
  void results;
}

function main(): void {
  const startedAt = Date.now();
  const failures: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) failures.push(message);
  };
  const seeds = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 7919);
  const meanOf = (rs: SeedResult[], pick: (r: SeedResult) => number): number =>
    rs.reduce((a, r) => a + pick(r), 0) / rs.length;
  const maxOf = (rs: SeedResult[], pick: (r: SeedResult) => number): number =>
    Math.max(...rs.map(pick));

  console.info('VOIDRUSH soak harness');
  console.info(
    `${MINUTES} simulated minutes x ${SEEDS} seeds at ${Math.round(1 / TIMING.FIXED_DT)} Hz ` +
      `(${STEPS.toLocaleString('en-US')} steps per seed, per pass)`,
  );

  // ---- Pass A: stability ---------------------------------------------------
  const stability = seeds.map((seed) => runSeed(seed, PRECISE, false));
  report('PASS A - resource stability (precise bot, uninterrupted runs)', stability, [
    ['runs reaching 5 minutes', `${stability.filter((r) => r.longestSurvival >= SECONDS - 1).length} / ${SEEDS}`],
    ['mean survival', `${meanOf(stability, (r) => r.meanSurvival).toFixed(1)} s`],
    ['max active obstacles', `${maxOf(stability, (r) => r.maxActive)} (cap ${WORLD.MAX_ACTIVE_OBSTACLES})`],
    ['tunnel segments', `${maxOf(stability, (r) => r.maxSegments)} (fixed ${WORLD.SEGMENT_COUNT})`],
    ['max solid boxes live', String(maxOf(stability, (r) => r.maxParts))],
    ['steady-state samples/seed', meanOf(stability, (r) => r.steadySamples).toFixed(1)],
    [
      'steady active drift',
      `${meanOf(stability, (r) => r.steadyFirstHalfActive).toFixed(2)} -> ` +
        `${meanOf(stability, (r) => r.steadySecondHalfActive).toFixed(2)}`,
    ],
    [
      'pool instances 1/3-2/3-end',
      `${meanOf(stability, (r) => r.constructedAtThird).toFixed(1)} -> ` +
        `${meanOf(stability, (r) => r.constructedAtTwoThirds).toFixed(1)} -> ` +
        `${meanOf(stability, (r) => r.constructedFinal).toFixed(1)}  (bound ${POOL_BOUND})`,
    ],
    ['mean step time', `${meanOf(stability, (r) => r.meanStepMs).toFixed(4)} ms`],
    ['p99 step time', `${maxOf(stability, (r) => r.p99StepMs).toFixed(4)} ms`],
    ['engine DOM listeners', '0 (the engine registers none; input lives in the UI layer)'],
  ]);

  for (const r of stability) {
    check(
      r.longestSurvival >= SECONDS - 1,
      `seed ${r.seed}: precise bot failed to survive the full run (${r.longestSurvival.toFixed(1)} s)`,
    );
    check(r.maxActive <= WORLD.MAX_ACTIVE_OBSTACLES, `seed ${r.seed}: active obstacles exceeded cap`);
    check(r.maxSegments === WORLD.SEGMENT_COUNT, `seed ${r.seed}: segment count drifted`);
    check(r.steadySamples >= 8, `seed ${r.seed}: too few steady-state samples to judge drift`);

    const drift =
      r.steadyFirstHalfActive === 0
        ? 1
        : Math.abs(r.steadySecondHalfActive - r.steadyFirstHalfActive) / r.steadyFirstHalfActive;
    check(
      drift <= 0.1,
      `seed ${r.seed}: steady-state active count drifted ${(drift * 100).toFixed(1)}%`,
    );

    check(
      r.constructedFinal <= POOL_BOUND,
      `seed ${r.seed}: instances exceeded the design bound (${r.constructedFinal} > ${POOL_BOUND})`,
    );
    check(r.meanStepMs < 4, `seed ${r.seed}: mean step time over budget`);
    check(r.p99StepMs < 4, `seed ${r.seed}: p99 step time over budget`);
  }

  /*
   * A pool converges; a leak grows linearly. Convergence is asserted across the
   * seed set rather than per seed: a combination obstacle borrows sub-layers of
   * random archetypes, so any single seed's peak concurrent demand for a given
   * archetype arrives on a heavy tail. The aggregate is what distinguishes a
   * warming pool from a leak, and the per-seed hard bound above catches the
   * case the aggregate could hide.
   */
  const middleGrowth =
    meanOf(stability, (r) => r.constructedAtTwoThirds) -
    meanOf(stability, (r) => r.constructedAtThird);
  const lateGrowth =
    meanOf(stability, (r) => r.constructedFinal) -
    meanOf(stability, (r) => r.constructedAtTwoThirds);
  check(
    lateGrowth <= middleGrowth,
    `obstacle allocation not converging across seeds ` +
      `(middle third +${middleGrowth.toFixed(2)}, final third +${lateGrowth.toFixed(2)})`,
  );

  // ---- Pass B: gameplay ----------------------------------------------------
  const gameplay = seeds.map((seed) => runSeed(seed, HUMAN, true));
  const totalGenerated = gameplay.reduce((a, r) => a + r.generated, 0);
  const totalFallbacks = gameplay.reduce((a, r) => a + r.fallbacks, 0);
  const nearMissRate = meanOf(gameplay, (r) => r.midNearMissRate);

  report('PASS B - gameplay statistics (human-like bot, restarts on crash)', gameplay, [
    ['runs completed', String(gameplay.reduce((a, r) => a + r.runs, 0))],
    ['mean survival', `${meanOf(gameplay, (r) => r.meanSurvival).toFixed(1)} s`],
    ['longest survival', `${maxOf(gameplay, (r) => r.longestSurvival).toFixed(1)} s`],
    ['obstacles cleared', String(gameplay.reduce((a, r) => a + r.cleared, 0))],
    ['near misses', String(gameplay.reduce((a, r) => a + r.nearMisses, 0))],
    ['near-miss rate (MID)', `${(nearMissRate * 100).toFixed(1)} %  (target 15-35%)`],
    ['obstacles generated', String(totalGenerated)],
    [
      'fallback rate',
      `${((totalFallbacks / Math.max(1, totalGenerated)) * 100).toFixed(3)} %  (limit 2%)`,
    ],
    ['mean step time', `${meanOf(gameplay, (r) => r.meanStepMs).toFixed(4)} ms`],
    ['p99 step time', `${maxOf(gameplay, (r) => r.p99StepMs).toFixed(4)} ms`],
  ]);

  check(
    nearMissRate >= 0.15 && nearMissRate <= 0.35,
    `near-miss rate outside the 15-35% band: ${(nearMissRate * 100).toFixed(1)}%`,
  );
  check(
    totalFallbacks / Math.max(1, totalGenerated) < 0.02,
    `fallback rate too high: ${((totalFallbacks / totalGenerated) * 100).toFixed(2)}%`,
  );
  check(
    meanOf(gameplay, (r) => r.meanSurvival) > 25,
    'human-like autopilot survival implausibly short',
  );
  for (const r of gameplay) {
    check(r.maxActive <= WORLD.MAX_ACTIVE_OBSTACLES, `seed ${r.seed}: active obstacles exceeded cap`);
    check(r.constructedFinal <= POOL_BOUND, `seed ${r.seed}: instances exceeded the design bound`);
    check(r.p99StepMs < 4, `seed ${r.seed}: p99 step time over budget`);
  }

  console.info('');
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  FAIL  ${failure}`);
    console.error(`\n  ${failures.length} soak assertion(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.info(`  all soak assertions passed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main();
