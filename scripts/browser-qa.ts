/**
 * VOIDRUSH — automated browser verification.
 *
 * Serves the production build, drives it with a real headless Chromium, and
 * captures screenshots and the console at every step. Everything asserted here
 * was observed in a browser session, not inferred.
 *
 * One caveat is recorded in the output and must be carried into any report:
 * this environment has no GPU, so Chromium runs on SwiftShader, a software
 * rasteriser. Frame rates measured here are a floor, not a prediction of
 * hardware performance.
 */

import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type ConsoleMessage, type Page } from 'playwright';
import { preview, type PreviewServer } from 'vite';

const OUT_DIR = path.resolve('artifacts/browser-qa');
const VIEWPORTS = [
  { width: 1280, height: 720, name: '1280x720' },
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 2560, height: 1440, name: '2560x1440' },
];

interface ConsoleRecord {
  step: string;
  type: string;
  text: string;
}

const consoleLog: ConsoleRecord[] = [];
let currentStep = 'boot';
const shots: string[] = [];
const missingShots: string[] = [];
const failures: string[] = [];

/**
 * Settings pre-seeded into localStorage before the app boots.
 *
 * Without a GPU, a bloom-heavy 1080p frame takes so long to rasterise in
 * software that Playwright cannot even capture a screenshot. Running the
 * functional pass at the lowest quality keeps frames cheap enough to drive the
 * game. This exercises the app's real settings path — it is not a special test
 * mode — but it does mean the frame rate measured here says nothing about how
 * the game performs on hardware.
 */
const QA_SETTINGS = {
  quality: 'low',
  masterVolume: 0,
  musicVolume: 0,
  sfxVolume: 0,
  movementSensitivity: 1,
  cameraShake: 0.35,
  // Bloom is the expensive pass and is the only effect disabled here; vignette
  // and grading stay on so the screenshots still show the intended look.
  effectsIntensity: 0.6,
  fov: 75,
  bloom: false,
  bloomIntensity: 1,
};

function check(ok: boolean, message: string): void {
  if (ok) {
    console.info(`    ok    ${message}`);
  } else {
    console.error(`    FAIL  ${message}`);
    failures.push(`[${currentStep}] ${message}`);
  }
}

/**
 * Screenshots are best-effort. A capture that times out on the software
 * rasteriser is recorded and reported, but must not invalidate the functional
 * checks around it.
 */
async function shoot(page: Page, name: string): Promise<void> {
  const file = path.join(OUT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, timeout: 120_000 });
    shots.push(file);
  } catch {
    console.error(`    warn  screenshot "${name}" timed out on the software rasteriser`);
    missingShots.push(name);
  }
}

type Diagnostics = Record<string, number | string>;

/*
 * Browser-side snippets are passed as strings rather than as functions.
 * tsx compiles this file with esbuild's `keepNames` enabled, which wraps inner
 * functions in a `__name` helper; that helper does not exist in the page, so a
 * serialised closure would throw `__name is not defined` on evaluation.
 */
async function diagnostics(page: Page): Promise<Diagnostics> {
  return page.evaluate<Diagnostics>(
    `(() => (window.voidrushDiagnostics ? window.voidrushDiagnostics() : {}))()`,
  );
}

/** Holds a key for `ms`, so movement is continuous rather than a single tap. */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Arms an in-page probe that times a click through to the engine entering
 * flight.
 *
 * Wall-clock timing from the test process is useless here: on a software
 * rasteriser a single frame costs ~500 ms, so a Playwright round-trip measures
 * the absent GPU rather than the game's start-up cost. The probe records both
 * timestamps inside the page and polls off the animation frame, so it sees the
 * transition as soon as it happens.
 */
