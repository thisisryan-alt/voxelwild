// Elite affixes: rolling, every effect, and a screenshot of a few elites. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/af';
  await H.load('?manual=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, res = {}; const { Enemy } = await import('/src/entities/enemy.js'); const { AFFIXES } = await import('/src/data/affixes.js');
    g.state.settings.difficulty = 'maelstrom'; g.state.ng = 5;
    let elites = 0, total = 0;
    for (const z of ['reef_garden', 'forest_roots', 'kingdom_gate', 'grave_shallows']) { g.buildWorld(z, undefined, { silentBanner: true }); for (const e of g.world.enemies) { total++; if (e.affixes) elites++; } }
    res.rolled = { elites, total };
    g.state.settings.difficulty = 'tide'; g.state.ng = 0; g.buildWorld('reef_garden', undefined, { silentBanner: true });
    const w = g.world, p = w.player; w.enemies.length = 0; p.invulnT = 0; p.hp = p.stats.maxHp;
    const mk = (id, type = 'pinchling', dx = 40) => { const e = new Enemy(w, type, p.x + dx, p.y, {}); w.enemies.push(e); g.systems.elites.apply(e, [id]); return e; };
    // shield absorbs 3 hits
    const s = mk('shielded'); const hp0 = s.hp; for (let i = 0; i < 3; i++) s.takeHit({ dmg: 5, dir: 1 }, p); res.shieldHeld = s.hp === hp0; s.takeHit({ dmg: 5, dir: 1 }, p); res.shieldBroke = s.hp < hp0;
    // armored reduces damage
    const a = mk('armored'); a.hp = a.maxHp = 100; a.takeHit({ dmg: 20, dir: 1 }, p); res.armoredTook = 100 - a.hp;
    // vampiric heals
    const v = mk('vampiric'); v.hp = 3; v.onHitPlayer(p, 10); res.vampHeal = v.hp;
    // scorching and frostbitten status on player
    const sc = mk('scorching'); sc.onHitPlayer(p, 5); const fr = mk('frostbitten'); fr.onHitPlayer(p, 5); res.playerStatus = p.status.ids();
    p.status.clear();
    // thorned reflects
    const t = mk('thorned'); p.invulnT = 0; p.hp = p.stats.maxHp; t.takeHit({ dmg: 30, dir: 1 }, p); res.thornHurt = p.stats.maxHp - p.hp;
    // brooding spawns on death, volatile blasts
    const n0 = w.enemies.length; const b = mk('brooding'); b.takeHit({ dmg: 999, dir: 1 }, p); g.advance(2); res.brood = w.enemies.filter((e) => e.type === 'spawnling').length;
    const vo = mk('volatile', 'pinchling', 6); p.invulnT = 0; p.hp = p.stats.maxHp; vo.takeHit({ dmg: 999, dir: 1 }, p); g.advance(10); res.blastHurt = p.stats.maxHp - p.hp;
    // swift keeps haste, mending regen
    const sw = mk('swift'); res.swiftStatus = sw.status.has('haste'); const me = mk('mending'); me.hp = 1; g.advance(70); res.mendHeal = me.hp > 1;
    // loot bonus: elites pay more xp
    const e1 = new Enemy(w, 'pinchling', 0, 0, {}); const e2 = new Enemy(w, 'pinchling', 0, 0, {}); g.systems.elites.apply(e2, ['armored']); res.xpMult = +(e2.xpMult / e1.xpMult).toFixed(2); res.name = e2.name;
    // set up screenshot lineup
    w.enemies.length = 0; p.invulnT = 99; p.hp = p.stats.maxHp;
    ['armored', 'swift', 'volatile', 'shielded', 'frostbitten'].forEach((id, i) => { const e = new Enemy(w, i % 2 ? 'urchin' : 'pinchling', p.x + 30 + i * 38, p.y - 6, {}); w.enemies.push(e); g.systems.elites.apply(e, [id]); e.state = 'idle'; });
    return res;
  });
  console.log('[t]', JSON.stringify(r));
  await H.eval(() => { const g = window.__game; g.systems.story.queue.length = 0; while (g.engine.top.constructor.name !== 'PlayScene') g.engine.pop(); });
  await H.adv(20); await H.canvas(`${out}_line.png`);
};
