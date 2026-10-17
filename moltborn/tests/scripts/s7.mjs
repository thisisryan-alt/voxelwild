export default async (page, H) => {
  await H.load('?manual=1');
  const G = (fn, a) => H.eval(fn, a);
  const tap = (a) => G((a) => { const g = window.__game; g.input.inject(a, true); g.advance(2); g.input.inject(a, false); g.advance(1); }, a);
  await G(() => { const g = window.__game; g.buildWorld('reef_arena', 'west', {}); });
  await H.adv(30);
  await G(() => { const w = window.__game.world, p = w.player; p.x = 36 * 16; p.y = 20 * 16; w.snapCamera(); });
  for (let i = 0; i < 12; i++) { await tap('confirm'); await H.adv(20); }
  console.log('[t] engaged?', await G(() => window.__game.world.boss.engaged));
  // beat the boss quickly
  await G(() => { const w = window.__game.world, b = w.boss; b.hp = 12; b.armor = 1000; const p = w.player; p.x = b.x - 40; p.y = b.y; p.facing = 1; p.stats.atk = 30; });
  for (let i = 0; i < 8; i++) { await tap('attack'); await H.adv(12); }
  await H.adv(120);
  await H.canvas('/tmp/defeat1.png');
  for (let i = 0; i < 40; i++) { await tap('confirm'); await H.adv(25); }
  console.log('[t] boss state', JSON.stringify(await G(() => { const g = window.__game; return { bosses: g.state.bosses, inv: g.state.inv, ep: g.state.ep, sp: g.state.sp, xp: g.state.xp, lvl: g.state.level, flags: Object.keys(g.state.flags) }; })));
  await H.canvas('/tmp/defeat2.png');
  // evolve
  await G(() => { const g = window.__game; g.state.level = 6; g.world.player.recalc(); const sh = g.world.interactables.find((i) => i.kind === 'molt'); const p = g.world.player; p.x = sh.x; p.y = sh.y; g.openMoltShrine(sh); });
  await H.adv(5); await H.canvas('/tmp/molt1.png');
  await tap('down'); await tap('confirm'); await H.adv(5); await H.canvas('/tmp/molt2.png');
  await tap('confirm'); await H.adv(5); await H.canvas('/tmp/molt3.png');
  await tap('confirm'); await H.adv(5); await H.canvas('/tmp/molt4.png');
  await tap('confirm'); await H.adv(3);
  console.log('[t] top', await G(() => window.__game.engine.top.constructor.name));
  for (const t of [30, 60, 60, 60, 60, 60, 60]) { await H.adv(t); await H.canvas('/tmp/evo_' + Math.round(await G(() => window.__game.engine.top.t * 10 || 0)) + '.png'); }
  for (let i = 0; i < 6; i++) { await tap('confirm'); await H.adv(30); }
  console.log('[t] top2', await G(() => window.__game.engine.top.constructor.name), await G(() => window.__game.state.form));
  await H.canvas('/tmp/evo_done.png');
};
