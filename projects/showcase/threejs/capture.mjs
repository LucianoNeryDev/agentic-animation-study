// Usage: node capture.mjs [--from N] [--to N] [--frames a,b,c] [--out dir] [--url http://localhost:5173/]
// Renders frames through window.renderFrame and saves them as out/f_NNNN.png.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({ options: {
  from: { type: 'string', default: '0' }, to: { type: 'string', default: '419' },
  frames: { type: 'string' },
  out: { type: 'string', default: 'previews' }, url: { type: 'string', default: 'http://localhost:5173/' },
}});
const list = a.frames ? a.frames.split(',').map(Number)
  : Array.from({ length: +a.to - +a.from + 1 }, (_, i) => +a.from + i);
mkdirSync(a.out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(a.url);
await page.evaluate(() => window.ready);
console.log(await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return 'GL ' + (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}));
const t0 = Date.now();
for (const i of list) {
  const png = await page.evaluate(async (f) => {
    await window.renderFrame(f);
    return document.querySelector('canvas').toDataURL('image/png');
  }, i);
  writeFileSync(`${a.out}/f_${String(i).padStart(4, '0')}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
console.log(`${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
