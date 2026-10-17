// A Trial room in a real rift: the chamber starts empty, waves drop in on the clock, the way stays shut until the tide turns and
// the foes are dead, and then the relic offer (the better pool) appears. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/tl';
  await H.load('?manual=1'); await H.adv(30);
  const seed = await H.eval(async () => { const { riftKind } = await import('/src/world/rift_gen.js'); for (let s = 1; s < 2000; s++) if (riftKind(s, 3, 6) === 'trial') return s; return null; });
  console.log('[t] seed', seed); if (!seed) { process.exitCode = 1; return; }
  await H.eval((seed) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 16; s.bosses.grumbold = true; s.bosses.mother_moray = true; for (const z of ['reef_garden', 'forest_roots']) s.visited[z] = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; ['first_rift'].forEach((k) => { s.flags['cs_' + k] = true; });
    g.systems.rifts.start({ tier: 'deep', seed }); }, seed);
  await H.adv(70); await H.eval(() => { const R = window.__game.systems.rifts; R.go(3); }); await H.adv(100);
  const info = () => H.eval(() => { const g = window.__game, R = g.systems.rifts, w = g.world, run = R.run; return { zone: w.zone.id, kind: run.kind, foes: w.enemies.filter((e) => e.alive && !e.def.friendly).length, pending: run.pending, waves: run.trial?.waves, left: run.trial ? +run.trial.left.toFixed(1) : null, done: run.trial?.done, cleared: run.cleared, top: g.engine.top.constructor.name }; });
  const log = [['arrive', await info()]];
  await H.eval(() => { window.__game.world.player.invulnT = 9999; });
  await H.adv(60 * 10); log.push(['10s', await info()]); await H.canvas(`${out}_wave.png`);
  await H.adv(60 * 20); log.push(['30s', await info()]);
  // before the clock ends, killing everything does not clear the room
  await H.eval(() => { const w = window.__game.world; for (let k = 0; k < 4; k++) for (const e of w.enemies) if (!e.def.friendly && e.alive && !e.dying) e.takeHit({ dmg: 99999, dir: 1, guardBreak: true, heavy: true }, w.player); });
  await H.adv(60); log.push(['killed early', await info()]);
  await H.adv(60 * 11); log.push(['after the clock', await info()]);
  await H.eval(() => { const w = window.__game.world; for (let k = 0; k < 4; k++) for (const e of w.enemies) if (!e.def.friendly && e.alive && !e.dying) e.takeHit({ dmg: 99999, dir: 1, guardBreak: true, heavy: true }, w.player); });
  await H.adv(160); log.push(['cleared', await info()]); await H.canvas(`${out}_relics.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
