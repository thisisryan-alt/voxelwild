// Companion tricks: treasure sense on the minimap, the warning shell's ward, the patient line at the fishing post. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/tr';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 999; s.flags.cs_hatch = true;
    g.systems.companion.adopt(); s.companion.level = 10; });
  await H.adv(30);
  log.push(['tricks', await H.eval(() => ({ tricks: window.__game.systems.companion.tricks().map((t) => t.id), next: window.__game.systems.companion.nextTrick(), bonus: window.__game.systems.difficulty.scale().xp }))]);
  // warning shell
  await H.eval(() => { const g = window.__game, w = g.world, p = w.player, e = w.spawnMinion('pinchling', p.x + 40, p.y, {}); e.minion = false; e.setState('windup'); w.companion.wardT = 0; p.status.remove('ward'); });
  await H.adv(10); log.push(['ward', await H.eval(() => ({ has: window.__game.world.player.status.has('ward'), t: window.__game.world.companion.wardT }))]);
  // the minimap shows closed chests the swimmer has not been near
  await H.eval(() => { const g = window.__game; g.world.enemies.length = 0; g.state.settings.minimap = 'large'; const m = g.systems.minimap; m.seen.fill(0); });
  await H.adv(2); await H.canvas(`${out}_minimap_sense.png`);
  const chests = await H.eval(() => { const g = window.__game, w = g.world, m = g.systems.minimap; const cs = w.interactables.filter((i) => i.constructor.name === 'Chest' && !i.opened); return { closed: cs.length, unseen: cs.filter((c) => !m.isSeen(c.x / 16, c.y / 16)).length }; });
  log.push(['chests', chests]);
  // fishing wait
  const waits = await H.eval(async () => { const g = window.__game, { FishingScene } = await import('/src/ui/fishing_scene.js'); const sp = { seed: 5, zs: {}, key: 'k' }; const hi = new FishingScene(g, sp).wait; g.state.companion.level = 1; const lo = new FishingScene(g, sp).wait; return { level10: +hi.toFixed(3), level1: +lo.toFixed(3) }; });
  log.push(['waits', waits]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
