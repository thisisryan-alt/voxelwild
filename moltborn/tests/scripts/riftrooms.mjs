// Rift room kinds: elite den, ambush, treasure vault with relic stand, altar (rest, offering, sacrifice). OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/rr';
  await H.load('?manual=1'); await H.adv(30);
  const seed = await H.eval(async () => { const { riftKind } = await import('/src/world/rift_gen.js'); for (let s = 1000; s < 9000; s += 7) { const k = [1, 2, 3, 4, 5, 6].map((d) => riftKind(s, d, 6)); if (['elite', 'ambush', 'treasure', 'altar'].every((x) => k.includes(x)) && k.indexOf('treasure') !== k.indexOf('altar') + 1 && k.indexOf('altar') !== k.indexOf('treasure') + 1) return { s, k }; } return null; });
  console.log('[t] seed', JSON.stringify(seed));
  await H.eval((seed) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 14; s.coins = 2000; s.bosses.grumbold = true; s.bosses.mother_moray = true; for (const z of ['reef_garden', 'forest_roots', 'kingdom_gate']) s.visited[z] = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; for (const f of ['first_rift', 'rift_won', 'first_cook', 'hatch']) g.setFlag('cs_' + f); g.systems.rifts.start({ tier: 'deep', seed }); }, seed.s);
  await H.adv(70);
  const info = () => H.eval(() => { const g = window.__game, r = g.systems.rifts, w = g.world; return { zone: w.zone.id, kind: r.run?.kind, cleared: r.run?.cleared, picking: r.run?.picking, pending: r.run?.pending, foes: w.enemies.filter((e) => e.alive && !e.def.friendly).length, relics: [...(g.state.riftRelics || [])], top: g.engine.top.constructor.name, hp: Math.round(w.player.hp), maxHp: w.player.stats.maxHp }; });
  const wipe = () => H.eval(() => { const g = window.__game, w = g.world, p = w.player; p.invulnT = 99; for (let k = 0; k < 6; k++) for (const e of w.enemies) if (e.alive && !e.dying && !e.def.friendly) e.takeHit({ dmg: 9999, dir: 1, heavy: true, guardBreak: k > 3 }, p); });
  const clearAll = async () => { for (let k = 0; k < 20; k++) { await wipe(); await H.adv(45); const i = await info(); if (i.foes === 0 && !i.pending) break; } };
  const pickRelic = async () => { await H.adv(40); await H.eval(() => { window.__game.input.inject('confirm', true); }); await H.adv(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await H.adv(5); };
  const exit = async () => { await H.eval(() => { const g = window.__game, w = g.world, p = w.player, ex = w.zone.exits[0]; p.x = ex.x + ex.w / 2; p.y = ex.y + ex.h / 2; }); await H.adv(90); };
  for (let d = 1; d <= 5; d++) {
    const i0 = await info(); const kind = seed.k[d - 1]; console.log('[t] depth', d, kind, JSON.stringify(i0));
    if (kind === 'elite') { const e = await H.eval(() => { const w = window.__game.world; return w.enemies.filter((x) => x.champion).map((x) => [x.name, x.affixes]); }); console.log('[t]   champions', JSON.stringify(e)); await H.canvas(`${out}_elite.png`); await wipe(); await H.adv(100); const i = await info(); console.log('[t]   after clear', i.top, i.picking); if (i.top === 'RelicScene') { const n = await H.eval(() => window.__game.engine.top.choices.length); console.log('[t]   offered', n); await pickRelic(); } }
    else if (kind === 'ambush') {
      await H.adv(60); const before = await info(); await H.eval(() => { const g = window.__game, w = g.world, p = w.player, a = g.systems.rifts.run.ambush; p.x = a.x + 40; }); await H.adv(30); const mid = await info(); console.log('[t]   ambush', before.foes, '->', mid.foes, 'pending', mid.pending); await H.adv(200); await H.canvas(`${out}_ambush.png`); await clearAll(); await H.adv(80); const i = await info(); console.log('[t]   cleared?', i.cleared, i.top, JSON.stringify(await H.eval(() => window.__game.world.enemies.filter((e) => e.alive).map((e) => [e.type, e.state, e.dying, e.invuln, e.phased, e.disguised, e.shield, e.hp])))); if (i.top === 'RelicScene') await pickRelic();
    } else if (kind === 'treasure') {
      const i = await info(); console.log('[t]   quiet room cleared at once:', i.cleared, 'foes', i.foes); await H.canvas(`${out}_vault.png`);
      const r = await H.eval(async () => { const g = window.__game, w = g.world, p = w.player; const { RelicStand } = await import('/src/entities/interactables.js'); const st = w.interactables.find((x) => x instanceof RelicStand); p.x = st.x; p.y = st.y; g.advance(3); st.interact(g); g.advance(30); return { taken: st.taken, relics: [...g.state.riftRelics], pending: g.systems.rifts.run.pending, cleared: g.systems.rifts.run.cleared }; });
      console.log('[t]   stand', JSON.stringify(r)); await H.adv(260); await clearAll(); await H.adv(80); const j = await info(); console.log('[t]   vault guardians down, cleared?', j.cleared, 'foes', j.foes);
    } else if (kind === 'altar') {
      await H.canvas(`${out}_altar.png`);
      const r = await H.eval(async () => { const g = window.__game, w = g.world, p = w.player, run = g.systems.rifts.run; const { Altar } = await import('/src/entities/interactables.js'); const al = w.interactables.find((x) => x instanceof Altar); p.hp = 5; const out = {}; out.rest = g.systems.rifts.altar('rest', al); out.hpAfter = Math.round(p.hp); out.again = g.systems.rifts.altar('rest', al); return out; });
      console.log('[t]   altar', JSON.stringify(r));
    } else { await wipe(); await H.adv(100); const i = await info(); if (i.top === 'RelicScene') await pickRelic(); }
    if (d < 5) await exit();
  }
  console.log('[t] final', JSON.stringify(await info()));
};
