// Moonpool Cove: the passage in the Coral Garden is shut by day and opens at night; the cove has Selene, a moon fishing spot, a mural
// and a cache. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/mp';
  await H.load('?manual=1'); await H.adv(30);
  const log = [];
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.bosses.grumbold = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 999;
    for (const k of ['first_night']) s.flags['cs_' + k] = true; g.systems.clock.jump('day'); g.systems.clock.update(0); });
  const exitInfo = await H.eval(() => { const g = window.__game, ex = g.world.zone.exits.find((e) => e.to === 'reef_moonpool'); const p = g.world.player; p.x = ex.x + ex.w / 2 + 6; p.y = ex.y + ex.h / 2; return { x: ex.x, y: ex.y, w: ex.w, h: ex.h, hasCond: typeof ex.cond }; });
  log.push(['exit', exitInfo]); await H.adv(30);
  log.push(['by day', await H.eval(() => window.__game.world.zone.id)]); await H.canvas(`${out}_day_gate.png`);
  // night: the same move works
  await H.eval(() => { const g = window.__game; g.systems.clock.jump('night'); g.systems.clock.update(0); const ex = g.world.zone.exits.find((e) => e.to === 'reef_moonpool'); const p = g.world.player; p.x = ex.x + ex.w / 2 + 4; p.y = ex.y + ex.h / 2; });
  await H.adv(120);
  log.push(['by night', await H.eval(() => ({ zone: window.__game.world.zone.id, px: Math.round(window.__game.world.player.x), py: Math.round(window.__game.world.player.y) }))]);
  await H.adv(60); await H.canvas(`${out}_cove.png`);
  const things = await H.eval(() => { const w = window.__game.world; const kinds = {}; for (const i of w.interactables) kinds[i.constructor.name] = (kinds[i.constructor.name] || 0) + 1; return { kinds, boost: w.interactables.filter((i) => i.constructor.name === 'FishSpot').map((i) => i.boost), foes: w.enemies.length }; });
  log.push(['cove', things]);
  // the moon spot makes the Moon Koi likely at night
  const odds = await H.eval(async () => { const g = window.__game, F = g.systems.fishing, spot = g.world.interactables.find((i) => i.constructor.name === 'FishSpot' && i.boost === 'moon'); let koi = 0, n = 400; for (let s = 0; s < n; s++) { const c = F.pick(spot, s + 3); if (c.fish.id === 'moon_koi') koi++; } const plain = { seed: 99 }; let koi2 = 0; for (let s = 0; s < n; s++) { const c = F.pick(plain, s + 3); if (c.fish.id === 'moon_koi') koi2++; } return { moon: koi, plain: koi2, n }; });
  log.push(['odds', odds]);
  // Selene
  await H.eval(() => { const g = window.__game, n = g.world.interactables.find((i) => i.npcId === 'selene' || i.def?.name?.includes('Selene')); const p = g.world.player; p.x = n.x - 20; p.y = n.y; g.systems.dialogue.start('selene', n); });
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  for (let i = 0; i < 5; i++) { await H.adv(30); await press('confirm'); }
  await H.canvas(`${out}_selene.png`);
  for (let i = 0; i < 12; i++) { await H.adv(30); await press('confirm'); }
  log.push(['dialogue ended', await H.eval(() => ({ running: window.__game.systems.dialogue.running, codex: !!window.__game.state.codex.moon_koi_tale }))]);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
