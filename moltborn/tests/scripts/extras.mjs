// Photo mode, shrine travel, NPC barks and the Tide Board menu. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ex';
  await H.load('?manual=1'); await H.adv(30);
  const go = (z) => H.eval((z) => { const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 12; g.buildWorld(z, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; while (g.engine.top.constructor.name !== 'PlayScene') g.engine.pop(); g.world.enemies.length = 0; g.world.player.invulnT = 99; }, z);
  const key = async (code, n = 2) => { await H.eval((c) => { const g = window.__game; g.input.codeEdge.add(c); g.input.lastCode = c; }, code); await H.adv(1); };
  await go('reef_garden');
  // ---- barks: stand next to Madame Cowrie
  const bark = await H.eval(async () => { const g = window.__game, w = g.world, p = w.player; const { NpcEntity } = await import('/src/entities/interactables.js'); const n = w.interactables.find((i) => i instanceof NpcEntity && i.id === 'cowrie'); p.x = n.x + 30; p.y = n.y; g.advance(30); return { live: g.systems.barks.live.map((b) => b.text) }; });
  console.log('[t] bark', JSON.stringify(bark)); await H.adv(20); await H.canvas(`${out}_bark.png`);
  // ---- Tide Board
  await H.eval(async () => { const g = window.__game; const { BoardScene } = await import('/src/ui/board_scene.js'); g.state.bosses.grumbold = true; g.engine.push(new BoardScene(g)); }); await H.adv(5); await H.canvas(`${out}_board.png`);
  await H.eval(() => { window.__game.engine.pop(); });
  // ---- photo mode
  await H.eval(() => { const g = window.__game; g.input.inject('photo', true); }); await H.adv(2); await H.eval(() => { window.__game.input.inject('photo', false); }); await H.adv(3);
  const top = await H.eval(() => window.__game.engine.top.constructor.name); console.log('[t] photo top', top);
  await key('KeyF'); await key('KeyG'); await key('KeyZ'); await H.eval(() => { const g = window.__game; g.input.inject('left', true); }); await H.adv(30); await H.eval(() => { window.__game.input.inject('left', false); });
  await H.adv(3); await H.canvas(`${out}_photo.png`);
  const shot = await H.eval(async () => { const g = window.__game; const before = g.state.records.photos; g.input.inject('confirm', true); g.advance(2); g.input.inject('confirm', false); g.advance(4); return { photos: g.state.records.photos - before, top: g.engine.top.constructor.name }; });
  console.log('[t] shot', JSON.stringify(shot));
  await H.eval(() => { const g = window.__game; g.input.inject('cancel', true); }); await H.adv(2); await H.eval(() => { window.__game.input.inject('cancel', false); }); await H.adv(3);
  console.log('[t] back to', await H.eval(() => ({ top: window.__game.engine.top.constructor.name, photo: window.__game.photoMode }) ));
  // ---- travel: rest at two shrines, open the map next to the first
  const tr = await H.eval(async () => {
    const g = window.__game; const { Shrine } = await import('/src/entities/interactables.js');
    let w = g.world; let sh = w.interactables.find((i) => i instanceof Shrine); g.rest(sh); g.advance(60);
    g.buildWorld('reef_hollow', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; w = g.world; sh = w.interactables.find((i) => i instanceof Shrine); if (sh) { g.rest(sh); g.advance(60); }
    const T = g.systems.travel; const list = T.list();
    w = g.world; sh = w.interactables.find((i) => i instanceof Shrine); w.player.x = sh.x; w.player.y = sh.y; g.advance(5); w.player.combatT = 0;
    return { list, blocked: T.blocked(), zone: g.world.zone.id };
  });
  console.log('[t] travel setup', JSON.stringify(tr));
  await H.eval(() => { const g = window.__game; g.openMenu('map'); g.engine.top.sel.MAP.i = 0; }); await H.adv(4); await H.canvas(`${out}_map.png`);
  const trv = await H.eval(() => { const g = window.__game; const r = g.systems.travel.go(g.systems.travel.list()[0]); g.advance(120); return { ok: r, zone: g.world.zone.id, top: g.engine.top.constructor.name, travels: g.state.records.travels }; });
  console.log('[t] travelled', JSON.stringify(trv));
};
