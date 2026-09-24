import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
const info = await page.evaluate(() => {
  const c = document.getElementById('c');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { webgl: false };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    webgl: true,
    version: gl.getParameter(gl.VERSION),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
  };
});
console.log('PROBE_RESULT', JSON.stringify(info));
await browser.close();
