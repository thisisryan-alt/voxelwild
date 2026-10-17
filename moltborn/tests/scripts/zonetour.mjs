// Screenshots along a zone: ZONE, XS (tile columns), FROM (start row for the floor scan), OUT prefix.
export default async (page, H) => {
  const zone = process.env.ZONE, xs = (process.env.XS || '10,40,70,95').split(',').map(Number), from = +(process.env.FROM || 0), out = process.env.OUT || '/tmp/zt';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval((zone) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 12; g.buildWorld(zone, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.bannerState = null; g.bannerState = null; }, zone);
  for (const x of xs) {
    await H.eval(([x, from]) => { const g = window.__game, w = g.world, p = w.player, gr = w.grid; let y = from; while (y < gr.h - 1 && gr.solid(x, y)) y++; while (y < gr.h - 1 && !gr.solid(x, y)) y++; p.x = (x + 0.5) * 16; p.y = y * 16 - p.h / 2 - 1; p.vx = p.vy = 0; p.invulnT = 999; w.enemies.length = 0; if (w.boss) w.boss.engaged = true && false; g.bannerState = null; w.snapCamera(); }, [x, from]);
    await H.adv(40); await H.canvas(`${out}_${x}.png`);
  }
};
