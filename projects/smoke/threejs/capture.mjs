// Usage: node capture.mjs [--from N] [--to N] [--out dir] [--url http://localhost:5173/]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({ options: {
  from: { type: 'string', default: '0' }, to: { type: 'string', default: '29' },
  out: { type: 'string', default: 'previews' }, url: { type: 'string', default: 'http://localhost:5173/' },
}});
mkdirSync(a.out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(a.url);
await page.evaluate(() => window.ready);
for (let i = +a.from; i <= +a.to; i++) {
  const png = await page.evaluate(async (f) => {
    await window.renderFrame(f);
    return document.querySelector('canvas').toDataURL('image/png');
  }, i);
  writeFileSync(`${a.out}/f_${String(i).padStart(4, '0')}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
console.log(await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return 'GL ' + (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}));
await browser.close();
