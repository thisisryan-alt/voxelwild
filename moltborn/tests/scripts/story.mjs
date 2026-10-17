export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const top = () => H.eval(() => { const e = window.__game.engine, s = e.scenes; return s[s.length - 1]?.constructor.name; });
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(4); };
  await H.eval(() => { const g = window.__game; g.buildWorld('forest_edge', Object.keys(g.world.zone.entries)[0], {}); });
  await H.adv(90); console.log('[t] forest top', await top(), await H.eval(() => window.__game.systems.story.queue.length));
  await H.canvas('/tmp/story_a.png');
  for (let i = 0; i < 6 && (await top()) === 'CutsceneScene'; i++) { await H.adv(150); await tap('Enter'); await H.adv(20); await tap('Enter'); }
  console.log('[t] after', await top(), 'flag', await H.eval(() => !!window.__game.state.flags.cs_enter_forest));
  await H.adv(60); console.log('[t] again?', await top());
  await H.eval(() => { const g = window.__game; g.events.emit('boss', 'grumbold'); });
  await H.adv(240); console.log('[t] grumbold story', await top()); await H.canvas('/tmp/story_b.png');
  for (let i = 0; i < 6 && (await top()) === 'CutsceneScene'; i++) { await H.adv(150); await tap('Enter'); await H.adv(20); await tap('Enter'); }
  await H.eval(() => { const g = window.__game; g.events.emit('evolved', 'warrior', 'shore'); });
  await H.adv(120); console.log('[t] molt story', await top());
  for (let i = 0; i < 6 && (await top()) === 'CutsceneScene'; i++) { await H.adv(150); await tap('Enter'); await H.adv(20); await tap('Enter'); }
  console.log('[t] end', await top(), await H.eval(() => Object.keys(window.__game.state.flags).filter((k) => k.startsWith('cs_')).join(',')));
};
