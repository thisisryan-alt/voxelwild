// Drive the game in headless Chromium: node tools/run.mjs script.mjs  (script exports default async (page, helpers))
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const script = process.argv[2];
const server = await serve(8124);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('[t]')) console.log('[console:' + m.type() + ']', t); });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.stack || e.message); });
const H = {
  async load(q = '') { await page.goto('http://localhost:8124/index.html' + (q.includes('quick') ? q : (q ? q + '&quick=1' : '?quick=1'))); await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 15000 }); },
  async adv(n) { await page.evaluate((n) => window.__game.advance(n), n); },
  async eval(fn, arg) { return page.evaluate(fn, arg); },
  async shot(path) { await page.screenshot({ path }); },
  async canvas(path) { const d = await page.evaluate(() => document.getElementById('game').toDataURL('image/png')); (await import('node:fs')).writeFileSync(path, Buffer.from(d.split(',')[1], 'base64')); },
};
try { await (await import(new URL(script, 'file://' + process.cwd() + '/').href)).default(page, H); } catch (e) { console.log('[script error]', e.stack || e); }
await browser.close(); server.close();
if (errors.length) process.exitCode = 1;
