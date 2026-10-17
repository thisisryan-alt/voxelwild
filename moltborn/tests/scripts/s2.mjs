export default async (page, H) => {
  await H.load('?manual=1');
  const hold = (a, n) => H.eval(async ([a, n]) => { const g = window.__game; g.input.inject(a, true); g.advance(n); g.input.inject(a, false); }, [a, n]);
  const tap = (a) => H.eval((a) => { const g = window.__game; g.input.inject(a, true); g.advance(2); g.input.inject(a, false); g.advance(1); }, a);
  await H.adv(120);
  await hold('right', 150);
  const st = () => H.eval(() => { const g = window.__game, p = g.world.player; return { x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, state: p.state, anim: p.anim, onGround: p.onGround, coins: g.state.coins, xp: g.state.xp, kills: g.state.stats.kills, en: g.world.enemies.length }; });
  console.log('[t] after run', JSON.stringify(await st()));
  await tap('jump'); await H.adv(10); console.log('[t] stroke', JSON.stringify(await st()));
  await H.adv(60);
  // teleport next to a pinchling and fight
  await H.eval(() => { const g = window.__game, w = g.world, e = w.enemies.find((e) => e.type === 'pinchling'); const p = w.player; p.x = e.x - 30; p.y = e.y; p.vx = p.vy = 0; p.facing = 1; w.snapCamera(); });
  await H.adv(30);
  for (let i = 0; i < 6; i++) { await tap('attack'); await H.adv(14); }
  await H.canvas('/tmp/c2.png');
  console.log('[t] after fight', JSON.stringify(await st()));
  await H.adv(120);
  console.log('[t] later', JSON.stringify(await st()));
};
