// Pearl Gauntlet: composition budget, three waves with a relic offer, then death and the summary. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ar';
  await H.load('?manual=1'); await H.adv(30);
  const comp = await H.eval(async () => { const m = await import('/src/systems/arena.js'); const { rng } = await import('/src/core/util.js'); const rows = []; for (const n of [1, 3, 6, 10, 15, 25]) { const l = m.composeWave(n, rng(n * 7)); rows.push([n, l.length, [...new Set(l)].slice(0, 5).join(',')]); } return { pool: m.ARENA_POOL.length, rows }; });
  console.log('[t] composition', JSON.stringify(comp));
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; s.bosses.grumbold = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.arena.start(); });
  await H.adv(60 * 5);
  const info = () => H.eval(() => { const g = window.__game, a = g.systems.arena; return { wave: a.run?.wave, state: a.run?.state, foes: g.world.enemies.filter((e) => e.alive).length, top: g.engine.top.constructor.name, zone: g.world.zone.id, pending: a.run?.pending }; });
  console.log('[t] wave1', JSON.stringify(await info())); await H.canvas(`${out}_wave1.png`);
  const wipe = () => H.eval(() => { const g = window.__game, w = g.world, p = w.player; p.invulnT = 99; for (let k = 0; k < 6; k++) for (const e of w.enemies) if (e.alive && !e.dying && !e.def.friendly) e.takeHit({ dmg: 9999, dir: 1, heavy: true, guardBreak: k > 3 }, p); });
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i < 12; i++) { await H.adv(60); await wipe(); const s = await info(); if (s.state === 'rest' || s.top === 'RelicScene') break; }
    const s = await info(); console.log('[t] cleared', n, JSON.stringify(s));
    if (s.top === 'RelicScene') { await H.canvas(`${out}_boon.png`); await H.adv(40); await H.eval(() => { window.__game.input.inject('confirm', true); }); await H.adv(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await H.adv(5); }
    await H.adv(60 * 4);
  }
  if ((await info()).top === 'RelicScene') { await H.canvas(`${out}_boon.png`); await H.adv(40); await H.eval(() => { window.__game.input.inject('confirm', true); }); await H.adv(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await H.adv(60 * 6); }
  console.log('[t] wave4', JSON.stringify(await info()), JSON.stringify(await H.eval(() => ({ relics: window.__game.state.riftRelics, best: window.__game.state.records.arenaBest, bonus: window.__game.systems.arena.run.bonus, elites: window.__game.world.enemies.filter((e) => e.affixes).length }))));
  await H.eval(() => { const g = window.__game, p = g.world.player; p.invulnT = 0; p.hp = 1; p.takeHit({ dmg: 999, x: p.x + 5, y: p.y }); });
  await H.adv(240); await H.canvas(`${out}_over.png`);
  console.log('[t] after', JSON.stringify(await H.eval(() => { const g = window.__game, s = g.state; return { zone: g.world.zone.id, top: g.engine.top.constructor.name, run: !!g.systems.arena.run, best: s.records.arenaBest, relics: s.riftRelics.length, alive: g.world.player.alive }; })));
};
