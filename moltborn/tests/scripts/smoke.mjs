// Loads every zone and runs it with random input; also exercises save/load.
export default async (page, H) => {
  await H.load('?manual=1');
  const res = await H.eval(async () => {
    const g = window.__game; const { ZONE_INFO } = await import('/src/data/zoneinfo.js'); const out = [];
    const forms = { reef: 'shore', forest: 'warrior', kingdom: 'warrior', graveyard: 'abyssal', abyss: 'abyssal', trench: 'leviathan', domain: 'leviathan' };
    for (const [id, info] of Object.entries(ZONE_INFO)) {
      const s = g.state; s.form = forms[info.biome]; s.level = 12; s.branches = { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tidebreaker' };
      try {
        g.buildWorld(id, Object.keys(g.world.zone.entries)[0] === undefined ? 'x' : 'x', {});
      } catch (e) {}
      try {
        const { buildZone } = await import('/src/data/zones.js'); const z = buildZone(id); const entry = Object.keys(z.entries)[0];
        g.buildWorld(id, entry, { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp;
        const keys = ['left', 'right', 'up', 'down', 'attack', 'jump', 'dash', 'heavy', 'block'];
        let nan = false;
        for (let f = 0; f < 420; f++) { if (f % 25 === 0) { for (const k of keys) g.input.inject(k, Math.random() < 0.35); } p.hp = Math.max(p.hp, 5); g.engine.step(1 / 60); if (!isFinite(p.x) || !isFinite(p.y)) { nan = true; break; } }
        for (const k of keys) g.input.inject(k, false);
        g.engine.render();
        const w2 = g.world, pl2 = w2.player; // random walks often leave through an exit: judge the world we are actually in
        out.push({ id, ok: !nan, enemies: w2.enemies.length, x: Math.round(pl2.x), y: Math.round(pl2.y), left: w2.zone.id !== id, inside: !w2.grid.solidPx(pl2.x, pl2.y) });
      } catch (e) { out.push({ id, err: e.message + ' ' + (e.stack || '').split('\n')[1] }); }
    }
    return out;
  });
  let bad = 0; for (const r of res) { if (r.err || !r.ok || !r.inside) { bad++; console.log('✗', JSON.stringify(r)); } }
  console.log('[t] zones', res.length, 'problems', bad);
  // save/load round trip
  const rt = await H.eval(() => { const g = window.__game; g.state.coins = 123; g.state.level = 9; g.state.flags.test_flag = true; g.slot = 2; g.saveGame(true); const before = JSON.stringify(g.state.flags); g.state.coins = 0; g.loadGame(2); return { coins: g.state.coins, level: g.state.level, flag: !!g.state.flags.test_flag, zone: g.world.zone.id }; });
  console.log('[t] save/load', JSON.stringify(rt));
};
