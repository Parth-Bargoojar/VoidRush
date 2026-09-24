/**
 * VOIDRUSH — automated mobile/tilt verification.
 *
 * Serves the production build and drives it in headless Chromium emulating a
 * touch phone. Device orientation is synthesised: an in-page emitter dispatches
 * real `deviceorientation` events at ~60 Hz from a pose the script sets, and
 * `DeviceOrientationEvent.requestPermission` is stubbed to reproduce the iOS
 * permission flow (granted, denied) or removed to reproduce Android.
 *
 * What this proves: the tilt pipeline, permission handling, calibration,
 * orientation remapping, sensor-loss handling and fallbacks all work in a real
 * browser against the shipped bundle. What it cannot prove: how real sensors
 * on a real iPhone, iPad or Android device feel. That still needs hands.
 */

import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { preview, type PreviewServer } from 'vite';

const OUT_DIR = path.resolve('artifacts/mobile-qa');
const LANDSCAPE = { width: 780, height: 360 };
const PORTRAIT = { width: 360, height: 780 };

const QA_SETTINGS = {
  quality: 'low',
  masterVolume: 0,
  musicVolume: 0,
  sfxVolume: 0,
  cameraShake: 0,
  effectsIntensity: 0.4,
  fov: 75,
  bloom: false,
};

const failures: string[] = [];
const consoleErrors: string[] = [];
let step = 'boot';

function check(ok: boolean, message: string): void {
  if (ok) console.info(`    ok    ${message}`);
  else {
    console.error(`    FAIL  ${message}`);
    failures.push(`[${step}] ${message}`);
  }
}

async function shoot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), timeout: 60_000 });
  } catch {
    console.error(`    warn  screenshot "${name}" timed out`);
  }
}

type Diagnostics = Record<string, number | string>;

async function diag(page: Page): Promise<Diagnostics> {
  return page.evaluate<Diagnostics>(
    `(() => (window.voidrushDiagnostics ? window.voidrushDiagnostics() : {}))()`,
  );
}

async function waitFor(page: Page, expression: string, timeout = 60_000): Promise<boolean> {
  try {
    await page.waitForFunction(expression, undefined, { timeout, polling: 50 });
    return true;
  } catch {
    return false;
  }
}

const stateIs = (state: string): string =>
  `window.voidrushDiagnostics && window.voidrushDiagnostics().state === '${state}'`;

/**
 * Page-side harness, installed before the app boots:
 * - a permission stub matching `mode` (granted / denied / none = Android);
 * - an overridable screen angle, for simulating rotation;
 * - `__qaPose(roll, pitch)`: sets the screen-frame pose the emitter reports,
 *   converted to beta/gamma for the current screen angle;
 * - `__qaSensor(on)`: starts or stops the ~60 Hz event emitter.
 */
function harnessScript(mode: 'granted' | 'denied' | 'none'): string {
  return `(() => {
    window.__qaPermissionCalls = 0;
    ${
      mode === 'none'
        ? ''
        : `DeviceOrientationEvent.requestPermission = function () {
            window.__qaPermissionCalls += 1;
            return Promise.resolve('${mode}');
          };`
    }
    var original = Object.getOwnPropertyDescriptor(ScreenOrientation.prototype, 'angle');
    Object.defineProperty(ScreenOrientation.prototype, 'angle', {
      configurable: true,
      get: function () {
        return typeof window.__qaAngle === 'number' ? window.__qaAngle : original.get.call(this);
      },
    });
    var pose = { beta: 0, gamma: 0 };
    window.__qaPose = function (roll, pitch) {
      var angle = screen.orientation.angle;
      if (angle === 90) pose = { beta: roll, gamma: -pitch };
      else if (angle === 270) pose = { beta: -roll, gamma: pitch };
      else if (angle === 180) pose = { beta: -pitch, gamma: -roll };
      else pose = { beta: pitch, gamma: roll };
    };
    var timer = null;
    window.__qaSensor = function (on) {
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (!on) return;
      timer = setInterval(function () {
        window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
          alpha: 0, beta: pose.beta, gamma: pose.gamma, absolute: false,
        }));
      }, 16);
    };
    window.__qaRotate = function (angle) {
      window.__qaAngle = angle;
      screen.orientation.dispatchEvent(new Event('change'));
    };
  })()`;
}

