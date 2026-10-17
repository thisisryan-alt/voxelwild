// Old Tunny in the browser: he stands by the Tide Board, talks, opens the sell screen, sells fish, and the lure quest is wired. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/mk';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.bosses.grumbold = true; g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999; g.world.player.invulnT = 999;
    g.grantItem('fish_silverfin', 5, false); g.grantItem('fish_moon_koi', 1, false); g.grantItem('fish_sunfish', 1, false); g.grantItem('kelp_frond', 4, false); });
  const log = [];
  const npc = await H.eval(() => { const g = window.__game, w = g.world, n = w.interactables.find((i) => i.constructor.name === 'NPC' && i.id === 'tunny') || w.interactables.find((i) => i.npcId === 'tunny' || i.def?.name?.includes('Tunny')); if (!n) return null; w.player.x = n.x - 20; w.player.y = n.y; return { x: n.x, y: n.y, kind: n.constructor.name }; });
  log.push(['npc', npc]); await H.adv(10); await H.canvas(`${out}_npc.png`);
  const press = async (a) => { await H.eval((a) => window.__game.input.inject(a, true), a); await H.adv(3); await H.eval((a) => window.__game.input.inject(a, false), a); await H.adv(3); };
  await H.eval(() => { const g = window.__game, n = g.world.interactables.find((i) => i.npcId === 'tunny' || i.id === 'tunny' || i.def?.name?.includes('Tunny')); g.systems.dialogue.start('tunny', n); });
  for (let i = 0; i < 6; i++) { await H.adv(30); await press('confirm'); }
  log.push(['top', await H.eval(() => window.__game.engine.top.constructor.name + ' ' + (window.__game.playScene.dialogue.active ? 'dialogue' : ''))]);
  await H.canvas(`${out}_dialogue.png`);
  // jump straight to the sell scene (the dialogue menu path is covered by unit tests of the generator)
  await H.eval(() => { while (window.__game.systems.dialogue.running && window.__game.engine.top.constructor.name !== 'PlayScene') window.__game.engine.pop(); window.__game.playScene.dialogue.active = false; window.__game.systems.dialogue.running = false; window.__game.openSell('tunny'); }); await H.adv(5);
  log.push(['sell', await H.eval(() => ({ top: window.__game.engine.top.constructor.name, n: window.__game.engine.top.list.length, coins: window.__game.state.coins }))]); await H.canvas(`${out}_sell.png`);
  await press('confirm'); await press('down'); await press('right'); await H.adv(5);
  log.push(['after sales', await H.eval(() => ({ coins: window.__game.state.coins, inv: Object.fromEntries(Object.entries(window.__game.state.inv).filter(([k]) => k.startsWith('fish_') || k === 'kelp_frond')), sold: window.__game.state.records.sold, quest: window.__game.systems.quests.isActive('sq_catch') }))]);
  await H.canvas(`${out}_sold.png`);
  for (const l of log) console.log('[t]', JSON.stringify(l));
};
