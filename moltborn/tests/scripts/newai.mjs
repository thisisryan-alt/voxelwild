// Spot checks for the expansion AIs: fumecap clouds, hook pull, ram wall-stun, mender heal, brood spawns, jelly split.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const out = await H.eval(async () => {
    const g = window.__game, { Enemy } = await import('/src/entities/enemy.js'); const { ZoneBuilder } = await import('/src/world/zonebuilder.js'); const { T } = await import('/src/world/tiles.js'); const { World } = await import('/src/world/world.js');
    const arena = (len = 90) => { const b = new ZoneBuilder({ id: 'probe', name: 'Probe', biome: 'reef', w: len, h: 34, seed: 5, music: 'reef' }); b.fill(T.ROCK).carve(2, 4, len - 4, 28); b.seabed(2, len - 2, () => 28); b.ceiling(2, len - 2, () => 5); b.entryFloor('start', 20, { facing: 1 }); return b.finish(); };
    const res = {};
    const mk = (type, dx, dy = 0, o = {}) => { g.state.level = 10; g.state.form = 'warrior'; g.world = new World(g, arena(), 'start'); const w = g.world, p = w.player; p.recalc(); p.stats.maxHp = 99999; p.hp = 99999; p.invulnT = 0; w.enemies.length = 0; const e = new Enemy(w, type, p.x + dx, p.y + dy, { facing: -1, ...o }); w.enemies.push(e); return { w, p, e }; };
    // fumecap: place the player right next to it so the bomb lands on them
    { const { w, p, e } = mk('fumecap', 60, 0); let maxFields = 0, poisoned = false; for (let f = 0; f < 600; f += 3) { g.advance(3); maxFields = Math.max(maxFields, w.fields.length); if (p.poisonT > 0) poisoned = true; } res.fumecap = { maxFields, poisoned, hpLost: 99999 - p.hp }; }
    // hookjaw: does the hook yank the player?
    { const { w, p, e } = mk('hookjaw', 100, -4); let maxPull = 0; for (let f = 0; f < 600; f += 2) { g.advance(2); maxPull = Math.max(maxPull, Math.abs(p.vx)); } res.hookjaw = { maxPull: Math.round(maxPull), hpLost: 99999 - p.hp }; }
    // tuskram: put a wall right behind the player; the ram should stun itself on it
    { const { w, p, e } = mk('tuskram', 120, 0, {}); let dazed = false, charged = false, shots = 0; for (let f = 0; f < 1500; f += 2) { g.advance(2); p.x = 60 * 16 / 3; if (e.state === 'charge') charged = true; if (e.state === 'dazed') dazed = true; } res.tuskram = { charged, dazed, hpLost: 99999 - p.hp }; }
    // mender: a wounded mantis nearby should get healed
    { const { w, p, e } = mk('mender', 70, 0); const m = new Enemy(w, 'pinchling', p.x + 100, p.y - 2, {}); w.enemies.push(m); m.hp = 2; m.maxHp = 12; m.state = 'idle'; let healed = false; for (let f = 0; f < 600; f += 3) { g.advance(3); m.vx = 0; if (m.hp > 6) healed = true; } res.mender = { healed, hp: m.hp }; }
    // brood coral spawns spawnlings
    { const { w, p, e } = mk('spawncoral', 80, 0); let peak = 0; for (let f = 0; f < 900; f += 6) { g.advance(6); peak = Math.max(peak, w.enemies.filter((x) => x.type === 'spawnling' && x.alive).length); } res.spawncoral = { peak }; }
    // mother jelly splits
    { const { w, p, e } = mk('splitjelly', 30, 0); e.takeHit({ dmg: 999, dir: 1, kb: 0, poise: 0 }, p); g.advance(10); res.splitjelly = { jellets: w.enemies.filter((x) => x.type === 'jellet').length }; }
    // mantis flurry: count strike hitboxes in a fight
    { const { w, p, e } = mk('mantis', 30, 0); let boxes = 0, last = 0; for (let f = 0; f < 600; f++) { g.advance(1); const n = w.hitboxes.filter((h) => h.team === 'enemy').length; if (n > last) boxes += n - last; last = n; } res.mantis = { strikes: boxes, hpLost: 99999 - p.hp }; }
    return res;
  });
  console.log('[t]', JSON.stringify(out, null, 1));
};
