export default async (page, H) => {
  await page.goto('http://localhost:8124/index.html?manual=1');
  await page.waitForFunction(() => window.__game);
  await H.adv(90);
  await H.canvas('/tmp/title.png');
  await H.load('?manual=1');
  await H.adv(60);
  const g = (fn, a) => H.eval(fn, a);
  for (const [i, n] of ['status', 'skills', 'abilities', 'evolution', 'items', 'quests', 'map', 'codex'].entries()) {
    await g((i) => { const G = window.__game; if (G.engine.top.constructor.name !== 'MenuScene') G.openMenu(i); else G.engine.top.tab = i; }, i);
    await H.adv(3);
    await H.canvas(`/tmp/menu_${n}.png`);
  }
};
