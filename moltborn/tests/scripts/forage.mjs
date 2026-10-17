// Forage patches: placement everywhere, the timing game, yields, regrowth. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/fg';
  await H.load('?manual=1'); await H.adv(30);
  const placement = await H.eval(async () => {
    const { ZONE_INFO } = await import('/src/data/zoneinfo.js'); const { buildZone } = await import('/src/data/zones.js'); const { isSolid, TS } = await import('/src/world/tiles.js');
    const rows = {}, bad = [];
    for (const id of Object.keys(ZONE_INFO)) { const z = buildZone(id); const ps = z.props.filter((p) => p.type === 'forage'); rows[id] = ps.length; for (const p of ps) { const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 2) / TS); if (isSolid(z.grid.get(tx, ty)) || !isSolid(z.grid.get(tx, ty + 1))) bad.push(id + '@' + tx + ',' + ty); } }
    return { total: Object.values(rows).reduce((a, b) => a + b, 0), zones: Object.keys(rows).length, empty: Object.keys(rows).filter((k) => !rows[k]), bad };
  });
  console.log('[t] placement', JSON.stringify(placement));
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld('forest_roots', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; while (g.engine.top.constructor.name !== 'PlayScene') g.engine.pop(); g.world.enemies.length = 0; g.world.player.invulnT = 99; });
  const res = await H.eval(async () => {
    const g = window.__game, w = g.world, p = w.player; const { ForagePatch } = await import('/src/entities/interactables.js');
    const patch = w.interactables.find((i) => i instanceof ForagePatch); if (!patch) return { err: 'no patch in forest_roots' };
    p.x = patch.x; p.y = patch.y; g.advance(3);
    const before = Object.values(g.state.inv).reduce((a, b) => a + b, 0); const out = { prompt: patch.prompt(), ready: patch.ready };
    patch.interact(g); await new Promise((r) => setTimeout(r, 60)); g.advance(2); out.top = g.engine.top.constructor.name;
    const sc = g.engine.top;
    for (let r = 0; r < 3; r++) { const { ROUNDS } = await import('/src/data/forage.js'); sc.pos = sc.zoneAt + ROUNDS[r].zone / 2; sc.dir = 1; g.input.inject('confirm', true); g.advance(1); g.input.inject('confirm', false); g.advance(40); }
    out.hits = sc.hits; out.result = sc.result; out.state = sc.state;
    g.advance(40); g.input.inject('confirm', true); g.advance(2); g.input.inject('confirm', false); g.advance(2); out.after = g.engine.top.constructor.name;
    out.gained = Object.values(g.state.inv).reduce((a, b) => a + b, 0) - before; out.readyNow = patch.ready; out.promptNow = patch.prompt();
    g.state.playtime += 800; out.regrown = patch.ready; out.forageRecord = g.state.records.forage;
    return out;
  });
  console.log('[t] harvest', JSON.stringify(res));
  await H.canvas(`${out}_patch.png`);
};
