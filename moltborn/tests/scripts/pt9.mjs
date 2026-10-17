export default async (page, H) => {
  await H.load("?manual=1"); globalThis.__c = 0;
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(4); };
  const st = () => H.eval(() => { const g = window.__game, e = g.engine, s = e.stack || e.scenes, p = g.world.player; return { top: s[s.length - 1]?.constructor.name, z: g.world.zone.id, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), coins: g.state.coins, purse: g.state.purse, alive: p.alive, deaths: g.state.stats.deaths }; });
  await H.eval(() => { const g = window.__game; g.state.coins = 120; g.buildWorld('reef_garden', 'west', {}); const p = g.world.player; p.x += 200; });
  await H.adv(60); console.log('[t] before', JSON.stringify(await st()));
  await H.eval(() => { const p = window.__game.world.player; p.takeHit({ dmg: 999, x: p.x - 10, y: p.y, kb: 0, poise: 0, team: 'enemy' }); });
  for (const f of [10, 70, 12, 12, 12, 12, 12, 12, 30]) { await H.adv(f); console.log('[t]', f, JSON.stringify(await st())); await H.canvas(`/tmp/pt/70_${Math.random().toString(36).slice(2,5)}_${String(++globalThis.__c).padStart(2,"0")}.png`); }
  await tap('Enter'); await H.adv(120); console.log('[t] after', JSON.stringify(await st())); await H.canvas('/tmp/pt/71_respawn.png');
};
