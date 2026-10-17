// The cutscene art for the Warden, the angler's dusk and the moonlit reef, plus the hooks that queue the new stories. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/nc2';
  await H.load('?manual=1'); await H.adv(30);
  for (const name of ['angler', 'moonlit', 'boss:rift_warden']) {
    await H.eval(async (n) => { const { drawScene } = await import('/src/gfx/cutscene_art.js'); const c = document.getElementById('game').getContext('2d'); window.__game.engine.pause = true; drawScene(c, n, 2.6, {}); }, name);
    await H.canvas(`${out}_${name.replace(':', '_')}.png`);
  }
  const hooks = await H.eval(() => {
    const g = window.__game; g.systems.story.queue.length = 0; const ev = g.events, r = {};
    ev.emit('fish', 'silverfin', 20, {}); r.catch = g.systems.story.queue.map((q) => q.id).join();
    ev.emit('fish', 'moon_koi', 80, {}); r.legend = g.systems.story.queue.map((q) => q.id).join();
    ev.emit('phase', 'night'); ev.emit('bounty', {}); ev.emit('boss', 'rift_warden'); r.all = g.systems.story.queue.map((q) => q.id).join();
    r.codex = ['fish_lore', 'moon_koi_tale', 'night_tide', 'board_notes'].map((k) => !!g.state.codex[k]).join();
    ev.emit('wardenslain', true); ev.emit('sold', 'fish_silverfin', 1, 12); r.codex2 = ['warden_log', 'tunny_lure'].map((k) => !!g.state.codex[k]).join();
    return r;
  });
  console.log('[t]', JSON.stringify(hooks));
};
