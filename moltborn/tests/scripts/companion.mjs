// Companion: adoption via the egg, following, nipping foes, fetching coins, levelling, persistence. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/cp';
  await H.load('?manual=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; const w = g.world, p = w.player; const o = {};
    o.before = !!w.companion; g.addItem('hatchling_egg', 1); o.use = g.systems.crafting.use('hatchling_egg'); o.use2 = (g.addItem('hatchling_egg', 1), g.systems.crafting.use('hatchling_egg')); o.eggLeft = g.itemCount('hatchling_egg');
    o.after = !!g.world.companion; o.name = s.companion.name;
    // follows
    p.invulnT = 99; g.input.inject('right', true); g.advance(120); g.input.inject('right', false); g.advance(30); const c = g.world.companion; o.followDist = Math.round(Math.hypot(c.x - p.x, c.y - p.y));
    // nips an enemy
    const { Enemy } = await import('/src/entities/enemy.js'); const e = new Enemy(w, 'pinchling', p.x + 60, p.y, {}); e.hp = e.maxHp = 200; e.state = 'idle'; w.enemies.push(e); const hp0 = e.hp; g.advance(240); o.nipped = hp0 - e.hp; o.combo = p.combo || 0;
    // fetches a coin outside the player's magnet but near the companion
    w.enemies.length = 0; w.pickups.push(new (await import('/src/entities/entity.js')).Pickup(w, { kind: 'coin', value: 5, x: c.x + 30, y: c.y, delay: 0, fixed: true })); const coins0 = s.coins; g.advance(200); o.fetched = s.coins - coins0;
    // levels
    for (let i = 0; i < 6; i++) g.events.emit('kill', 'pinchling', {}); o.level = s.companion.level; o.desc = g.systems.companion.describe();
    // persistence through a save and load
    g.slot = 1; g.saveGame(true); g.loadGame(1); g.advance(3); o.loaded = !!g.world.companion && g.state.companion.level === o.level;
    return o;
  });
  console.log('[t]', JSON.stringify(r)); await H.canvas(`${out}_pet.png`);
};
