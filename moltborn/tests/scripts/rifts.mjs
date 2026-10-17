// A full Tidal Rift: start, clear four depths with relic choices, victory payout, then a second run that ends in death. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/rf';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  const step = async (n) => { await H.adv(n); };
  const info = () => H.eval(() => { const g = window.__game, r = g.systems.rifts, w = g.world; return { zone: w.zone.id, run: r.run && { depth: r.run.depth, cleared: r.run.cleared, picking: r.run.picking }, top: g.engine.top.constructor.name, foes: w.enemies.filter((e) => e.alive && !e.def.friendly).length, relics: [...(g.state.riftRelics || [])], coins: g.state.coins }; });
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 12; s.bosses.grumbold = true; for (const z of ['reef_garden', 'forest_roots', 'kingdom_gate']) s.visited[z] = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; });
  await H.eval(() => { const g = window.__game; g.systems.achievements.timer = -999; window.__start = { coins: g.state.coins, xp: g.state.xp + g.state.level * 1000 }; g.systems.rifts.start({ tier: 'shallow', seed: 4242 }); });
  await step(70); log.push(['start', await info()]);
  await H.canvas(`${out}_depth1.png`);
  for (let d = 1; d <= 4; d++) {
    // wipe the chamber
    await H.eval(() => { const g = window.__game, w = g.world, p = w.player; p.invulnT = 99; for (let k = 0; k < 6; k++) for (const e of w.enemies) if (!e.def.friendly && e.alive && !e.dying) e.takeHit({ dmg: 9999, dir: 1, heavy: true, guardBreak: k > 3 }, p); });
    await step(120);
    const i1 = await info(); log.push(['cleared d' + d, i1]);
    if (d < 4) {
      if (i1.top !== 'RelicScene') { log.push(['NO RELIC SCENE', i1]); break; }
      if (d === 1) await H.canvas(`${out}_relic.png`);
      await step(40); await H.eval(() => { const g = window.__game; g.input.inject('confirm', true); }); await step(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await step(5);
      // leave through the exit
      await H.eval(() => { const g = window.__game, w = g.world, p = w.player, ex = w.zone.exits[0]; p.x = ex.x + ex.w / 2; p.y = ex.y + ex.h / 2; });
      await step(90);
    }
  }
  await step(200); const fin = await info(); log.push(['after victory', fin]);
  await H.canvas(`${out}_summary.png`);
  await H.eval(() => { const g = window.__game; g.engine.top.t = 1; g.input.inject('confirm', true); }); await step(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await step(5);
  const after = await H.eval(() => { const g = window.__game, s = g.state; return { zone: g.world.zone.id, top: g.engine.top.constructor.name, coinsGain: s.coins - window.__start.coins, rifts: s.records.rifts, best: s.records.riftBest, relics: s.riftRelics.length, run: !!g.systems.rifts.run, sp: s.flags.rift_first_shallow, visited: Object.keys(s.visited).filter((z) => z.startsWith('rift')).length, zonesTemp: Object.keys(s.zones).filter((z) => z.startsWith('rift')).length, ing: Object.keys(s.inv).filter((k) => ['kelp_frond', 'brine_salt', 'urchin_spine', 'jelly_gel', 'ink_sac', 'fin_scale', 'glow_spore', 'bone_dust', 'ember_ash', 'shell_chip'].includes(k)).length }; });
  log.push(['hub after', after]);
  // second run: die in depth 1
  await H.eval(() => { const g = window.__game; g.state.coins = 500; g.systems.rifts.start({ tier: 'shallow', seed: 77 }); }); await step(70);
  await H.eval(() => { const g = window.__game, p = g.world.player; p.invulnT = 0; p.hp = 1; p.takeHit({ dmg: 999, x: p.x + 5, y: p.y }); });
  await step(200); log.push(['after death', await H.eval(() => { const g = window.__game, s = g.state; return { zone: g.world.zone.id, top: g.engine.top.constructor.name, coins: s.coins, run: !!g.systems.rifts.run, alive: g.world.player.alive, best: s.records.riftBest }; })]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
