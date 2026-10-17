// Casts each new ability in front of a few enemies and captures frames. ABS=comma list, FORM
export default async (page, H) => {
  const abs = (process.env.ABS || 'crescent,aegis,tideStep,stormCall').split(','), out = process.env.OUT || '/tmp/ab', form = process.env.FORM || 'warrior';
  await H.load('?manual=1'); await H.adv(60);
  const meta = [];
  for (const id of abs) {
    await H.eval(([id, form]) => {
      const g = window.__game, s = g.state; s.form = form; s.level = 12; s.branches = { warrior: 'bulwark' };
      g.buildWorld('reef_nursery', Object.keys(g.world.zone.entries)[0], { silentBanner: true });
      const w = g.world, p = w.player; p.recalc(); p.hp = p.stats.maxHp; p.tide = 99; p.invulnT = 0;
      const E = w.enemies[0].constructor; w.enemies.length = 0;
      const gy = (() => { for (let y = Math.round(p.y / 16); y < 200; y++) if (w.grid.solidPx(p.x + 20, y * 16 + 2)) return y * 16; return p.y + 30; })();
      for (const dx of [40, 70, 100, 130]) { const e = new E(w, 'pinchling', p.x + dx, gy - 8, {}); e.hp = e.maxHp = 400; e.poise = 999; w.enemies.push(e); }
      p.facing = 1; w.snapCamera(); window.__id = id;
    }, [id, form]);
    await H.adv(20);
    await H.eval(() => { const g = window.__game, p = g.world.player; p.castAbility(window.__id); g.advance(1); });
    for (let k = 0; k < 4; k++) { await H.adv(k === 0 ? 8 : 5); await H.canvas(`${out}_${id}_${k}.png`); meta.push(await H.eval(() => { const w = window.__game.world; return [Math.round(w.player.x - w.cam.x), Math.round(w.player.y - w.cam.y)]; })); }
  }
  (await import('node:fs')).writeFileSync(`${out}_meta.json`, JSON.stringify(meta));
};
