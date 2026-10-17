// Gameplay screenshots from representative zones with some enemies near; ZONES env, FORM env.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const zones = (process.env.ZONES || 'reef_nursery,reef_garden,forest_roots,kingdom_spires,grave_galleon').split(',');
  for (const id of zones) {
    await H.eval(async ([id, form, dx]) => { const g = window.__game, s = g.state; s.form = form; s.level = form === 'shore' ? 3 : 10; const { buildZone } = await import('/src/data/zones.js'); const z = buildZone(id); g.buildWorld(id, Object.keys(z.entries)[0], { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; p.x += dx; g.world.snapCamera(); p.invulnT = 99; }, [id, process.env.FORM || 'shore', +(process.env.DX || 150)]);
    await H.adv(150); await H.canvas(`/tmp/shot_${id}.png`);
  }
};
