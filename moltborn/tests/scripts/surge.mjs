// A tidal surge in the browser: warning, the currents and the picture streaking, the swimmer being pushed, flotsam afterwards. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/sg';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 999; g.systems.surge.next = 0.5; });
  await H.adv(60); log.push(['warn', await H.eval(() => ({ state: window.__game.systems.surge.state, areas: window.__game.world.zone.areas.filter((a) => a.ttl !== undefined).length }))]);
  await H.canvas(`${out}_warn.png`);
  await H.adv(60 * 6); log.push(['rush', await H.eval(() => { const S = window.__game.systems.surge; return { state: S.state, dir: S.dir, areas: window.__game.world.zone.areas.filter((a) => a.ttl !== undefined).length, events: window.__game.world.sky.active.map((e) => e.kind) }; })]);
  // put the swimmer in open water so the current can carry them
  await H.eval(() => { const p = window.__game.world.player; p.y -= 70; p.vy = 0; window.__x0 = p.x; });
  await H.adv(40); await H.canvas(`${out}_rush.png`);
  log.push(['pushed', await H.eval(() => ({ dx: Math.round(window.__game.world.player.x - window.__x0), vx: Math.round(window.__game.world.player.vx), dir: window.__game.systems.surge.dir }))]);
  await H.adv(60 * 14); log.push(['calm', await H.eval(() => { const g = window.__game; return { state: g.systems.surge.state, areas: g.world.zone.areas.filter((a) => a.ttl !== undefined).length, pickups: g.world.pickups.length, surges: g.state.records.surges }; })]);
  await H.canvas(`${out}_flotsam.png`);
  // collecting some of it
  await H.eval(() => { const g = window.__game, p = g.world.player, pk = g.world.pickups.filter((x) => !x.fixed)[0]; if (pk) { p.x = pk.x; p.y = pk.y; } window.__c0 = g.state.coins; });
  await H.adv(90); log.push(['collected', await H.eval(() => ({ coins: window.__game.state.coins - window.__c0, left: window.__game.world.pickups.length }))]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
