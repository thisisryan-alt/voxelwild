// Ambient events: force each kind in a fitting zone and shoot it. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ev';
  await H.load('?manual=1'); await H.adv(30);
  const cases = [['reef_garden', 'whale'], ['reef_garden', 'stream'], ['reef_hollow', 'sun'], ['grave_shallows', 'ghost'], ['abyss_lanterns', 'snow'], ['forest_roots', 'drift'], ['trench_bones', 'tremor']];
  for (const [z, k] of cases) {
    await H.eval(([z, k]) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 10; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.world.player.invulnT = 99; g.world.sky.force(k, { mid: true }); }, [z, k]);
    await H.adv(k === 'tremor' ? 80 : 40); await H.canvas(`${out}_${k}.png`);
  }
  // natural scheduling over a few minutes of game time in one zone
  const seen = await H.eval(() => { const g = window.__game; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.world.player.invulnT = 999; const kinds = {}; g.events.on('ambevent', (k) => { kinds[k] = (kinds[k] || 0) + 1; }); g.advance(60 * 60 * 4); return kinds; });
  console.log('[t] natural events in 4 min', JSON.stringify(seen));
};
