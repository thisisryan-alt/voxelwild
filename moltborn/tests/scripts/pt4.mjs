export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  console.log('[t]', await H.eval(() => { const g = window.__game, w = g.world, p = w.player; const rows = []; for (let y = 24; y < 36; y++) { let r = String(y).padStart(2) + ' '; for (let x = 20; x < 40; x++) r += w.grid.get(x, y) === 0 ? '.' : String(w.grid.get(x, y)); rows.push(r); } return rows.join('\n') + '\n' + JSON.stringify({ x: p.x, y: p.y, w: p.w, h: p.h, jump: p.stats && p.stats.jump, kind: p.form }); }));
  await page.keyboard.down('ArrowRight'); await H.adv(100);
  console.log('[t] at wall', await H.eval(() => { const p = window.__game.world.player; return [p.x, p.y, p.vx, p.vy, p.onGround, p.state]; }));
  for (let i = 0; i < 4; i++) { await page.keyboard.down('Space'); const tr = []; for (let k = 0; k < 40; k += 4) { await H.adv(4); tr.push(await H.eval(() => { const p = window.__game.world.player; return [Math.round(p.x), Math.round(p.y), +p.vy.toFixed(0)]; })); } await page.keyboard.up('Space'); console.log('[t] jump', JSON.stringify(tr)); await H.adv(30); }
};
