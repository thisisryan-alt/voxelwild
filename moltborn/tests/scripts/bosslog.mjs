// Watch a boss cycle through its attacks against an invulnerable, stationary-ish player. ZONE, SECS
export default async (page, H) => {
  const zone = process.env.ZONE, secs = +(process.env.SECS || 40);
  await H.load('?manual=1'); await H.adv(30);
  await H.eval((zone) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 8; g.buildWorld(zone, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; const w = g.world, p = w.player, b = w.boss, t = b.trigger; p.recalc(); p.hp = p.stats.maxHp; p.x = (t.x + t.w * 0.25) * 16; p.y = (t.y + t.h - 3) * 16; w.snapCamera(); window.__seq = []; }, zone);
  for (let f = 0; f < 60 * secs; f += 15) {
    const r = await H.eval(() => { const g = window.__game, w = g.world, b = w.boss, p = w.player, inp = g.input; p.invulnT = 999; if (g.playScene.dialogue?.active) { inp.inject('confirm', true); g.advance(1); inp.inject('confirm', false); g.advance(2); return null; } g.advance(15); const s = window.__seq; const last = s[s.length - 1]; if (!last || last !== b.lastAtk + ':' + b.phaseIdx) s.push(b.lastAtk + ':' + b.phaseIdx); return [b.pose, b.state, Math.round(b.x), Math.round(b.y), b.engaged, b.staggerT > 0, b.hp]; });
    if (r && f % 120 === 0) console.log('[t]', f / 60, JSON.stringify(r));
  }
  console.log('[t] seq', JSON.stringify(await H.eval(() => window.__seq)));
};
