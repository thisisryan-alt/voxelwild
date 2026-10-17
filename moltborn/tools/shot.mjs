// Screenshot helper: node tools/shot.mjs "<path+query>" out.png [waitMs] [width] [height] [scriptFile]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [, , url = 'index.html', out = '/tmp/shot.png', wait = '1500', W = '1280', H = '720', script] = process.argv;
const server = await serve(8123);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
page.on('console', (m) => console.log('[console]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8123/' + url);
await page.waitForTimeout(+wait);
if (script) { const fn = (await import(script)).default; await fn(page); }
await page.screenshot({ path: out });
await browser.close(); server.close();
