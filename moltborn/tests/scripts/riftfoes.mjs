// The four rift creatures in the open: each one runs through its whole behaviour (states seen are logged), the latchleech clings and
// is shaken off by a dash, the tidecaller shoves the swimmer, the glass golem shatters into shardlings. OUT prefix for screenshots.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/rfoe';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game; g.state.form = 'warrior'; g.state.level = 12; g.buildWorld('abyss_lanterns', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; });
  const setup = (type, dx, dy) => H.eval(([type, dx, dy]) => { const g = window.__game, w = g.world, p = w.player; w.enemies.length = 0; p.hp = p.stats.maxHp; p.invulnT = 0; p.status.entries().forEach((s) => p.status.remove?.(s.id)); const e = w.spawnMinion(type, p.x + dx, p.y + dy, {}); e.minion = false; e.xpMult = 0; window.__e = e; window.__seen = {}; window.__hp0 = p.hp; return !!e; }, [type, dx, dy]);
  const sample = async (frames, every = 6) => { for (let i = 0; i < frames; i += every) { await H.adv(every); await H.eval(() => { const e = window.__e; if (e) window.__seen[e.state] = (window.__seen[e.state] || 0) + 1; }); } return H.eval(() => ({ seen: window.__seen, alive: window.__e.alive, hp: window.__e.hp })); };
  const log = [];
  // Shardling: should fade, appear and fire, and the player should have been shot at
  await setup('shardling', 90, -10); const sh = await sample(420); log.push(['shardling', sh, await H.eval(() => ({ playerHpLost: window.__hp0 - window.__game.world.player.hp, projectiles: window.__game.world.projectiles.length }))]);
  await H.canvas(`${out}_shardling.png`);
  // Latchleech: latch, then dash to shake it off
  await setup('latchleech', 60, 0);
  let latched = false; for (let i = 0; i < 100 && !latched; i++) { await H.adv(6); latched = await H.eval(() => window.__e.state === 'attached'); }
  const mid = await H.eval(() => ({ state: window.__e.state, chill: window.__game.world.player.status.has?.('chill') ?? null }));
  await H.canvas(`${out}_latched.png`);
  await H.adv(60); const hpDrain = await H.eval(() => window.__hp0 - window.__game.world.player.hp);
  await H.eval(() => { const g = window.__game, p = g.world.player; g.input.inject('dash', true); }); await H.adv(4); await H.eval(() => window.__game.input.inject('dash', false)); await H.adv(20);
  const after = await H.eval(() => ({ state: window.__e.state, attached: !!window.__e.attached }));
  log.push(['latchleech', { latched, mid, hpDrain, after }]);
  // Tidecaller: gust pushes the swimmer
  await setup('tidecaller', 80, -110); await H.eval(() => { const p = window.__game.world.player; p.y -= 60; p.vy = 0; }); let maxPush = 0;
  for (let i = 0; i < 90; i++) { await H.adv(6); const v = await H.eval(() => window.__game.world.zone.areas.filter((a) => a.kind === 'current' && a.ttl > 0).length); maxPush = Math.max(maxPush, v); await H.eval(() => { const e = window.__e; window.__seen[e.state] = (window.__seen[e.state] || 0) + 1; }); }
  log.push(['tidecaller', { seen: await H.eval(() => window.__seen), gustAreas: maxPush, leftover: await H.eval(() => window.__game.world.zone.areas.filter((a) => a.ttl !== undefined).length) }]);
  await H.canvas(`${out}_tidecaller.png`);
  // Glass golem: slam then die into shardlings
  await setup('glassgolem', 50, 0); const gg = await sample(300);
  await H.eval(() => { const e = window.__e; e.guardFront = false; e.takeHit({ dmg: 999, dir: 1, heavy: true }, window.__game.world.player); }); await H.adv(60);
  log.push(['glassgolem', gg, await H.eval(() => ({ shardlings: window.__game.world.enemies.filter((x) => x.type === 'shardling' && x.alive).length }))]);
  await H.canvas(`${out}_golem.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
