// Pack tactics: with six foes around the swimmer, how many attack at once with the director on and off?
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const run = async (on, type) => H.eval(async ([on, type]) => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.state.settings.packTactics = on ? 1 : 0; g.state.settings.difficulty = 'tide';
    const { Enemy } = await import('/src/entities/enemy.js'); const w = g.world, p = w.player; w.enemies.length = 0; p.invulnT = 99;
    for (let i = 0; i < 6; i++) { const e = new Enemy(w, type, p.x + 40 + i * 14, p.y - 4, {}); e.hp = e.maxHp = 9999; w.enemies.push(e); }
    const ATT = new Set(['windup', 'charge', 'dash', 'attack', 'lunge', 'peek', 'appear', 'burst', 'strike']); let max = 0, total = 0, frames = 0, held = 0;
    for (let f = 0; f < 60 * 12; f++) { g.advance(1); const n = w.enemies.filter((e) => e.alive && ATT.has(e.state)).length; max = Math.max(max, n); total += n; frames++; held = Math.max(held, g.systems.director.stats.held); }
    return { type, on, max, avg: +(total / frames).toFixed(2), held };
  }, [on, type]);
  for (const type of ['pinchling', 'barracuda', 'brineguard']) { console.log('[t]', JSON.stringify(await run(true, type)), JSON.stringify(await run(false, type))); }
};
