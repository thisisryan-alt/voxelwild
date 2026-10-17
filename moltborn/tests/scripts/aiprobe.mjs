// For each enemy type: spawn it 110px from a stationary, heavily-armoured player on open ground and measure how it behaves for 12 s.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const rows = await H.eval(async () => {
    const g = window.__game, { ENEMIES } = await import('/src/data/enemies.js'); const { Enemy } = await import('/src/entities/enemy.js'); const { ZoneBuilder } = await import('/src/world/zonebuilder.js'); const { T } = await import('/src/world/tiles.js');
    const out = [];
    for (const [type, def] of Object.entries(ENEMIES)) {
      if (def.friendly || def.boss) continue;
      g.state.level = 10; g.state.form = 'warrior';
      const b = new ZoneBuilder({ id: 'probe', name: 'Probe', biome: 'reef', w: 90, h: 34, seed: 5, music: 'reef' }); b.fill(T.ROCK).carve(2, 4, 86, 28); b.seabed(2, 88, () => 28); b.ceiling(2, 88, () => 5); b.entryFloor('start', 20, { facing: 1 }); b.surface(T.GROUND, 1); b.keep(2, 4, 86, 28);
      const { World } = await import('/src/world/world.js'); g.world = new World(g, b.finish(), 'start'); const w = g.world, p = w.player; p.recalc(); p.stats.maxHp = 99999; p.hp = 99999; w.enemies.length = 0;
      // find an open floor spot: scan right from the player until air above solid
      const e = new Enemy(w, type, p.x + 110, def.flying ? p.y - 6 : p.y - 2, { facing: -1 }); w.enemies.push(e);
      const hp0 = p.hp; let minD = 1e9, firstHit = -1, moved = 0, lx = e.x, ly = e.y, shots = 0, t = 0;
      for (let f = 0; f < 720; f += 6) { g.advance(6); t = f / 60; if (!e.alive) break; const d = Math.hypot(e.x - p.x, e.y - p.y); minD = Math.min(minD, d); moved += Math.hypot(e.x - lx, e.y - ly); lx = e.x; ly = e.y; if (firstHit < 0 && p.hp < hp0) firstHit = t; shots = Math.max(shots, w.projectiles.length); p.hp = Math.min(p.hp, 99999); }
      out.push({ type, ai: def.ai, dmg: Math.round(hp0 - p.hp), firstHit: firstHit < 0 ? null : +firstHit.toFixed(1), minD: Math.round(minD), moved: Math.round(moved), proj: shots, alive: e.alive });
    }
    return out;
  });
  for (const r of rows) console.log('[t]', JSON.stringify(r));
};
