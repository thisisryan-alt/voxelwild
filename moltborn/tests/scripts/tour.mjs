export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const ids = await H.eval(async () => (await import('/src/data/zones.js')).ZONE_IDS);
  for (const id of (process.env.ZONES ? process.env.ZONES.split(',') : ids)) {
    await H.eval((id) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld(id, Object.keys(window.__game.world.zone.entries)[0] && null || undefined, {}); }, id).catch(() => {});
    await H.eval(async (id) => { const g = window.__game; const { buildZone } = await import('/src/data/zones.js'); const z = buildZone(id); g.buildWorld(id, Object.keys(z.entries)[0], { silentBanner: true }); g.world.player.invulnT = 99; }, id);
    await H.adv(90); await H.canvas(`/tmp/tour_${id}.png`);
  }
  console.log('[t]', ids.join(','));
};
