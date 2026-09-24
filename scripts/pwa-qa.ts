/**
 * VOIDRUSH — PWA verification.
 *
 * Serves the production build with `vite preview` and checks, in a real
 * headless Chromium: manifest and icons, Chromium's own installability verdict
 * (CDP `Page.getInstallabilityErrors`), service-worker registration and
 * precache contents, offline relaunch and play, localStorage persistence, the
 * update flow (never during a run, applied from pause, no reload loop), the
 * iOS install guide, resizing, and console errors.
 *
 * Headless Chromium never fires `beforeinstallprompt` and has no GPU, so the
 * Chromium install prompt itself and frame rates are out of scope here.
 *
 *   npm run e2e:pwa
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, type Page } from 'playwright';
import { preview } from 'vite';

const failures: string[] = [];
const passes: string[] = [];
const consoleErrors: string[] = [];

function check(ok: boolean, label: string, detail = ''): void {
  (ok ? passes : failures).push(detail ? `${label} — ${detail}` : label);
  console.info(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

const stateIs = (state: string): string =>
  `window.voidrushDiagnostics && window.voidrushDiagnostics().state === '${state}'`;

async function waitFor(page: Page, expression: string, timeout = 30_000): Promise<boolean> {
  try {
    await page.waitForFunction(expression, undefined, { timeout, polling: 100 });
    return true;
  } catch {
    return false;
  }
}

function pngSize(buffer: Buffer): [number, number] {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const QA_SETTINGS = { quality: 'low', bloom: false, masterVolume: 0 };
const SW_PATH = path.resolve('dist/sw.js');
const originalSw = await readFile(SW_PATH, 'utf8');

const server = await preview({
  preview: { port: 4174, strictPort: true, open: false },
  logLevel: 'error',
});
const base = 'http://localhost:4174/';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  // ---------------------------------------------------------------- manifest
  const manifest = (await (await fetch(`${base}manifest.webmanifest`)).json()) as {
    name: string;
    short_name: string;
    display: string;
    orientation: string;
    start_url: string;
    scope: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  check(manifest.name === 'VOIDRUSH' && manifest.short_name === 'VOIDRUSH', 'manifest names');
  check(manifest.display === 'standalone', 'manifest display standalone');
  check(manifest.orientation === 'landscape', 'manifest orientation landscape');
  check(
    new URL(manifest.start_url, `${base}manifest.webmanifest`).href === base &&
      new URL(manifest.scope, `${base}manifest.webmanifest`).href === base,
    'start_url and scope resolve to /',
  );
  check(manifest.theme_color === '#080a0f' && manifest.background_color === '#080a0f', 'colors');
  for (const icon of manifest.icons.filter((i) => i.src.endsWith('.png'))) {
    const response = await fetch(new URL(icon.src, base));
    const [w, h] = pngSize(Buffer.from(await response.arrayBuffer()));
    check(
      response.ok && `${w}x${h}` === icon.sizes,
      `icon ${icon.src} (${icon.purpose})`,
      `${w}x${h}`,
    );
  }
  for (const purpose of ['any', 'maskable']) {
    for (const size of ['192x192', '512x512']) {
      check(
        manifest.icons.some((i) => i.purpose === purpose && i.sizes === size),
        `has ${purpose} ${size} icon`,
      );
    }
  }
  const apple = await fetch(`${base}icons/apple-touch-icon-180.png`);
  check(apple.ok, 'apple-touch-icon served');

  // ------------------------------------------------- install + service worker
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(
    `if (!localStorage.getItem('voidrush-settings')) localStorage.setItem('voidrush-settings', ${JSON.stringify(JSON.stringify(QA_SETTINGS))});`,
  );
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  await page.goto(`${base}?qa=1`);
  check(await waitFor(page, stateIs('MENU')), 'boots to main menu');
  const swReady = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active!;
    if (worker.state !== 'activated') {
      await new Promise((resolve) => worker.addEventListener('statechange', resolve));
    }
    return worker.state;
  });
  check(swReady === 'activated', 'service worker activated', swReady);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  check(
    installabilityErrors.length === 0,
    'Chromium installability check',
    installabilityErrors.map((e) => e.errorId).join(', ') || 'no errors',
  );

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  for (const needle of ['/index.html', '/assets/three-', '/assets/index-', '.css', '/icons/icon-512.png']) {
    check(cached.some((url) => url.includes(needle)), `precached ${needle}`);
  }

  // Control the page (first load is uncontrolled by design: clientsClaim off).
  await page.reload();
  await waitFor(page, stateIs('MENU'));
  check(await page.evaluate(() => navigator.serviceWorker.controller !== null), 'page controlled after reload');

  // Persist something through the real settings path.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('voidrush-settings') ?? '{}') as object;
    localStorage.setItem('voidrush-settings', JSON.stringify({ ...raw, fov: 90 }));
  });

  // ------------------------------------------------------------------ offline
  await context.setOffline(true);
  await page.reload();
  check(await waitFor(page, stateIs('MENU')), 'offline relaunch reaches main menu');
  await page.goto(`${base}?qa=1&seed=offline-check`);
  check(await waitFor(page, stateIs('MENU')), 'offline launch with a new query URL (navigation fallback)');
  await page.goto(`${base}?qa=1`);
  await waitFor(page, stateIs('MENU'));
  const fov = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('voidrush-settings') ?? '{}') as { fov?: number }).fov,
  );
  check(fov === 90, 'localStorage settings persist across offline relaunch');

  await page.getByRole('button', { name: 'Play' }).click();
  check(await waitFor(page, stateIs('PLAYING')), 'offline run starts');
  await page.keyboard.down('a');
  await page.waitForTimeout(600);
  await page.keyboard.up('a');
  await page.keyboard.press('Escape');
  check(await waitFor(page, stateIs('PAUSED')), 'Escape pauses offline run');
  await page.keyboard.press('Escape');
  await waitFor(page, stateIs('PLAYING'));
  await context.setOffline(false);

  // ------------------------------------------------------------------- update
  // Simulate a new deployment: a changed sw.js is a new worker version.
  await writeFile(SW_PATH, `${originalSw}\n// qa-deploy ${Date.now()}\n`);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  const waiting = await waitFor(
    page,
    `navigator.serviceWorker.getRegistration().then(r => !!(r && r.waiting))`,
  );
  check(waiting, 'new version installs and waits');
  await page.waitForTimeout(1000);
  check(
    (await page.evaluate<boolean>(stateIs('PLAYING'))) &&
      (await page.locator('.pwa-banner').count()) === 0,
    'no update banner during an active run',
  );
  await page.keyboard.press('Escape');
  await waitFor(page, stateIs('PAUSED'));
  const banner = page.locator('.pwa-banner');
  check(await banner.isVisible({ timeout: 5000 }).catch(() => false), 'update banner shown when paused');
  check(
    (await banner.textContent())?.includes('Updating ends the current run') ?? false,
    'pause banner warns the run will end',
  );
  const before = navigations;
  await banner.getByRole('button', { name: 'Update' }).click();
  await waitFor(page, stateIs('MENU'));
  await page.waitForTimeout(3000);
  check(navigations - before === 1, 'update reloads exactly once', `${navigations - before} navigation(s)`);
  check(
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !registration?.waiting && navigator.serviceWorker.controller !== null;
    }),
    'new worker controls the page',
  );
  check((await page.locator('.pwa-banner').count()) === 0, 'banner gone after update');

  // ------------------------------------------------------------------- resize
  await page.setViewportSize({ width: 900, height: 500 });
  await page.waitForTimeout(500);
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    return [Math.round(c.width), Math.round(c.height)];
  });
  check(canvas[0] === 900 && canvas[1] === 500, 'canvas follows window resize', canvas.join('x'));
  check(
    (await page.locator('.pwa-install').count()) === 0,
    'no install button without beforeinstallprompt (desktop headless)',
  );
  await context.close();

  // ------------------------------------------------------------- iOS guidance
  const ios = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const iosPage = await ios.newPage();
  await iosPage.goto(`${base}?qa=1`);
  await waitFor(iosPage, stateIs('MENU'));
  const install = iosPage.locator('.pwa-install');
  check(await install.isVisible().catch(() => false), 'iOS shows Install VOIDRUSH action');
  await install.click();
  check(
    await iosPage.getByText('Add to Home Screen').isVisible().catch(() => false),
    'iOS install guide opens on request',
  );
  await ios.close();

  // Portrait does not break.
  const portrait = await browser.newContext({ ...devices['Pixel 7'] });
  const portraitPage = await portrait.newPage();
  await portraitPage.goto(`${base}?qa=1`);
  check(await waitFor(portraitPage, stateIs('MENU')), 'portrait phone boots');
  check(
    await portraitPage.getByText(/rotate/i).first().isVisible().catch(() => false),
    'portrait shows rotate hint',
  );
  await portrait.close();

  check(consoleErrors.length === 0, 'no console errors', consoleErrors.join(' | '));
} finally {
  await writeFile(SW_PATH, originalSw);
  await browser.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}

const summary = `\n${passes.length} passed, ${failures.length} failed\n`;
console.info(summary);
await appendFile(path.resolve('artifacts/pwa-qa.log'), `${new Date().toISOString()}${summary}${failures.join('\n')}\n`).catch(
  () => undefined,
);
process.exit(failures.length === 0 ? 0 : 1);
