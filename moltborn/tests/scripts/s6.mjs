export default async (page, H) => {
  await H.load('?manual=1');
  const G = (fn, a) => H.eval(fn, a);
  const hold = (a, n) => G(async ([a, n]) => { const g = window.__game; g.input.inject(a, true); g.advance(n); g.input.inject(a, false); }, [a, n]);
  const tap = (a) => G((a) => { const g = window.__game; g.input.inject(a, true); g.advance(2); g.input.inject(a, false); g.advance(1); }, a);
  // boss test: teleport into the arena, give the player stats for the fight
  await G(() => { const g = window.__game; g.buildWorld('reef_arena', 'west', {}); g.world.snapCamera(); });
  await H.adv(30);
  await G(() => { const w = window.__game.world; w.player.x = 30 * 16; w.player.y = 20 * 16; w.snapCamera(); });
  await H.adv(120);
  await H.canvas('/tmp/boss1.png');
  const info = () => G(() => { const w = window.__game.world, b = w.boss; return b ? { hp: b.hp, eng: b.engaged, st: b.state, pose: b.pose, atk: b.lastAtk, php: w.player.hp, bx: Math.round(b.x), px: Math.round(w.player.x), arm: Math.round(b.armor) } : null; });
  console.log('[t]', JSON.stringify(await info()));
  // keep attacking the boss for a while to check it behaves (no crash)
  for (let i = 0; i < 40; i++) { await G(() => { const w = window.__game.world, b = w.boss, p = w.player; if (b && b.alive) { p.hp = p.stats.maxHp; } }); await tap('attack'); await H.adv(25); if (i % 8 === 0) console.log('[t]', JSON.stringify(await info())); }
  await H.canvas('/tmp/boss2.png');
};
