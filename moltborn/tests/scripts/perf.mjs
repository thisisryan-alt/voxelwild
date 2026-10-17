export default async (page, H) => {
  await H.load('?manual=1');
  const r = await H.eval(() => {
    const g = window.__game; const out = {};
    for (const z of ['reef_nursery', 'reef_garden', 'reef_hollow', 'reef_arena']) { const t0 = performance.now(); g.buildWorld(z, z === 'reef_hollow' ? 'west' : (z === 'reef_arena' ? 'west' : (z === 'reef_garden' ? 'west' : 'start')), { silentBanner: true }); out[z] = Math.round(performance.now() - t0); }
    g.advance(60);
    const t0 = performance.now(); for (let i = 0; i < 120; i++) g.engine.step(1 / 60); const upd = (performance.now() - t0) / 120;
    const t1 = performance.now(); for (let i = 0; i < 60; i++) g.engine.render(); const drw = (performance.now() - t1) / 60;
    return { build: out, upd: +upd.toFixed(2), draw: +drw.toFixed(2) };
  });
  console.log('[t]', JSON.stringify(r));
};
