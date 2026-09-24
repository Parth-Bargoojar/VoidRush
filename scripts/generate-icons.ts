/**
 * VOIDRUSH — PWA icon pipeline.
 *
 * Rasterises the brand SVGs in public/ into the PNG sizes launchers need
 * (Android/Chromium want 192 and 512, iOS wants a 180 apple-touch-icon and
 * ignores SVG). Uses the Playwright Chromium already in devDependencies, so no
 * image library is added. Re-run after changing an icon SVG:
 *
 *   npm run icons
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const PUBLIC = path.resolve('public');

const TARGETS = [
  { source: 'icon.svg', out: 'icons/icon-192.png', size: 192 },
  { source: 'icon.svg', out: 'icons/icon-512.png', size: 512 },
  { source: 'icon-maskable.svg', out: 'icons/icon-maskable-192.png', size: 192 },
  { source: 'icon-maskable.svg', out: 'icons/icon-maskable-512.png', size: 512 },
  // iOS masks its own rounded corners, so the touch icon uses the safe-zone art.
  { source: 'icon-maskable.svg', out: 'icons/apple-touch-icon-180.png', size: 180 },
  { source: 'icon.svg', out: 'icons/favicon-32.png', size: 32 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { source, out, size } of TARGETS) {
    const svg = await readFile(path.join(PUBLIC, source), 'utf8');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:#080a0f}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await writeFile(path.join(PUBLIC, out), await page.screenshot({ type: 'png' }));
    console.info(`wrote public/${out}`);
  }
} finally {
  await browser.close();
}
