export default async (page, H) => {
  const zone = process.env.ZONE || 'forest_heart', form = process.env.FORM || 'warrior';
  await H.load('?manual=1'); await H.adv(60);
  await H.eval(([zone, form]) => { const g = window.__game, s = g.state; s.form = form; s.level = 8; s.branches = { warrior: 'bulwark' }; g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; const b = g.world.boss, t = b.trigger; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; g.world.snapCamera(); }, [zone, form]);
  await H.adv(200);
  for (let i = 0; i < 20; i++) {
    const r = await H.eval(() => { const g = window.__game, w = g.world, b = w.boss, p = w.player, inp = g.input; const hb = b.hurtBox(); p.invulnT = 5; p.hp = p.stats.maxHp; p.x = hb.x + hb.w / 2 - 18; p.y = hb.y + hb.h / 2; p.vx = p.vy = 0; p.facing = 1; inp.inject('attack', true); g.advance(4); inp.inject('attack', false); g.advance(20); return [Math.round(b.hp), b.state, Math.round(b.armor ?? -1)]; });
    if (i % 4 === 0) console.log('[t]', JSON.stringify(r));
  }
};
