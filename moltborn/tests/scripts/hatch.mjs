export default async (page, H) => {
  await H.load('?manual=1');
  await H.adv(60);
  const r = await H.eval(async () => {
    const g = window.__game; const { T } = await import('/src/world/tiles.js');
    g.buildWorld('trench_temple', 'start', {}); g.advance(5);
    const w = g.world; let seals = 0;
    for (let y = 44; y < 58; y++) for (let x = 8; x < 10; x++) if (w.grid.get(x, y) === T.SEAL) seals++;
    const before = { seals, decor: w.decor.length, cocoon: w.decor.filter((d) => d.type === 'cocoons').length };
    for (let y = 44; y < 58; y++) for (let x = 8; x < 10; x++) if (w.grid.get(x, y) === T.SEAL) { w.grid.set(x, y, 0); g.events.emit('tilebroken', { x, y }); }
    g.advance(30);
    return { before, flag: g.flag('hatchlings_freed'), hatch: w.enemies.filter((e) => e.type === 'hatchling').length, decor: w.decor.length, cocoon: w.decor.filter((d) => d.type === 'cocoons').length };
  });
  console.log('[t]', JSON.stringify(r));
  await H.canvas('/tmp/hatch.png');
};
