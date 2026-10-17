// Oaths in the browser: choosing a rift at the Tide Board opens the oath scene, oaths change the run (foe multipliers, your own
// health, the payout), and they are forgotten when the run ends. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/oa';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.bosses.grumbold = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 9999; s.flags.cs_first_rift = true; window.__hp0 = g.world.player.stats.maxHp; });
  await H.eval(async () => { const m = await import('/src/ui/board_scene.js'); const g = window.__game; g.engine.push(new m.BoardScene(g)); }); await H.adv(5);
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  await press('confirm'); await H.adv(5);
  log.push(['after choosing a rift', await H.eval(() => window.__game.engine.top.constructor.name)]); await H.canvas(`${out}_scene.png`);
  // iron (row 0), fury (row 1), frail (row 4)
  await press('confirm'); await press('down'); await press('confirm'); await press('down'); await press('down'); await press('down'); await press('confirm'); await H.adv(3);
  log.push(['picked', await H.eval(() => [...window.__game.engine.top.picked])]); await H.canvas(`${out}_picked.png`);
  await press('menu'); await H.adv(120);
  log.push(['in the rift', await H.eval(() => { const g = window.__game, R = g.systems.rifts, p = g.world.player; const m = R.mult(); return { zone: g.world.zone.id, oaths: R.run?.oaths, state: g.state.riftOaths, hpRatio: +(p.stats.maxHp / window.__hp0).toFixed(2), hp: +m.hp.toFixed(2), dmg: +m.dmg.toFixed(2) }; })]);
  await H.canvas(`${out}_run.png`);
  // end the run and read the payout
  const rw = await H.eval(() => { const R = window.__game.systems.rifts; R.run.depth = 3; const bonus = R.rewards(false); const none = (() => { const keep = R.run.oaths; R.run.oaths = []; const r = R.rewards(false); R.run.oaths = keep; return r; })(); return { with: bonus.coins, without: none.coins, xpWith: bonus.xp, xpWithout: none.xp }; });
  log.push(['payout', rw]);
  await H.eval(() => window.__game.systems.rifts.abandon()); await H.adv(200);
  log.push(['after the run', await H.eval(() => { const g = window.__game, p = g.world.player; return { top: g.engine.top.constructor.name, state: g.state.riftOaths, oathRuns: g.state.records.oathRuns, hpRatio: +(p.stats.maxHp / window.__hp0).toFixed(2), last: g.state.lastOaths, logged: g.state.runLog?.slice(-1)[0]?.oaths }; })]);
  await H.canvas(`${out}_summary.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
