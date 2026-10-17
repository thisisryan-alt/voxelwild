// Bounty board in the browser: open the Tide Board, see today's bounties, finish one by growing the records, claim it, reroll another.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/bn';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.bosses.grumbold = true; s.coins = 300; s.records.kills = { pinchling: 20, minnow: 8, hermit: 5, urchin: 3, venomjelly: 4 }; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; });
  await H.adv(20);
  const log = [];
  // open through the real board interactable instead of constructing scenes by hand
  await H.eval(async () => { const m = await import('/src/ui/board_scene.js'); const g = window.__game; while (g.engine.scenes.length > 1) g.engine.pop(); g.engine.push(new m.BoardScene(g)); });
  await H.adv(5); await H.canvas(`${out}_board.png`);
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  // select Hunt Bounties (the 6th entry) and open it
  for (let i = 0; i < 5; i++) await press('down');
  await press('confirm'); await H.adv(5);
  log.push(['top', await H.eval(() => window.__game.engine.top.constructor.name)]);
  await H.canvas(`${out}_list.png`);
  const before = await H.eval(() => window.__game.systems.bounties.state.list.map((b) => ({ id: b.id, kind: b.kind, target: b.target, n: b.n, coins: b.coins, label: window.__game.systems.bounties.label(b) })));
  log.push(['board', before]);
  // finish the first one by growing its counter, then claim
  await H.eval(() => { const g = window.__game, b = g.systems.bounties.state.list[0]; const r = g.state.records; if (b.kind === 'hunt') r.kills[b.target] = (r.kills[b.target] || 0) + b.n; else { const path = { chests: 'chests', forage: 'forage', crafted: 'crafted', elites: 'elites', rifts: 'rifts', gauntlet: 'arenaKills', dashes: 'dashes', rests: 'rests', crits: 'crits', healed: 'healed' }[b.target]; r[path] += b.n; } window.__c0 = g.state.coins; });
  await H.adv(70); await H.canvas(`${out}_ready.png`);
  await press('confirm'); await H.adv(10);
  log.push(['claimed', await H.eval(() => ({ gain: window.__game.state.coins - window.__c0, claimed: window.__game.systems.bounties.state.list[0].claimed, xp: window.__game.state.xp }))]);
  // reroll the second one
  await press('down'); const id1 = await H.eval(() => window.__game.systems.bounties.state.list[1].id); await press('menu'); await H.adv(5);
  log.push(['reroll', await H.eval((id1) => ({ changed: window.__game.systems.bounties.state.list[1].id !== id1, coins: window.__game.state.coins }), id1)]);
  await H.canvas(`${out}_after.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
