export default async (page, H) => {
  await H.load('?manual=1'); const G = (fn, a) => H.eval(fn, a);
  for (const kind of ['trident', 'secret']) {
    await G((k) => { window.__game.systems.endings.play(k); }, kind);
    for (let i = 0; i < 40; i++) { await G(() => { const g = window.__game; g.input.inject('confirm', true); g.advance(3); g.input.inject('confirm', false); g.advance(150); }); if (i % 4 === 0) await H.canvas(`/tmp/es_${kind}_${String(i).padStart(2, '0')}.png`); const t = await G(() => window.__game.engine.top.constructor.name); if (t === 'CreditsScene' && i > 20) break; }
    await H.load('?manual=1');
  }
};
