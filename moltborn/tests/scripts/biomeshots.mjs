// One in-game screenshot per zone at its first entry (after a short settle). ZONES=comma list, OUT prefix.
export default async (page, H) => {
  const zones = (process.env.ZONES || 'reef_garden,forest_roots,kingdom_gate,grave_shallows,abyss_lanterns,trench_bones,domain_gate,reef_hollow').split(','), out = process.env.OUT || '/tmp/bs';
  await H.load('?manual=1'); await H.adv(30);
  for (const z of zones) {
    await H.eval((z) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 10; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; }, z);
    await H.eval((z) => { const g = window.__game; const w = g.world; const p = w.player; p.invulnT = 99; w.enemies.length = 0; }, z);
    await H.adv(90);
    await H.canvas(`${out}_${z}.png`);
  }
};
