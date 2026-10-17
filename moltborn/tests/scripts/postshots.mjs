// Post-processing: each effect on and off, plus the transient ones (chromatic pulse, low health, ripple, vent haze). OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ps';
  const zones = (process.env.ZONES || 'reef_garden,forest_roots,abyss_vents,grave_shallows').split(',');
  await H.load('?manual=1'); await H.adv(30);
  const set = (o) => H.eval((o) => { Object.assign(window.__game.state.settings, o); }, o);
  const go = (z) => H.eval((z) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 10; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.world.player.invulnT = 99; }, z);
  const time = async (n) => H.eval((n) => { const t0 = performance.now(); window.__game.advance(n); return (performance.now() - t0) / n; }, n);
  const rows = [];
  for (const z of zones) {
    await go(z);
    await set({ bloom: 0, grading: 0, wobble: 0, scanlines: 0 }); await H.adv(40); const off = await time(60); await H.canvas(`${out}_${z}_off.png`);
    await set({ bloom: 0.6, grading: 0.8, wobble: 0.5 }); await H.adv(10); const on = await time(60); await H.canvas(`${out}_${z}_on.png`);
    rows.push({ z, offMs: +off.toFixed(2), onMs: +on.toFixed(2) });
  }
  console.log('[t] frame ms', JSON.stringify(rows));
  await go('reef_garden'); await set({ bloom: 0.6, grading: 0.8, wobble: 0.5 }); await H.adv(20);
  await H.eval(() => { window.__game.systems.post.kick(3); }); await H.adv(1); await H.canvas(`${out}_chroma.png`);
  await H.adv(30); await H.eval(() => { const p = window.__game.world.player; p.hp = Math.round(p.stats.maxHp * 0.12); }); await H.adv(70); await H.canvas(`${out}_lowhp.png`);
  await H.eval(() => { const g = window.__game, p = g.world.player; p.hp = p.stats.maxHp; g.world.shake(8); }); await H.adv(8); await H.canvas(`${out}_ripple.png`);
  const st = await H.eval(() => window.__game.systems.post.stats); console.log('[t] stats', JSON.stringify(st));
};
