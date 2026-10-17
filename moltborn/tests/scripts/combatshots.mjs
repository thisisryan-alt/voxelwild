// Spawns a few enemies beside the player and captures frames of a combo (impacts, slashes, debris, combo counter).
// ZONE, FORM, N (frames to capture), STEP (sim frames between shots), OUT
export default async (page, H) => {
  const zone = process.env.ZONE || 'reef_garden', form = process.env.FORM || 'warrior', N = +(process.env.N || 12), step = +(process.env.STEP || 3), out = process.env.OUT || '/tmp/cs';
  await H.load('?manual=1'); await H.adv(60);
  await H.eval((sp) => { window.__spawn = sp; }, process.env.SPAWN ? JSON.parse(process.env.SPAWN) : null);
  await H.eval(([zone, form]) => {
    const g = window.__game, s = g.state; s.form = form; s.level = 10; s.branches = { warrior: 'bulwark' };
    g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true });
    const w = g.world, p = w.player; p.recalc(); p.hp = p.stats.maxHp; p.invulnT = 99;
    const E = w.enemies[0].constructor; w.enemies.length = 0;
    const gy = (() => { for (let y = Math.round(p.y / 16); y < 200; y++) if (w.grid.solidPx(p.x + 20, y * 16 + 2)) return y * 16; return p.y + 30; })();
    for (const [t, dx] of (window.__spawn || [['pinchling', 22], ['pinchling', 46], ['pinchling', 70]])) { const e = new E(w, t, p.x + dx, gy - 8, {}); e.poise = 99; w.enemies.push(e); }
    p.facing = 1; w.snapCamera();
  }, [zone, form]);
  await H.adv(30); const meta = [];
  for (let i = 0; i < N; i++) {
    await H.eval(([i, step]) => { const g = window.__game, inp = g.input; inp.inject('attack', i % 5 === 0); g.advance(1); inp.inject('attack', false); g.advance(step); }, [i, step]);
    await H.canvas(`${out}_${String(i).padStart(2, '0')}.png`);
    meta.push(await H.eval(() => { const w = window.__game.world; return [Math.round(w.player.x - w.cam.x), Math.round(w.player.y - w.cam.y)]; }));
  }
  (await import('node:fs')).writeFileSync(`${out}_meta.json`, JSON.stringify(meta));
};
