export default async (page, H) => {
  await page.goto('http://localhost:8124/index.html?manual=1');
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  const key = async (k, n = 1) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(2); };
  await H.adv(90); await H.canvas('/tmp/pt/01_title.png');
  console.log('[t] top', await H.eval(() => window.__game.engine.top?.constructor.name ?? window.__game.engine.stack?.at(-1)?.constructor.name));
  await key('Enter', 3); await H.adv(30); await H.canvas('/tmp/pt/02_after_enter.png');
  console.log('[t] top', await H.eval(() => window.__game.engine.stack?.at(-1)?.constructor.name));
  for (let i = 0; i < 8; i++) { await key('Enter', 3); await H.adv(40); }
  await H.canvas('/tmp/pt/03_intro.png');
  console.log('[t] top', await H.eval(() => window.__game.engine.stack?.at(-1)?.constructor.name));
};
