// Walks the hidden entrances of the optional zones: break the cracked wall with real heavy attacks, pass the exit, come back.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const cases = [
    { from: 'reef_hollow', plug: [20, 8], stand: [18, 9], to: 'reef_tidepools', form: 'warrior' },
    { from: 'forest_roots', plug: [98, 14], stand: [97, 17], to: 'forest_grotto', form: 'warrior' },
    { from: 'kingdom_gate', plug: [41, 40], stand: [44, 41], to: 'kingdom_vaults', form: 'warrior', face: -1 },
  ];
  const only = process.env.CASE;
  for (const [ci, c] of cases.entries()) {
    if (only !== undefined && +only !== ci) continue;
    const r = await H.eval(async (c) => {
      const g = window.__game, s = g.state; g.systems.story.queue.length = 0; while (g.engine.top && g.engine.top !== g.playScene && g.engine.scenes.length > 1) g.engine.pop(); s.form = c.form; s.level = 14; s.branches = { warrior: 'bulwark' };
      g.buildWorld(c.from, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; const w = g.world, p = w.player; p.recalc(); p.hp = p.stats.maxHp; w.enemies.length = 0;
      const gr = w.grid; let y = c.stand[1]; while (y < gr.h - 1 && !gr.solid(c.stand[0], y + 1)) y++;     // drop to the floor below the stand column
      p.x = (c.stand[0] + 0.5) * 16; p.y = (y + 1) * 16 - p.h / 2 - 1; p.vx = p.vy = 0; p.facing = c.face || 1; p.invulnT = 999; w.snapCamera();
      const cnt = () => { let n = 0; for (let yy = c.plug[1] - 8; yy <= c.plug[1] + 8; yy++) for (let xx = c.plug[0] - 3; xx <= c.plug[0] + 3; xx++) if (gr.get(xx, yy) === 20) n++; return n; }; const n0 = cnt(); let hits = 0; const inp = g.input;
      for (let k = 0; k < 12 && cnt() === n0; k++) { p.facing = c.face || 1; inp.inject('heavy', true); g.advance(70); inp.inject('heavy', false); g.advance(30); hits++; }
      const broke = cnt() < n0;
      const ex = w.zone.exits.find((e) => e.to === c.to); if (!ex) return { ...c, broke, err: 'no exit' };
      p.x = ex.x + ex.w / 2; p.y = ex.y + ex.h / 2; g.advance(200);
      return { from: c.from, to: c.to, broke, hits, now: g.world.zone.id };
    }, c);
    console.log('[t]', JSON.stringify(r));
  }
};
