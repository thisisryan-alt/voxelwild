// Fuzz: every zone, random form/level, random inputs incl. abilities and interact, checking for exceptions, NaN positions and runaway entity counts.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const seed = +(process.env.SEED || 1), frames = +(process.env.FR || 1500);
  const res = await H.eval(async ([seed, frames]) => {
    const g = window.__game, { ZONE_IDS, buildZone } = await import('/src/data/zones.js'); const inp = g.input;
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const forms = [['shore', {}], ['warrior', { warrior: 'bulwark' }], ['abyssal', { warrior: 'duelist', abyssal: 'lumen' }], ['leviathan', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tidebreaker' }], ['mythic', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }]];
    const acts = ['left', 'right', 'up', 'down', 'jump', 'attack', 'heavy', 'dash', 'block', 'ab1', 'ab2', 'ab3', 'ult', 'interact', 'heal'];
    const problems = [];
    for (const id of ZONE_IDS) {
      const [f, br] = forms[Math.floor(rnd() * forms.length)], st = g.state; st.form = f; st.branches = br; st.level = 4 + Math.floor(rnd() * 22); st.abilities = ['bubbleShot', 'shellSlam', 'riposte'].filter(() => rnd() < 0.7); st.slots = [st.abilities[0] || null, st.abilities[1] || null, null];
      try { const z = buildZone(id); g.buildWorld(id, Object.keys(z.entries)[Math.floor(rnd() * Object.keys(z.entries).length)], { silentBanner: true }); } catch (e) { problems.push(`${id} build: ${e.message}`); continue; }
      const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; p.invulnT = 0; let held = {};
      for (let fr = 0; fr < frames; fr += 8) {
        if (g.engine.scenes.length > 1) { while (g.engine.scenes.length > 1) g.engine.pop(); }
        if (g.playScene.dialogue.active) { inp.inject('confirm', true); g.advance(1); inp.inject('confirm', false); }
        for (const a of acts) { if (rnd() < 0.12) held[a] = !held[a]; inp.inject(a, !!held[a]); }
        if (!p.alive || p.hp <= 0) { p.hp = p.stats.maxHp; }
        try { g.advance(8); } catch (e) { problems.push(`${id} f${fr}: ${e.message}`); break; }
        const w = g.world; if (!w || w.zone.id !== id) { if (w && w.zone.id !== id) { g.buildWorld(id, Object.keys(buildZone(id).entries)[0], { silentBanner: true }); held = {}; } }
        const pl = g.world.player; if (!Number.isFinite(pl.x) || !Number.isFinite(pl.y) || Math.abs(pl.x) > 1e5 || Math.abs(pl.y) > 1e5) { problems.push(`${id} player NaN/far at f${fr}: ${pl.x},${pl.y}`); break; }
        for (const e of g.world.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { problems.push(`${id} enemy ${e.type} NaN`); e.dead = true; }
        if (g.world.enemies.length > 160 || g.world.projectiles.length > 400 || g.world.fx.p.length > 6000) { problems.push(`${id} runaway: en ${g.world.enemies.length} pr ${g.world.projectiles.length} fx ${g.world.fx.p.length}`); break; }
      }
      for (const a of acts) inp.inject(a, false);
    }
    return problems;
  }, [seed, frames]);
  console.log('[t] problems', res.length); for (const p of res) console.log('[t]  ', p);
};
