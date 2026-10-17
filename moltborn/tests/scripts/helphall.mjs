// Help compendium, Hall of Tides and the pause menu in the browser. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/hh';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.bosses.grumbold = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999;
    for (let i = 0; i < 6; i++) g.systems.history.add({ tier: i % 2 ? 'Deep Rift' : 'Shallow Rift', depth: 4 + (i % 3), max: 6, success: i % 3 !== 2, secs: 150 + i * 31, kills: 20 + i * 4, relics: [1, 2, 3], rw: { coins: 100 + i * 20 }, daily: i === 4 });
    g.systems.history.add({ kind: 'arena', tier: 'Pearl Gauntlet', depth: 11, max: 11, success: true, secs: 400, kills: 66, relics: [1], rw: { coins: 300 } });
    s.fish = { total: 0, species: {} }; for (const [id, n] of [['silverfin', 4], ['reef_bream', 2], ['sunfish', 1], ['greenback', 3], ['moon_koi', 1], ['lantern_smelt', 2]]) { s.fish.total += n; s.fish.species[id] = { n, best: 20 + n * 7, first: 1 }; }
    for (const [k, t] of [['boss', 'Defeated Grumbold.'], ['molt', 'Molted into the Warrior Crab.'], ['quest', 'Finished "Notices on the Tide".'], ['fish', 'Landed the Moon Koi: 88 cm.'], ['level', 'Reached level 10.'], ['rift', 'Cleared a Deep Rift in 5:05.'], ['trophy', 'Earned the trophy "Rift Runner".'], ['friend', 'A hatchling hatched and chose to follow you.']]) g.systems.journal.add(k, t);
    s.records.kills = { pinchling: 120, minnow: 80 }; s.records.chests = 14; s.records.dmgDealt = 24510; s.records.fished = 13; s.bounties = { claimed: 9, best: 2, streak: 1, list: [], day: 0 }; });
  await H.adv(20);
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  const log = [];
  await press('pause'); await H.adv(5); await H.canvas(`${out}_pause.png`);
  log.push(['pause', await H.eval(() => window.__game.engine.top.constructor.name + ' ' + window.__game.engine.top.items().join(','))]);
  // HELP is the fifth item
  for (let i = 0; i < 4; i++) await press('down'); await press('confirm'); await H.adv(5);
  log.push(['help', await H.eval(() => window.__game.engine.top.constructor.name)]); await H.canvas(`${out}_help_basics.png`);
  for (let p = 1; p < 7; p++) { await press('right'); await H.adv(3); if (p === 2 || p === 3 || p === 4) await H.canvas(`${out}_help_${p}.png`); }
  await press('down'); await press('down'); await H.canvas(`${out}_help_scrolled.png`);
  await press('cancel'); await H.adv(5);
  await press('down'); await press('confirm'); await H.adv(5);
  log.push(['hall', await H.eval(() => window.__game.engine.top.constructor.name)]); await H.canvas(`${out}_hall_runs.png`);
  await press('right'); await H.canvas(`${out}_hall_fish.png`); await press('right'); await H.canvas(`${out}_hall_journal.png`); await press('right'); await H.canvas(`${out}_hall_totals.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
