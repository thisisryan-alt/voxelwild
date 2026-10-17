// The Rift Warden: the last chamber of a rift holds the boss, every attack and phase runs without errors, and killing it ends the run
// in victory. OUT prefix for screenshots. Run: node tools/run.mjs tests/scripts/warden.mjs
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/wd';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 14; s.bosses.grumbold = true;
    for (const z of ['reef_garden', 'forest_roots', 'kingdom_gate']) s.visited[z] = true;
    g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0;
    g.systems.achievements.timer = -999; s.flags.met_warden = true;
    g.systems.rifts.start({ tier: 'shallow', seed: 4242 });
  });
  await H.adv(70);
  await H.eval(() => { window.__game.systems.rifts.go(4); }); await H.adv(100);
  const info = () => H.eval(() => { const g = window.__game, w = g.world, b = w.boss; return { zone: w.zone.id, boss: b && { hp: b.hp, max: b.maxHp, engaged: b.engaged, phase: b.phase.name, alpha: b.alpha, pose: b.pose, x: Math.round(b.x), y: Math.round(b.y) }, foes: w.enemies.filter((e) => e.alive && !e.def.friendly).length, run: g.systems.rifts.run && { depth: g.systems.rifts.run.depth, cleared: g.systems.rifts.run.cleared } }; });
  log.push(['arrived', await info()]);
  await H.canvas(`${out}_arrive.png`);
  // walk into the arena and wake it
  await H.eval(() => { const g = window.__game, b = g.world.boss, p = g.world.player; p.invulnT = 9999; p.x = b.trigger.x * 16 + 200; p.y = b.y; g.world.clearSpawn(p); });
  await H.adv(120); log.push(['engaged', await info()]);
  const names = []; const seen = new Set();
  // let it fight itself for a while, noting which attacks fire, with shots of a few
  for (let i = 0; i < 24; i++) {
    await H.adv(45);
    const s = await H.eval(() => { const b = window.__game.world.boss; return { a: b.lastAtk, p: b.phase.name, ph: b.phaseIdx, hp: b.hp, teles: b.teles.length }; });
    if (!seen.has(s.a)) { seen.add(s.a); names.push(s.a); if (s.teles) await H.canvas(`${out}_${s.a}.png`); }
    if (i === 10) await H.eval(() => { const b = window.__game.world.boss; b.takeHit({ dmg: b.maxHp * 0.4, dir: 1 }, window.__game.world.player); });
    if (i === 18) await H.eval(() => { const b = window.__game.world.boss; b.takeHit({ dmg: b.maxHp * 0.3, dir: 1 }, window.__game.world.player); });
  }
  log.push(['attacks seen', names]); log.push(['mid-fight', await info()]);
  await H.canvas(`${out}_fight.png`);
  // finish it
  await H.eval(() => { const g = window.__game, b = g.world.boss; b.armor = 0; b.takeHit({ dmg: 99999, dir: 1, crit: true }, g.world.player); });
  await H.adv(400); log.push(['after kill', await info()]);
  await H.adv(300);
  const end = await H.eval(() => { const g = window.__game; return { zone: g.world.zone.id, top: g.engine.top.constructor.name, wardens: g.state.records.wardens, flawless: !!g.state.records.flawless.rift_warden, bossFlag: !!g.state.bosses.rift_warden, rifts: g.state.records.rifts, run: !!g.systems.rifts.run }; });
  log.push(['end', end]);
  // a second visit must spawn it again
  await H.eval(() => { const g = window.__game; g.engine.top.t = 1; g.input.inject('confirm', true); }); await H.adv(3); await H.eval(() => { window.__game.input.inject('confirm', false); }); await H.adv(60);
  await H.eval(() => { const g = window.__game; while (g.engine.top.constructor.name !== 'PlayScene' && g.engine.scenes.length > 1) g.engine.pop(); });
  await H.eval(() => { const g = window.__game; g.systems.rifts.start({ tier: 'shallow', seed: 99 }); }); await H.adv(70);
  await H.eval(() => { window.__game.systems.rifts.go(4); }); await H.adv(100);
  log.push(['second visit', await info()]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
