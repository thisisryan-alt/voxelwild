// Real-key playthrough of the opening: title -> intro -> nursery, with screenshots.
export default async (page, H) => {
  await page.goto('http://localhost:8124/index.html?manual=1');
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  const top = () => H.eval(() => { const e = window.__game.engine; const s = e.stack || e.scenes; return s ? s[s.length - 1]?.constructor.name : '?'; });
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(3); };
  const hold = async (ks, n) => { for (const k of ks) await page.keyboard.down(k); await H.adv(n); for (const k of ks) await page.keyboard.up(k); };
  const st = () => H.eval(() => { const g = window.__game, p = g.world?.player; return p && { z: g.world.zone.id, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, st: p.state, lvl: g.state.level, coins: g.state.coins, xp: g.state.xp }; });
  await H.adv(60); await tap('Enter'); await H.adv(10); await tap('Enter');
  for (let i = 0; i < 12 && (await top()) !== 'PlayScene'; i++) { await H.adv(200); await tap('Enter'); }
  console.log('[t] top', await top(), JSON.stringify(await st()));
  await H.adv(90); await H.canvas('/tmp/pt/10_start.png');
  await hold(['ArrowRight'], 120); await H.canvas('/tmp/pt/11_right.png');
  console.log('[t]', JSON.stringify(await st()));
  await tap('Space', 5); await hold(['ArrowRight'], 60); await H.canvas('/tmp/pt/12_jump.png');
  console.log('[t]', JSON.stringify(await st()));
};
