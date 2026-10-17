// The cutscene art added for rifts, the gauntlet, the kitchen and the hatchling, plus the story hooks. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/nc';
  await H.load('?manual=1'); await H.adv(30);
  for (const name of ['rift', 'gauntlet', 'kitchen', 'hatch']) {
    await H.eval(async (n) => { const { drawScene } = await import('/src/gfx/cutscene_art.js'); const c = document.getElementById('game').getContext('2d'); window.__game.engine.pause = true; drawScene(c, n, 2.6, {}); }, name);
    await H.canvas(`${out}_${name}.png`);
  }
  const hooks = await H.eval(() => { const g = window.__game; g.systems.story.queue.length = 0; const ev = g.events; ev.emit('rift', 'enter'); ev.emit('arena', 'enter'); ev.emit('crafted', 'x', 1); ev.emit('companion', 'adopt'); return g.systems.story.queue.map((q) => q.id); });
  console.log('[t] queued', JSON.stringify(hooks));
};
