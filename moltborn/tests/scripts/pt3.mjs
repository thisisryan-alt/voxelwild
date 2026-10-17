// Reactive bot with real keys: go right, jump blockers, attack nearby enemies.
export default async (page, H) => {
  await H.load('?manual=1');
  const st = () => H.eval(() => { const g = window.__game, p = g.world.player; const en = g.world.enemies.filter((e) => !e.dead).map((e) => ({ t: e.type, dx: Math.round(e.x - p.x), dy: Math.round(e.y - p.y) })).filter((e) => Math.abs(e.dx) < 80 && Math.abs(e.dy) < 50); return { z: g.world.zone.id, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), st: p.state, lvl: g.state.level, coins: g.state.coins, xp: g.state.xp, en, top: (g.engine.stack || g.engine.scenes)?.slice(-1)[0]?.constructor.name }; });
  const goal = +(process.env.GX || 1500), frames = +(process.env.F || 1800);
  let down = new Set();
  const set = async (k, on) => { if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); } else if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); } };
  let last = 0, stuck = 0, shots = 0;
  for (let f = 0; f < frames; f += 6) {
    const s = await st();
    if (s.top !== 'PlayScene') { console.log('[t] scene', s.top); for (const k of [...down]) await set(k, false); await page.keyboard.press('Enter'); await H.adv(20); continue; }
    const e = s.en[0];
    await set('ArrowRight', !e || Math.abs(e.dx) > 26 ? s.x < goal : e.dx > 0);
    await set('ArrowLeft', false);
    await set('Space', stuck > 1 ? (f / 6) % 2 === 0 : (f / 6) % 10 === 0);
    await set('KeyJ', !!e && Math.abs(e.dx) < 40 && (f / 6) % 2 === 0);
    stuck = Math.abs(s.x - last) < 1 ? stuck + 1 : 0; last = s.x;
    await H.adv(6);
    if (f % 360 === 0) { await H.canvas(`/tmp/pt/20_${String(shots++).padStart(2, '0')}.png`); console.log('[t]', JSON.stringify(s)); }
  }
  console.log('[t] end', JSON.stringify(await st()));
};
