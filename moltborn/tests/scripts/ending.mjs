export default async (page, H) => {
  await H.load('?manual=1'); const G = (fn, a) => H.eval(fn, a);
  for (const kind of ['slay', 'mercy', 'secret']) {
    await G((k) => { const g = window.__game; g.systems.endings.play(k); }, kind);
    for (let i = 0; i < 12; i++) { await G(() => { const g = window.__game; g.input.inject('confirm', true); g.advance(3); g.input.inject('confirm', false); g.advance(40); }); }
    const top = await G(() => window.__game.engine.top.constructor.name); console.log('[t]', kind, top);
    await H.canvas(`/tmp/end_${kind}.png`);
    await H.load('?manual=1');
  }
};
