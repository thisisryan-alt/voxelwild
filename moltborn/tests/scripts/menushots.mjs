// Extra menu tabs: bestiary, trophies, records, kitchen. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ms';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12;
    const r = s.records; r.kills = { pinchling: 40, minnow: 22, urchin: 7, hermit: 15, moray: 3 }; r.crits = 120; r.bestHit = 140; r.dashes = 600; r.chests = 12; r.bossBest = { grumbold: 95 }; r.bossTries = { grumbold: 2 }; r.flawless = {};
    s.bosses.grumbold = true; s.stats.deaths = 3; s.stats.parries = 30;
    for (const [id, n] of [['kelp_frond', 5], ['brine_salt', 4], ['urchin_spine', 3], ['jelly_gel', 2]]) { g.addItem(id, n); g.events.emit('gotitem', id); }
    g.systems.achievements.scan(); g.openMenu('beast');
  });
  await H.adv(10); await H.canvas(`${out}_beast.png`);
  await H.eval(() => { const g = window.__game; g.engine.top.sel.BEAST.i = 36; }); await H.adv(3); await H.canvas(`${out}_beast_boss.png`);
  await H.eval(() => { const g = window.__game; g.engine.pop(); g.openMenu('trophy'); }); await H.adv(5); await H.canvas(`${out}_trophy.png`);
  await H.eval(() => { const g = window.__game; g.engine.top.sel.TROPHY.sub = 6; }); await H.adv(3); await H.canvas(`${out}_records.png`);
  await H.eval(() => { const g = window.__game; g.systems.achievements.award(g.systems.achievements && (window.__A = null, { id: 'rift_walker', cat: 'challenge', tier: 'silver', name: 'Rift Walker', goal: 1, get: () => 0 }), true); g.systems.achievements.award({ id: 'pyromancers_pinch', cat: 'combat', tier: 'bronze', name: 'x', goal: 1, get: () => 0 }, true); g.engine.top.sel.TROPHY.sub = 5; g.engine.top.sel.TROPHY.i = 3; g.systems.cosmetics.equip('title', 'hatchling'); }); await H.adv(8); await H.canvas(`${out}_style.png`);
  await H.eval(() => { const g = window.__game; g.engine.pop(); g.openMenu('craft'); }); await H.adv(5); await H.canvas(`${out}_craft.png`);
  await H.eval(() => { const g = window.__game; g.engine.pop(); g.openMenu('items'); }); await H.adv(5); await H.canvas(`${out}_items.png`);
};
