// The tide clock in the browser: shots of the reef at dawn, noon, dusk and night with the HUD clock; night events; status icons. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ck';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; });
  await H.adv(30);
  const log = [];
  for (const ph of ['dawn', 'day', 'dusk', 'night']) {
    await H.eval((ph) => { const g = window.__game; g.systems.clock.jump(ph); g.systems.clock.update(0); }, ph); await H.adv(90);
    if (ph === 'night') await H.eval(() => { const w = window.__game.world; w.sky.force('plankton', { mid: true }); w.sky.force('moonbeam', { mid: true }); });
    await H.adv(30); await H.canvas(`${out}_${ph}.png`);
    log.push([ph, await H.eval(() => { const g = window.__game, C = g.systems.clock, p = g.world.player; return { phase: C.phase.id, frac: +C.frac().toFixed(3), xpMult: +g.systems.difficulty.scale().xp.toFixed(2), statuses: p.status.ids(), events: g.world.sky.active.map((e) => e.kind) }; })]);
  }
  // a foe born at night is warier than one born at noon
  const aggro = await H.eval(() => { const g = window.__game, w = g.world, p = w.player, C = g.systems.clock; C.jump('day'); const a = w.spawnMinion('pinchling', p.x + 100, p.y, {}).p.aggro; C.jump('night'); const b = w.spawnMinion('pinchling', p.x + 120, p.y, {}).p.aggro; return [a, b]; });
  log.push(['aggro day/night', aggro]);
  // the abyss barely changes
  await H.eval(() => { const g = window.__game; g.buildWorld('abyss_lanterns', undefined, { silentBanner: true }); g.systems.clock.jump('night'); g.systems.clock.update(0); }); await H.adv(60); await H.canvas(`${out}_abyss_night.png`);
  // off switch
  await H.eval(() => { const g = window.__game; g.state.settings.dayNight = 'off'; g.systems.clock.update(2); }); await H.adv(10);
  log.push(['off', await H.eval(() => ({ statuses: window.__game.world.player.status.ids(), xp: +window.__game.systems.difficulty.scale().xp.toFixed(2) }))]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
