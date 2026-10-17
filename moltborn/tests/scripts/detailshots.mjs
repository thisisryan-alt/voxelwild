// Tile-surface detail: one close-up per realm with detail on. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ds';
  const zones = (process.env.ZONES || 'reef_garden,forest_roots,kingdom_gate,grave_shallows,abyss_lanterns,trench_bones,domain_gate').split(',');
  await H.load('?manual=1'); await H.adv(30);
  for (const z of zones) {
    await H.eval((z) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 10; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.world.player.invulnT = 99; }, z);
    await H.adv(60); await H.canvas(`${out}_${z}.png`);
  }
};
