// HUD extras: status icons, hurt arcs, xp line, minimap sizes, status tints on enemies. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/hs';
  await H.load('?manual=1'); await H.adv(30);
  const go = (z) => H.eval((z) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 10; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.player.invulnT = 99; }, z);
  await go('reef_garden'); await H.adv(60);
  await H.eval(() => { const g = window.__game, p = g.world.player; for (const [id, o] of [['burn', {}], ['regen', {}], ['might', {}], ['ward', {}], ['haste', {}]]) p.status.apply(id, o); g.state.xp += 20; g.state.settings.minimap = 'small'; });
  await H.adv(40); await H.canvas(`${out}_small.png`);
  await H.eval(() => { const g = window.__game; g.state.settings.minimap = 'large'; g.state.settings.uiScale = 'large'; });
  await H.adv(5); await H.canvas(`${out}_large.png`);
  await H.eval(() => { const g = window.__game; g.state.settings.uiScale = 'normal'; const w = g.world, p = w.player; p.invulnT = 0; p.takeHit({ dmg: 8, x: p.x + 60, y: p.y - 10, kb: 40 }); });
  await H.adv(6); await H.canvas(`${out}_hurt.png`);
  // enemies with effects
  await H.eval(() => { const g = window.__game, w = g.world, p = w.player; w.enemies.length = 0; p.invulnT = 99; });
  await H.eval(async () => { const g = window.__game, w = g.world, p = w.player; const { Enemy } = await import('/src/entities/enemy.js'); const ids = ['burn', 'chill', 'bleed', 'frail']; ids.forEach((id, i) => { const e = new Enemy(w, 'pinchling', p.x + 40 + i * 34, p.y - 8, {}); e.hp = e.maxHp * 0.6; w.enemies.push(e); e.status.apply(id, { power: 2 }); }); });
  await H.adv(30); await H.canvas(`${out}_enemies.png`);
};