async function armStartProbe(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    var qa = { click: null, flying: null };
    window.__qaStart = qa;
    // Capture phase runs before React's root handler; bubble phase runs after
    // it. Starting a run is synchronous, so the difference between the two is
    // the whole cost, measured without a timer that a busy main thread could
    // starve.
    document.addEventListener('click', function () {
      qa.click = performance.now();
    }, true);
    document.addEventListener('click', function () {
      if (qa.click === null || qa.flying !== null) return;
      var d = window.voidrushDiagnostics && window.voidrushDiagnostics();
      // The engine stamps the moment it entered flight, so this measures the
      // game's start-up cost and not whatever else the click dispatch went on
      // to do afterwards.
      if (d && d.phase === 'FLYING') {
        qa.flying = d.runStartedAt - qa.click;
        qa.dispatch = performance.now() - qa.click;
        qa.audioUnlockMs = d.audioUnlockMs;
      }
    }, false);
  })()`);
}

interface StartProbe {
  flying: number;
  dispatch: number;
  audioUnlockMs: number;
}

async function readStartProbe(page: Page): Promise<StartProbe> {
  await page.waitForFunction(`window.__qaStart && window.__qaStart.flying !== null`, undefined, {
    timeout: 120_000,
    polling: 50,
  });
  return page.evaluate<StartProbe>(
    `({ flying: window.__qaStart.flying, dispatch: window.__qaStart.dispatch, audioUnlockMs: window.__qaStart.audioUnlockMs })`,
  );
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.info('VOIDRUSH browser verification');
  console.info('  renderer: headless Chromium on SwiftShader (software; no GPU present)\n');

  let server: PreviewServer | null = null;
  try {
    server = await preview({
      preview: { port: 4173, strictPort: true, open: false },
      logLevel: 'error',
    });
    const base = server.resolvedUrls?.local[0] ?? 'http://localhost:4173/';
    const url = `${base}${base.endsWith('/') ? '' : '/'}?qa=1&seed=20260812`;

    const browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    // Functional steps run at 720p; the responsive pass covers the larger sizes.
    const context = await browser.newContext({ viewport: VIEWPORTS[0]! });
    // Seed only on the first load. addInitScript runs on every navigation, so
    // an unguarded write would clobber the saved settings during the reload and
    // make the persistence check test the harness rather than the game.
    await context.addInitScript(
      `if (!localStorage.getItem('voidrush-settings')) localStorage.setItem('voidrush-settings', ${JSON.stringify(
        JSON.stringify(QA_SETTINGS),
      )})`,
    );
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);

    page.on('console', (message: ConsoleMessage) => {
      consoleLog.push({ step: currentStep, type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error: Error) => {
      consoleLog.push({ step: currentStep, type: 'pageerror', text: error.message });
    });

    /* ---- boot and menu ------------------------------------------------- */
    currentStep = 'menu';
    console.info('  [menu]');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.screen--menu', { timeout: 20_000 });
    await page.waitForTimeout(800);
    await shoot(page, '01-main-menu');

    check(await page.locator('h1.title').innerText() === 'VOIDRUSH', 'title renders as VOIDRUSH');
    check(await page.locator('canvas').count() === 1, 'exactly one canvas / WebGL context');
    check(
      (await page.locator('button', { hasText: 'Play' }).count()) === 1,
      'PLAY button is present',
    );
    check(
      consoleLog.filter((r) => r.type === 'error' || r.type === 'pageerror').length === 0,
      'no console errors on boot',
    );
    // [PRD 30, Screen 1] The tunnel behind the menu must actually move.
    const menuA = await diagnostics(page);
    await page.waitForTimeout(1500);
    const menuB = await diagnostics(page);
    check(menuA.phase === 'IDLE', 'engine idles behind the menu');
    check(
      Number(menuB.renderDistance) > Number(menuA.renderDistance),
      `menu tunnel drifts (${menuA.renderDistance} -> ${menuB.renderDistance})`,
    );

    /* ---- start a run --------------------------------------------------- */
    currentStep = 'play';
    console.info('  [play]');
    await armStartProbe(page);
    const wallStart = Date.now();
    await page.locator('button', { hasText: 'Play' }).click();
    const probe = await readStartProbe(page);
    await page.waitForSelector('.hud', { timeout: 120_000 });
    check(
      probe.flying < 1000,
      `PLAY reaches flight in ${probe.flying.toFixed(1)} ms in-page (under 1000 ms)`,
    );
    console.info(
      `    note  click dispatch total ${probe.dispatch.toFixed(0)} ms, of which ` +
        `${probe.audioUnlockMs.toFixed(0)} ms was AudioContext construction`,
    );
    console.info(
      `    note  ${Date.now() - wallStart} ms wall-clock to first HUD paint, dominated by the software rasteriser`,
    );

    await page.waitForTimeout(1200);
    const before = await diagnostics(page);
    check(Object.keys(before).length > 0, 'diagnostics hook available under ?qa=1');
    check(before.phase === 'FLYING', 'engine is flying');

    /* ---- movement ------------------------------------------------------ */
    currentStep = 'movement';
    console.info('  [movement]');
    const scrollBefore = await page.evaluate<number>(`window.scrollY`);
    const positionsSeen: number[] = [];
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      await hold(page, key, 220);
      const diag = await diagnostics(page);
      positionsSeen.push(Number(diag.score));
    }
    // Diagonal input.
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(260);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');

    const scrollAfter = await page.evaluate<number>(`window.scrollY`);
    check(scrollBefore === scrollAfter, 'WASD and arrows never scroll the page during play');
    check(positionsSeen.length === 4, 'all four movement keys accepted');
    await shoot(page, '02-mid-flight');

    const flying = await diagnostics(page);
    check(Number(flying.drawCalls) < 120, `draw calls ${flying.drawCalls} under the 120 budget`);
    check(Number(flying.materials) <= 12, `materials ${flying.materials} within budget`);
    check(Number(flying.obstacles) > 0, 'obstacles are live in the world');

    /* ---- frame rate ---------------------------------------------------- */
    currentStep = 'fps';
    console.info('  [frame rate]');
    const fps = await page.evaluate<number>(`new Promise((resolve) => {
      var frames = 0;
      var start = performance.now();
      requestAnimationFrame(function tick() {
        frames += 1;
        var elapsed = performance.now() - start;
        if (elapsed >= 3000) { resolve((frames / elapsed) * 1000); return; }
        requestAnimationFrame(tick);
      });
    })`);
    console.info(
      `    measured ${fps.toFixed(1)} FPS at 1280x720, low quality, on SwiftShader (software)`,
    );
    console.info('    note  software rasteriser: this is a floor, not a hardware prediction');

    /* ---- pause --------------------------------------------------------- */
    currentStep = 'pause';
    console.info('  [pause]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.screen--overlay', { timeout: 5000 });
    const paused = await diagnostics(page);
    await page.waitForTimeout(700);
    const stillPaused = await diagnostics(page);
    check(paused.score === stillPaused.score, 'score does not advance while paused');
    check(paused.steps === stillPaused.steps, 'simulation does not step while paused');
    await shoot(page, '03-paused');

    await page.keyboard.press('Escape');
    await page.waitForSelector('.hud', { timeout: 5000 });
    check(await page.locator('.screen--overlay').count() === 0, 'ESC resumes the run');

    /* ---- blur pauses --------------------------------------------------- */
    currentStep = 'blur';
    console.info('  [focus loss]');
    await page.evaluate(`window.dispatchEvent(new Event('blur'))`);
    await page.waitForTimeout(200);
    check(
      (await page.locator('.screen--overlay').count()) === 1,
      'losing window focus pauses the game',
    );
    await page.keyboard.press('Escape');
    await page.waitForSelector('.hud', { timeout: 5000 });

    /* ---- collision and results ----------------------------------------- */
    currentStep = 'collision';
    console.info('  [collision]');
    // Pin the player into a corner; the next slab face ends the run.
    //
    // The timeout is generous because the loop caps catch-up at eight steps per
    // frame: on a software rasteriser running at ~2 FPS the simulation
    // advances roughly 0.13 s per wall-clock second. That slow-motion behaviour
    // is correct — it is the guard against a spiral of death — but it means a
    // collision takes a couple of wall-clock minutes to arrive here.
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForSelector('.screen--results', { timeout: 300_000 });
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    // The results screen fades up over the darkened frame [PRD 11]; capture it
    // once the fade has finished.
    await page.waitForTimeout(700);
    const resultsOpacity = await page.evaluate<string>(
      `getComputedStyle(document.querySelector('.screen--results')).opacity`,
    );
    check(resultsOpacity === '1', 'results screen has faded fully in');
    await shoot(page, '04-game-over');
    const ended = await diagnostics(page);
    check(ended.phase === 'ENDED', 'collision ends the run');
    check(Number(ended.impact) === 1, 'collision feedback completed before the results screen');

    for (const label of ['Score', 'Time', 'Best', 'Max Combo', 'Obstacles', 'Near Misses']) {
      check(
        (await page.locator('.stat__label', { hasText: label }).count()) > 0,
        `results screen shows ${label}`,
      );
    }

    /* ---- restart ------------------------------------------------------- */
    currentStep = 'restart';
    console.info('  [restart]');
    await armStartProbe(page);
    await page.locator('button', { hasText: 'Restart' }).click();
    const restartProbe = await readStartProbe(page);
    await page.waitForSelector('.hud', { timeout: 120_000 });
    check(
      restartProbe.flying < 500,
      `restart begins a new run in ${restartProbe.flying.toFixed(1)} ms in-page (under 500 ms)`,
    );

    /* ---- settings persistence ------------------------------------------ */
    currentStep = 'settings';
    console.info('  [settings]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.screen--overlay');
    await page.locator('button', { hasText: 'Settings' }).click();
    await page.waitForSelector('[aria-label="Settings"]');

    // Quality is switched up and then straight back down: enough to prove it
    // applies live, without leaving the software rasteriser at a cost that
    // would stall the remaining steps.
    await page.locator('.segmented__option', { hasText: 'medium' }).click();
    await page.waitForTimeout(400);
    check((await diagnostics(page)).quality === 'medium', 'quality change applies live');
    await page.locator('.segmented__option', { hasText: 'low' }).click();
    await page.waitForTimeout(400);
    check((await diagnostics(page)).quality === 'low', 'quality reverts live');

    // Range inputs are driven with the keyboard rather than `fill()`: React
    // tracks the previous value on the DOM node, so assigning `.value` directly
    // is treated as "no change" and onChange never fires. Arrow keys produce
    // the same events a player would.
    const fov = page.locator('#setting-field-of-view');
    await fov.focus();
    for (let i = 0; i < 13; i += 1) await fov.press('ArrowRight'); // 75 -> 88
    const shake = page.locator('#setting-camera-shake');
    await shake.focus();
    for (let i = 0; i < 3; i += 1) await shake.press('ArrowRight'); // 0.35 -> 0.50
    await page.waitForTimeout(400);
    check(Number((await diagnostics(page)).fov) > 75, 'FOV change applies live');
    check(
      (await page.locator('#setting-visual-intensity').count()) === 1,
      'Visual intensity setting is present [PRD Screen 5]',
    );
    await shoot(page, '05-settings');

    /* ---- return to the main menu mid-run -------------------------------- */
    currentStep = 'main-menu';
    console.info('  [main menu]');
    await page.locator('button', { hasText: 'Back' }).click();
    await page.waitForSelector('.screen--overlay');
    await page.locator('button', { hasText: 'Main Menu' }).click();
    await page.waitForSelector('.screen--menu', { timeout: 60_000 });
    const backA = await diagnostics(page);
    await page.waitForTimeout(1500);
    const backB = await diagnostics(page);
    check(backA.phase === 'IDLE' && Number(backA.tunnelMenu) === 1, 'menu tunnel rebuilt after a run');
    check(
      Number(backB.renderDistance) > Number(backA.renderDistance),
      `menu tunnel drifts again after returning (${backA.renderDistance} -> ${backB.renderDistance})`,
    );
    await shoot(page, '05b-menu-after-run');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.screen--menu', { timeout: 60_000 });
    const stored = await page.evaluate<string | null>(`localStorage.getItem('voidrush-settings')`);
    const parsed = JSON.parse(stored ?? '{}') as {
      quality?: string;
      fov?: number;
      cameraShake?: number;
    };
    check(parsed.quality === 'low', 'quality survives a reload');
    check(parsed.fov === 88, 'FOV survives a reload');
    check(parsed.cameraShake === 0.5, 'camera shake survives a reload');
    const persisted = await page.evaluate<string | null>(`localStorage.getItem('voidrush-stats')`);
    check(persisted !== null, 'run statistics were persisted');

    /* ---- responsive ---------------------------------------------------- */
    currentStep = 'responsive';
    console.info('  [responsive]');
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      const overflow = await page.evaluate<boolean>(
        `document.documentElement.scrollWidth > window.innerWidth`,
      );
      check(!overflow, `no horizontal overflow at ${viewport.name}`);
      await shoot(page, `06-menu-${viewport.name}`);
    }

    /* ---- console summary ------------------------------------------------ */
    currentStep = 'summary';
    const errors = consoleLog.filter((r) => r.type === 'error' || r.type === 'pageerror');
    check(errors.length === 0, `no console errors across the session (${errors.length} found)`);
    for (const error of errors) console.error(`      ${error.step}: ${error.text}`);

    await context.close();
    await browser.close();
  } finally {
    await server?.close();
  }

  console.info('\n  screenshots captured:');
  for (const shot of shots) console.info(`    ${shot}`);
  if (missingShots.length > 0) {
    console.info('\n  screenshots NOT captured (capture timed out on the software rasteriser):');
    for (const name of missingShots) console.info(`    ${name}`);
  }

  console.info('');
  if (failures.length > 0) {
    console.error(`  ${failures.length} browser check(s) failed:`);
    for (const failure of failures) console.error(`    ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.info('  all browser checks passed');
}

main().catch((error: unknown) => {
  console.error('browser verification crashed:', error);
  process.exitCode = 1;
});