async function newPhone(
  browser: Browser,
  mode: 'granted' | 'denied' | 'none',
  viewport = LANDSCAPE,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    `localStorage.setItem('voidrush-settings', ${JSON.stringify(JSON.stringify(QA_SETTINGS))})`,
  );
  await context.addInitScript(harnessScript(mode));
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`[${step}] ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`[${step}] ${error.message}`));
  return { context, page };
}

/** Holds a screen-frame pose for `ms` of wall time and returns the displacement. */
async function lean(page: Page, roll: number, pitch: number, ms: number): Promise<{ dx: number; dy: number }> {
  const before = await diag(page);
  await page.evaluate(`window.__qaPose(${roll}, ${pitch})`);
  await page.waitForTimeout(ms);
  const after = await diag(page);
  await page.evaluate(`window.__qaPose(0, 45)`);
  return {
    dx: Number(after.playerX) - Number(before.playerX),
    dy: Number(after.playerY) - Number(before.playerY),
  };
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  console.info('VOIDRUSH mobile / tilt verification (emulated touch device, synthetic sensor)\n');

  let server: PreviewServer | null = null;
  let browser: Browser | null = null;
  try {
    server = await preview({ preview: { port: 4174, strictPort: true, open: false }, logLevel: 'error' });
    const base = server.resolvedUrls?.local[0] ?? 'http://localhost:4174/';
    const url = `${base}${base.endsWith('/') ? '' : '/'}?qa=1&seed=424242`;
    browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });

    /* ---- iOS-style: permission granted -------------------------------- */
    step = 'ios-granted';
    console.info('  [iOS-style permission, granted]');
    {
      const { context, page } = await newPhone(browser, 'granted');
      await page.goto(url);
      check(await waitFor(page, stateIs('MENU')), 'boots to the main menu');
      let d = await diag(page);
      check(d.tiltStatus === 'needs-permission', `tilt waits for a gesture (status ${d.tiltStatus})`);
      check(d.control === 'tilt', 'AUTO resolves to tilt on a touch device');
      check(
        (await page.evaluate<number>('window.__qaPermissionCalls')) === 0,
        'no permission request on page load',
      );
      const hint = await page.locator('.menu__hint').innerText();
      check(/tilt to steer/i.test(hint), `menu hint describes tilt ("${hint.trim()}")`);
      await shoot(page, '01-menu-tilt');

      await page.evaluate(`window.__qaPose(0, 45)`);
      await page.evaluate(`window.__qaSensor(true)`);
      await page.getByRole('button', { name: /^play$/i }).tap();
      check(
        (await page.evaluate<number>('window.__qaPermissionCalls')) === 1,
        'PLAY requests motion permission exactly once',
      );
      check(await waitFor(page, `!!document.querySelector('.calibrate')`, 10_000), 'calibration overlay opens');
      const overlay = await page.locator('.calibrate').innerText();
      check(/calibrate tilt/i.test(overlay), 'overlay titled CALIBRATE TILT');
      check(/normal playing position/i.test(overlay), 'overlay explains the neutral position');
      await shoot(page, '02-calibrating');
      check(await waitFor(page, `!!document.querySelector('.calibrate__count')`, 20_000), 'countdown shown');
      check(await waitFor(page, stateIs('PLAYING'), 30_000), 'run starts after READY');
      d = await diag(page);
      check(d.tiltCalibrated === 1, 'tilt is calibrated');
      check(d.tiltStatus === 'active', 'sensor active');
      check((await page.locator('.touch-layer').count()) === 0, 'no joystick while tilt steers');
      check((await page.getByRole('button', { name: /pause the run/i }).count()) === 1, 'touch pause button present');

      const right = await lean(page, 15, 45, 1500);
      check(right.dx > 0.5, `tilting right moves right (dx ${right.dx.toFixed(2)})`);
      const left = await lean(page, -15, 45, 1500);
      check(left.dx < -0.5, `tilting left moves left (dx ${left.dx.toFixed(2)})`);
      const up = await lean(page, 0, 33, 1500);
      check(up.dy > 0.5, `tipping the top edge away climbs (dy ${up.dy.toFixed(2)})`);
      const down = await lean(page, 0, 57, 1500);
      check(down.dy < -0.5, `pulling the top edge back dives (dy ${down.dy.toFixed(2)})`);
      await shoot(page, '03-tilt-flight');

      // A run can end on an obstacle; restart so the remaining checks have one.
      if ((await diag(page)).state === 'GAME_OVER') {
        await page.getByRole('button', { name: /restart/i }).first().tap();
        await waitFor(page, stateIs('PLAYING'), 30_000);
      }

      step = 'ios-pause';
      await page.getByRole('button', { name: /pause the run/i }).tap();
      check(await waitFor(page, stateIs('PAUSED'), 10_000), 'pause button pauses');
      check(
        (await page.getByRole('button', { name: /recalibrate tilt/i }).count()) === 1,
        'pause menu offers Recalibrate tilt',
      );
      await shoot(page, '04-paused-tilt');
      await page.getByRole('button', { name: /recalibrate tilt/i }).tap();
      check(await waitFor(page, `!!document.querySelector('.calibrate')`, 10_000), 'recalibration opens from pause');
      check(
        await waitFor(page, `!document.querySelector('.calibrate') && !!document.querySelector('.modal--pause')`, 30_000),
        'recalibration returns to the pause menu',
      );
      await page.getByRole('button', { name: /^resume$/i }).tap();
      check(await waitFor(page, stateIs('PLAYING'), 10_000), 'resume goes straight back (still calibrated)');

      step = 'ios-rotate';
      await page.evaluate(`window.__qaRotate(270)`);
      check(await waitFor(page, stateIs('PAUSED'), 10_000), 'rotating mid-run pauses');
      d = await diag(page);
      check(d.tiltCalibrated === 0, 'rotation discards the neutral pose');
      const note = await page.locator('.pause-note').innerText().catch(() => '');
      check(/screen rotated/i.test(note), 'pause menu explains the rotation');
      await page.evaluate(`window.__qaPose(0, 45)`);
      await page.getByRole('button', { name: /^resume$/i }).tap();
      check(await waitFor(page, `!!document.querySelector('.calibrate')`, 10_000), 'resume recalibrates first');
      check(await waitFor(page, stateIs('PLAYING'), 30_000), 'then resumes');
      const rotated = await lean(page, 15, 45, 1500);
      check(rotated.dx > 0.5, `landscape-right mapping steers right (dx ${rotated.dx.toFixed(2)})`);

      if ((await diag(page)).state === 'GAME_OVER') {
        await page.getByRole('button', { name: /restart/i }).first().tap();
        await waitFor(page, stateIs('PLAYING'), 30_000);
      }

      step = 'ios-sensor-loss';
      await page.evaluate(`window.__qaSensor(false)`);
      check(await waitFor(page, stateIs('PAUSED'), 15_000), 'sensor loss pauses the run');
      d = await diag(page);
      check(d.tiltStatus === 'lost', `status reports lost (${d.tiltStatus})`);
      const lostNote = await page.locator('.pause-note').innerText().catch(() => '');
      check(/signal lost/i.test(lostNote), 'pause menu explains the lost signal');
      await shoot(page, '05-signal-lost');
      await page.getByRole('button', { name: /use touch controls/i }).tap();
      await page.waitForTimeout(300);
      d = await diag(page);
      check(d.control === 'keyboard' && d.tiltStatus === 'unavailable', 'falls back to touch for the session');
      await page.getByRole('button', { name: /^resume$/i }).tap();
      check(await waitFor(page, stateIs('PLAYING'), 10_000), 'resumes on touch');
      check((await page.locator('.touch-layer').count()) === 1, 'joystick appears as the fallback');

      step = 'ios-settings';
      await page.getByRole('button', { name: /pause the run/i }).tap();
      await waitFor(page, stateIs('PAUSED'), 10_000);
      await page.getByRole('button', { name: /^settings$/i }).tap();
      await page.getByRole('tab', { name: /controls/i }).tap();
      const controls = await page.locator('.tab-panel').innerText();
      for (const label of [
        'Control mode',
        'Tilt sensitivity',
        'Tilt dead zone',
        'Invert horizontal',
        'Invert vertical',
        'Recalibrate tilt',
      ]) {
        check(controls.toLowerCase().includes(label.toLowerCase()), `Controls tab has "${label}"`);
      }
      check(
        (await page.getByRole('button', { name: /retry tilt/i }).count()) === 1,
        'Settings offers to retry tilt after a failure',
      );
      await page.getByRole('switch', { name: /invert vertical/i }).tap();
      await page.getByRole('button', { name: /^tilt$/i }).tap();
      const stored = JSON.parse(
        (await page.evaluate<string | null>(`localStorage.getItem('voidrush-settings')`)) ?? '{}',
      ) as Record<string, unknown>;
      check(stored.tiltInvertY === true, 'Invert vertical persists');
      check(stored.controlMode === 'tilt', 'Control mode persists');
      check(stored.version === 2, 'settings saved with schema version 2');
      await shoot(page, '06-settings-controls');
      await context.close();
    }

    /* ---- iOS-style: permission denied --------------------------------- */
    step = 'ios-denied';
    console.info('  [iOS-style permission, denied]');
    {
      const { context, page } = await newPhone(browser, 'denied');
      await page.goto(url);
      await waitFor(page, stateIs('MENU'));
      await page.getByRole('button', { name: /^play$/i }).tap();
      check(await waitFor(page, stateIs('PLAYING'), 15_000), 'a refusal still starts the run');
      const d = await diag(page);
      check(d.tiltStatus === 'denied' && d.control === 'keyboard', 'falls back from tilt');
      check((await page.locator('.touch-layer').count()) === 1, 'joystick takes over');
      await page.getByRole('button', { name: /pause the run/i }).tap();
      await waitFor(page, stateIs('PAUSED'), 10_000);
      await page.getByRole('button', { name: /main menu/i }).tap();
      await waitFor(page, stateIs('MENU'), 10_000);
      const note = await page.locator('.menu__note').innerText().catch(() => '');
      check(/motion access denied/i.test(note), 'menu explains the refusal');
      await shoot(page, '07-denied-menu');
      await context.close();
    }

    /* ---- Android-style: no permission API, no sensor ------------------ */
    step = 'no-sensor';
    console.info('  [no permission API, no sensor behind it]');
    {
      const { context, page } = await newPhone(browser, 'none');
      await page.goto(url);
      await waitFor(page, stateIs('MENU'));
      check(
        await waitFor(page, `window.voidrushDiagnostics().tiltStatus === 'unavailable'`, 20_000),
        'a silent sensor is detected as unavailable',
      );
      const d = await diag(page);
      check(d.control === 'keyboard', 'control falls back');
      const hint = await page.locator('.menu__hint').innerText();
      check(/drag on the left/i.test(hint), 'menu hint switches to the joystick');
      check(/no tilt sensor/i.test(hint), 'menu explains why');
      await context.close();
    }

    /* ---- Android-style: sensor present, no permission needed ---------- */
    step = 'android';
    console.info('  [no permission API, sensor present]');
    {
      const { context, page } = await newPhone(browser, 'none');
      await page.goto(url);
      await page.evaluate(`window.__qaPose(0, 45)`);
      await page.evaluate(`window.__qaSensor(true)`);
      await waitFor(page, stateIs('MENU'));
      check(
        await waitFor(page, `window.voidrushDiagnostics().tiltStatus === 'active'`, 20_000),
        'listens without a prompt',
      );
      await page.getByRole('button', { name: /^play$/i }).tap();
      check(await waitFor(page, stateIs('PLAYING'), 30_000), 'calibrates and starts');
      const right = await lean(page, 15, 45, 1500);
      check(right.dx > 0.5, `tilt steers (dx ${right.dx.toFixed(2)})`);
      await context.close();
    }

    /* ---- Portrait: suggested, not required ---------------------------- */
    step = 'portrait';
    console.info('  [portrait]');
    {
      const { context, page } = await newPhone(browser, 'granted', PORTRAIT);
      await page.goto(url);
      await waitFor(page, stateIs('MENU'));
      const hint = await page.locator('.rotate-hint').innerText().catch(() => '');
      check(/rotate device/i.test(hint) && /best experience/i.test(hint), 'ROTATE DEVICE / FOR BEST EXPERIENCE shown');
      await shoot(page, '08-portrait-hint');
      await page.getByRole('button', { name: /dismiss/i }).tap();
      check((await page.locator('.rotate-hint').count()) === 0, 'hint dismisses');
      await page.evaluate(`window.__qaPose(0, 45)`);
      await page.evaluate(`window.__qaSensor(true)`);
      await page.getByRole('button', { name: /^play$/i }).tap();
      check(await waitFor(page, stateIs('PLAYING'), 30_000), 'portrait still plays');
      await context.close();
    }

    check(consoleErrors.length === 0, `no console errors (${consoleErrors.length} found)`);
    for (const error of consoleErrors) console.error(`          ${error}`);
  } finally {
    await browser?.close();
    await server?.httpServer.close();
  }

  console.info(`\n  screenshots: ${OUT_DIR}`);
  if (failures.length > 0) {
    console.error(`\n  ${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.info('\n  all mobile checks passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
