// Kills a boss and captures its defeat (shatter debris, flashes). ZONE
export default async (page, H) => {
  const zone = process.env.ZONE || 'reef_arena', out = process.env.OUT || '/tmp/bd';
  await H.load('?manual=1'); await H.adv(60);
  await H.eval((zone) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 10; s.branches = { warrior: 'bulwark' }; g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true }); const w = g.world, p = w.player, b = w.boss, t = b.trigger; p.recalc(); p.invulnT = 99; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; w.snapCamera(); }, zone);
  await H.adv(120);
  for (let k = 0; k < 120; k++) { const act = await H.eval(() => { const g = window.__game, inp = g.input; if (g.playScene.dialogue?.active) { inp.inject('confirm', true); g.advance(1); inp.inject('confirm', false); g.advance(2); return true; } g.advance(6); return false; }); if (!act && k > 40) break; }
  await H.adv(240);
  await H.eval(() => { const b = window.__game.world.boss; b.hp = 1; b.engaged = true; b.takeHit({ dmg: 9999, dir: 1, kb: 0, poise: 0, crit: true }, window.__game.world.player); });
  for (let k = 0; k < 2000; k++) { const done = await H.eval(() => { const g = window.__game; g.advance(2); const b = g.world.boss; return b.alpha === 0 || (b.deathScript && g.playScene.dialogue?.active); }); if (done) break; }
  for (let i = 0; i < 12; i++) { await H.canvas(`${out}_${String(i).padStart(2, '0')}.png`); await H.adv(8); }
  console.log('[t]', JSON.stringify(await H.eval(() => { const b = window.__game.world.boss; return { fx: window.__game.world.fx.p.length, dying: b.dying }; })));
};
