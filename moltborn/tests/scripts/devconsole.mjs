// Developer console commands (opened by code here; in the page it needs ?dev=1 and F9). Also accessibility switches.
export default async (page, H) => {
  await H.load('?manual=1&dev=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, o = {}; const { DevConsole, COMMANDS } = await import('/src/dev/console.js'); o.dev = g.devMode;
    g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0;
    const c = new DevConsole(g); g.engine.push(c); g.advance(2);
    const run = (s) => { c.out.length = 0; c.exec(s); return c.out.slice(1).join(' | '); };
    o.give = run('give kelp_wrap 3') + ' ' + g.itemCount('kelp_wrap'); o.coins = run('coins 500'); o.level = run('level 8'); o.stats = run('stats').slice(0, 60);
    o.spawn = run('spawn pinchling 2') + ' foes=' + g.world.enemies.filter((e) => e.type === 'pinchling').length; o.elite = run('elite armored'); o.status = run('status haste 5') + g.world.player.status.has('haste');
    o.killall = run('killall'); o.god = run('god') + ' ' + g.god; o.bad = run('frobnicate'); o.tp = run('tp reef_hollow'); o.zone = g.world.zone.id; o.trophy = run('trophy all'); o.count = g.systems.achievements.count();
    o.hist = c.hist.length; c.key({ code: 'Escape', preventDefault() {}, stopPropagation() {} }); o.closed = g.engine.top.constructor.name;
    // typing path
    const c2 = new DevConsole(g); g.engine.push(c2); for (const ch of 'heal') c2.key({ code: 'Key' + ch.toUpperCase(), key: ch, preventDefault() {}, stopPropagation() {} }); c2.key({ code: 'Enter', preventDefault() {}, stopPropagation() {} }); o.typed = c2.out.slice(-2).join(' | '); c2.key({ code: 'F9', preventDefault() {}, stopPropagation() {} });
    // accessibility: colour-blind matrix and telegraph colours
    g.state.settings.colorblind = 'red-green'; g.events.emit('setting', 'colorblind', 'red-green'); o.filter = document.getElementById('game').style.filter; o.tele = g.systems.access.tele('#ff4a3a');
    g.state.settings.colorblind = 'off'; g.events.emit('setting', 'colorblind', 'off'); o.filterOff = document.getElementById('game').style.filter; o.teleOff = g.systems.access.tele('#ff4a3a');
    g.state.settings.highContrast = 1; o.contrast = g.systems.access.contrast;
    return o;
  });
  console.log('[t]', JSON.stringify(r));
};
