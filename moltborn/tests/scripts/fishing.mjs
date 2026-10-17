// Fishing in the browser: find a spot in the reef, walk to it, cast, answer the bite, reel with a simple controller, land the fish,
// cook with it. OUT prefix for screenshots.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/fs';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 999; });
  await H.adv(20);
  const spot = await H.eval(() => { const g = window.__game, w = g.world, sp = w.interactables.find((i) => i.constructor.name === 'FishSpot'); if (!sp) return null; const p = w.player; p.x = sp.x - 12; p.y = sp.y - 8; return { x: sp.x, y: sp.y, ready: sp.ready, prompt: sp.prompt() }; });
  log.push(['spot', spot]); if (!spot) { console.log('[t] no spot'); return; }
  await H.adv(10); await H.canvas(`${out}_spot.png`);
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  await H.eval(() => { const g = window.__game, sp = g.world.interactables.find((i) => i.constructor.name === 'FishSpot'); sp.interact(g); }); await H.adv(10);
  log.push(['scene', await H.eval(() => window.__game.engine.top.constructor.name)]);
  await H.canvas(`${out}_wait.png`);
  // wait for the bite
  let state = ''; for (let i = 0; i < 80 && state !== 'bite'; i++) { await H.adv(8); state = await H.eval(() => window.__game.engine.top.state); }
  log.push(['bite', state]); await H.canvas(`${out}_bite.png`);
  await press('confirm'); await H.adv(5);
  log.push(['reeling', await H.eval(() => ({ st: window.__game.engine.top.state, fish: window.__game.engine.top.catchInfo.fish.id, len: window.__game.engine.top.catchInfo.len }))]);
  // reel with a proportional controller, grabbing a frame midway
  let shot = false;
  for (let i = 0; i < 80 && (await H.eval(() => window.__game.engine.top.state)) === 'reel'; i++) {
    await H.eval(() => { const g = window.__game, sc = g.engine.top, R = sc.reel; const center = R.zone + R.zoneH / 2; g.input.inject('confirm', R.pos > center || (R.pos > center - 0.02 && R.vel < 0)); });
    await H.adv(4); if (!shot && i === 12) { await H.canvas(`${out}_reel.png`); shot = true; }
  }
  await H.eval(() => window.__game.input.inject('confirm', false)); await H.adv(5);
  const fin = await H.eval(() => { const g = window.__game, sc = g.engine.top; return { st: sc.state, caught: !!sc.result, fresh: sc.result?.fresh, total: g.state.fish?.total || 0, items: Object.keys(g.state.inv).filter((k) => k.startsWith('fish_')), fished: g.state.records.fished }; });
  log.push(['result', fin]); await H.canvas(`${out}_result.png`);
  await H.adv(40); await press('confirm'); await H.adv(10);
  log.push(['back', await H.eval(() => { const g = window.__game, sp = g.world.interactables.find((i) => i.constructor.name === 'FishSpot'); return { top: g.engine.top.constructor.name, spotReady: sp.ready, prompt: sp.prompt() }; })]);
  // cook with it: give the ingredients for a dish and check the crafting system accepts the recipe
  const cook = await H.eval(() => { const g = window.__game, C = g.systems.crafting; g.grantItem('fish_silverfin', 2, false); g.grantItem('brine_salt', 1, false); const r = C.known ? C.known('grilled_silverfin') : null; return { known: r, can: C.canMake ? C.canMake({ id: 'grilled_silverfin', needs: { fish_silverfin: 2, brine_salt: 1 } }) : null }; });
  log.push(['cook', cook]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
