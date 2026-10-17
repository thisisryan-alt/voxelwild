// Vents (warn / on / off) and the current band in domain_halls.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 20; g.buildWorld('domain_halls', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; const w = g.world, p = w.player; w.enemies.length = 0; w.boss = null; p.recalc(); p.invulnT = 999; p.x = 33 * 16; p.y = 47 * 16; w.snapCamera(); });
  for (const [name, t] of [['a', 0], ['b', 70], ['c', 60], ['d', 60]]) { await H.adv(t); await H.canvas(`/tmp/claude-0/cs/hz_${name}.png`); }
  await H.eval(() => { const g = window.__game, p = g.world.player; p.x = 72 * 16; p.y = 47 * 16; p.invulnT = 999; g.world.snapCamera(); });
  await H.adv(50); await H.canvas('/tmp/claude-0/cs/hz_e.png');
};
