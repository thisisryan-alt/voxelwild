// The console commands for the newer systems: surge, bounties, fish, time, tricks, journal and oaths. Run with the dev flag.
export default async (page, H) => {
  await H.load('?manual=1&dev=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, o = {}; const { DevConsole } = await import('/src/dev/console.js');
    g.state.form = 'warrior'; g.state.level = 12; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0;
    const c = new DevConsole(g); g.engine.push(c); g.advance(2);
    const run = (s) => { c.out.length = 0; c.exec(s); return c.out.slice(1).join(' | '); };
    o.surge = run('surge') + ' -> ' + g.systems.surge.state;
    o.bounties0 = run('bounties').split(' | ').length; o.bounties1 = run('bounties done').split(' | ').every((l) => l.startsWith('[x]'));
    o.fishNone = run('fish').slice(0, 30); o.fishGive = run('fish silverfin 3') + ' ' + g.itemCount('fish_silverfin'); o.fishBad = run('fish nothing');
    o.time = run('time night'); o.phase = g.systems.clock.phase.id;
    o.tricksNone = run('tricks 5'); g.systems.companion.adopt(); o.tricks = run('tricks 8');
    g.systems.journal.add('quest', 'A test entry.'); o.journal = run('journal 1');
    o.oaths = run('oaths iron fury nonsense') + ' ' + g.state.lastOaths.join(); o.oathsClear = run('oaths').slice(0, 20);
    return o;
  });
  for (const [k, v] of Object.entries(r)) console.log('[t]', k, JSON.stringify(v));
};
