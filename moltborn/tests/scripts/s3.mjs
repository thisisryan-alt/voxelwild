export default async (page, H) => {
  await H.load('?manual=1');
  const tap = (a) => H.eval((a) => { const g = window.__game; g.input.inject(a, true); g.advance(2); g.input.inject(a, false); }, a);
  await H.adv(60);
  await H.eval(() => { const g = window.__game, w = g.world, e = w.enemies.find((e) => e.type === 'pinchling'); e.state = 'patrol'; e.a.cd = 99; const p = w.player; p.x = e.x - 22; p.y = e.y; p.vx = p.vy = 0; p.facing = 1; });
  await H.adv(5);
  for (let i = 0; i < 4; i++) {
    await tap('attack');
    for (let k = 0; k < 14; k++) { await H.adv(1); const r = await H.eval(() => { const w = window.__game.world; const e = w.enemies.find((e) => e.type === 'pinchling'); return { hb: w.hitboxes.map((h) => [Math.round(h.x), Math.round(h.y), h.w, h.h, h.team]), e: e ? [Math.round(e.x), Math.round(e.y), e.hp, e.w, e.h] : null, p: [Math.round(w.player.x), Math.round(w.player.y), w.player.state, w.player.atk && w.player.atk.t.toFixed(2)] }; }); if (r.hb.length) console.log('[t]', JSON.stringify(r)); }
  }
};
