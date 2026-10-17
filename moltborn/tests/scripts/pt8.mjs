// Shop (Cowrie) + molt shrine + death, all via real keys.
export default async (page, H) => {
  await H.load('?manual=1');
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(4); };
  const top = () => H.eval(() => { const e = window.__game.engine; const s = e.stack || e.scenes; return s[s.length - 1]?.constructor.name; });
  const dlg = () => H.eval(() => window.__game.dialogue.running);
  await H.eval(() => { const g = window.__game; g.state.coins = 300; g.buildWorld('reef_garden', 'west', {}); });
  await H.adv(30);
  await H.eval(() => { const g = window.__game, n = g.world.interactables.find((e) => e.id === 'cowrie'); g.world.player.x = n.x - 14; g.world.player.y = n.y; });
  await H.adv(20); await tap('KeyE');
  let k = 0; while ((await top()) === 'PlayScene' && (await dlg()) && k++ < 20) { await H.adv(40); await tap('Enter'); }
  console.log('[t] top after talk', await top(), k);
  await H.adv(20); await H.canvas('/tmp/pt/60_dialog_choice.png');
  await tap('Enter'); await H.adv(20); console.log('[t] top', await top()); await H.canvas('/tmp/pt/61_shop.png');
  await tap('Enter'); await H.adv(10); await H.canvas('/tmp/pt/62_buy.png');
  await tap('ArrowDown'); await tap('Enter'); await H.adv(10); await H.canvas('/tmp/pt/63_buy2.png');
  console.log('[t] coins', await H.eval(() => window.__game.state.coins), await H.eval(() => JSON.stringify(window.__game.state.inv)));
  await tap('Escape'); await H.adv(20); await H.canvas('/tmp/pt/62b.png'); console.log('[t] top', await top(), await dlg()); for (let q = 0; q < 10 && (await dlg()); q++) { await H.adv(60); await tap('Escape'); await H.adv(20); } console.log('[t] dlg', await dlg(), await top());
  await H.eval(() => { const g = window.__game; g.state.level = 6; g.state.ep = 8; g.state.inv.brine_core = 1; g.buildWorld('reef_arena', Object.keys(g.world.zone.entries)[0], {}); });
  await H.adv(20);
  const near = await H.eval(() => { const g = window.__game, n = g.world.interactables.find((e) => e.kind === 'molt'); if (!n) return null; g.world.player.x = n.x; g.world.player.y = n.y; return [n.x, n.y, n.id]; });
  console.log('[t] molt shrine', near);
  await H.adv(10); await tap('KeyE'); await H.adv(20); console.log('[t] top', await top()); await H.canvas('/tmp/pt/64_molt.png');
  await tap('ArrowDown'); for (let i = 0; i < 6; i++) { await tap('Enter'); await H.adv(30); await H.canvas('/tmp/pt/65_molt' + i + '.png'); console.log('[t] top', await top()); }
  await H.adv(600); console.log('[t] top', await top(), await H.eval(() => window.__game.state.form)); await H.canvas('/tmp/pt/67_after.png');
};
