// Talk to Old Brine with real keys, follow quest, rest at shrine, read menu tabs.
export default async (page, H) => {
  await H.load('?manual=1');
  const top = () => H.eval(() => { const e = window.__game.engine; const s = e.stack || e.scenes; return s[s.length - 1]?.constructor.name; });
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(3); };
  await H.eval(() => { const g = window.__game, p = g.world.player; const n = g.world.interactables.find((e) => e.id === 'old_brine'); window.__n = n; p.x = 400; p.y = 500; });
  console.log('[t] npc', await H.eval(() => { const n = window.__n; return n && [n.x, n.y]; }));
  await H.eval(() => { const n = window.__n; if (n) { window.__game.world.player.x = n.x - 14; window.__game.world.player.y = n.y; } });
  await H.adv(20); await H.canvas('/tmp/pt/30_npc.png');
  await tap('KeyE'); await H.adv(20); console.log('[t] top', await top()); await H.canvas('/tmp/pt/31_dlg.png');
  const dlg = () => H.eval(() => window.__game.dialogue.running); let lines = 0; for (let i = 0; i < 60 && (await dlg()); i++) { await H.adv(50); await H.canvas(`/tmp/pt/32_${String(i).padStart(2, '0')}.png`); await tap('Enter'); lines++; } console.log('[t] lines', lines);
  console.log('[t] after', await top(), await H.eval(() => JSON.stringify({ flags: Object.keys(window.__game.state.flags), q: window.__game.systems.quests.tracker?.() })));
  await H.adv(30); await H.canvas('/tmp/pt/33_after.png');
  await tap('Tab'); await H.adv(20);
  for (let i = 0; i < 8; i++) { await H.canvas(`/tmp/pt/4${i}_tab.png`); await tap('KeyE'); await H.adv(10); }
};
