export default async (page, H) => {
  await page.goto('http://localhost:8124/index.html?manual=1'); await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(4); };
  const shot = (n) => H.canvas(`/tmp/ui_${n}.png`);
  await H.adv(90); await tap('ArrowDown'); await tap('ArrowDown'); await tap('Enter'); await H.adv(20); await shot('controls');
  await tap('Escape'); await H.adv(10); await tap('ArrowUp'); await tap('Enter'); await H.adv(20); await shot('options');
  await tap('Escape'); await H.adv(10);
  // start a game with some progress
  await H.eval(() => { const g = window.__game; g.newGame(0); });
  await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.level = 9; s.ep = 6; s.sp = 4; s.coins = 480; s.inv = { kelp_wrap: 3, brine_tonic: 2, brine_core: 1, brineguard_key: 1, black_pearl: 2, mp1: 1, mp3: 1 }; s.slots = ['bubbleShot', null, null]; s.abilities = ['bubbleShot']; s.skills = { claw1: true, claw2: true, shell1: true }; for (const z of ['reef_nursery', 'reef_garden', 'reef_hollow', 'forest_edge']) s.visited[z] = true; g.systems.codex.unlock?.('mural_nursery'); });
  await tap('Escape'); await H.adv(20); await shot('pause'); await tap('Escape'); await H.adv(10);
  await tap('Tab'); await H.adv(10);
  const names = ['status', 'skills', 'ability', 'evolve', 'items', 'quests', 'map', 'codex'];
  for (const n of names) { await shot('tab_' + n); await tap('KeyE'); await H.adv(8); }
  await tap('Escape'); await H.adv(10);
  await H.eval(() => { const g = window.__game; g.openShop('cowrie', () => {}); }); await H.adv(20); await shot('shop'); await tap('Escape'); await H.adv(10);
  await H.eval(() => { const g = window.__game; g.openForge(() => {}); }); await H.adv(20); await shot('forge'); await tap('Escape'); await H.adv(10);
};
