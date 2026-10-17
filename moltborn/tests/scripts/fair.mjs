// Fair-fight bot (no cheating heals): reactive dodge-dash + pinch. ZONE, FORM, LEVEL, RUNS.
export default async (page, H) => {
  const zone = process.env.ZONE || 'reef_arena', form = process.env.FORM || 'shore', lvl = +(process.env.LEVEL || 5), runs = +(process.env.RUNS || 3);
  await H.load('?manual=1'); await H.adv(60); const SK = (process.env.SKILLS || '').split(',').filter(Boolean); await H.eval((k) => { window.__skills = k; }, SK);
  for (let r = 0; r < runs; r++) {
    await H.eval(([zone, form, lvl]) => {
      const g = window.__game, s = g.state;
      s.form = form; s.level = lvl; s.sp = 0; s.skills = Object.fromEntries((window.__skills || []).map((k) => [k, true])); s.inv.kelp_wrap = 2; s.bosses = {};
      s.branches = form === 'warrior' ? { warrior: 'bulwark' } : s.branches;
      g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; p.tide = p.stats.maxTide;
      const b = g.world.boss, t = b.trigger; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; g.world.snapCamera(); window.__t0 = g.engine.time; window.__heal = 0;
    }, [zone, form, lvl]);
    let res = null;
    for (let f = 0; f < 60 * 240 && !res; f += 6) {
      res = await H.eval(() => {
        const g = window.__game, w = g.world, b = w.boss, p = w.player, inp = g.input;
        if (!b || b.dying || !b.alive) return { win: true, t: +(g.engine.time - window.__t0).toFixed(1), hp: Math.round(p.hp), heals: window.__heal };
        if (!p.alive || p.hp <= 0) return { win: false, t: +(g.engine.time - window.__t0).toFixed(1), bhp: Math.round(b.hp), heals: window.__heal };
        if (g.playScene.dialogue?.active) { inp.inject('confirm', true); g.advance(1); inp.inject('confirm', false); g.advance(2); return null; }
        const dx = b.x - p.x, dy = b.y - p.y, near = Math.abs(dx) < 60 && Math.abs(dy) < 50;
        const danger = b.engaged && (b.state === 'attack' || w.projectiles.some((q) => q.hostile !== false && Math.hypot(q.x - p.x, q.y - p.y) < 50));
        const dashOK = p.dashCd === undefined || p.dashCd <= 0;
        for (const k of ['left', 'right', 'up', 'down', 'attack', 'dash', 'block', 'jump', 'heal']) inp.inject(k, false);
        if (p.hp < p.stats.maxHp * 0.35 && g.state.inv.kelp_wrap > 0 && !danger) { inp.inject('heal', true); window.__heal++; }
        else if (danger && near && dashOK) { inp.inject('dash', true); inp.inject(dx > 0 ? 'left' : 'right', true); }
        else { inp.inject(dx < -28 ? 'left' : dx > 28 ? 'right' : '', true); if (dy < -24) inp.inject('jump', true); inp.inject('attack', near && !danger && (g.engine.time * 8 | 0) % 2 === 0); }
        g.advance(6); return null;
      });
    }
    if (!res) res = await H.eval(() => { const w = window.__game.world, b = w.boss, p = w.player; return { timeout: true, b: b && [Math.round(b.x), Math.round(b.y), b.hp, b.engaged, b.state, b.phaseIdx], p: [Math.round(p.x), Math.round(p.y), Math.round(p.hp)] }; });
    console.log('[t] run', r, JSON.stringify(res));
  }
};
