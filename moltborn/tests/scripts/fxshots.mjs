// Renders each combat effect in isolation (slash, heavy slash, impact, crit impact, debris) for visual review.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(60);
  await H.eval(() => {
    const g = window.__game, w = g.world, p = w.player; p.invulnT = 99; w.enemies.length = 0; p.facing = 1;
    window.__fx = [
      () => w.fx.slash(p.x + 2, p.y - 2, 1, 22, '#fff0c8', {}),
      () => w.fx.slash(p.x + 2, p.y - 2, 1, 36, '#ffd0a0', { life: 0.24, th: 9, arc: 1.3, sweep: -1 }),
      () => w.fx.impact(p.x + 24, p.y, 1, {}),
      () => w.fx.impact(p.x + 24, p.y, 1, { crit: true }),
      () => { const E = w.enemies.length ? null : null; },
    ];
  });
  const meta = [];
  for (let k = 0; k < 4; k++) {
    for (let f = 0; f < 4; f++) {
      await H.eval(([k, f]) => { const g = window.__game; if (f === 0) window.__fx[k](); g.advance(f === 0 ? 2 : 3); }, [k, f]);
      await H.canvas(`${process.env.OUT || '/tmp/fx'}_${k}${f}.png`);
      meta.push(await H.eval(() => { const w = window.__game.world; return [Math.round(w.player.x - w.cam.x), Math.round(w.player.y - w.cam.y)]; }));
    }
  }
  (await import('node:fs')).writeFileSync(`${process.env.OUT || '/tmp/fx'}_meta.json`, JSON.stringify(meta));
};
