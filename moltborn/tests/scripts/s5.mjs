export default async (page, H) => {
  await H.load('?manual=1');
  const G = (fn, a) => H.eval(fn, a);
  for (const z of ['reef_hollow', 'reef_arena']) {
    await G((z) => { const g = window.__game; g.buildWorld(z, 'west', {}); g.world.snapCamera(); g.world.cam.x = 0; g.world.cam.y = 0; }, z);
    await H.adv(2);
    // overview: render at reduced scale by drawing the tile layer scaled
    await G(() => { const w = window.__game.world; const cv = w.layer.canvas; const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height; const o = out.getContext('2d'); o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 0, 0); for (const d of w.decor) { const f = d.spr.frames[0]; o.drawImage(f, Math.round(d.x - d.spr.ax), Math.round(d.y - (d.spr.hang ? 0 : d.spr.h))); } for (const e of w.enemies) { o.fillStyle = '#f00'; o.fillRect(e.x - 3, e.y - 3, 6, 6); } for (const i of w.interactables) { o.fillStyle = '#ff0'; o.fillRect(i.x - 3, i.y - 3, 6, 6); } window.__ov = out.toDataURL('image/png'); });
    const d = await G(() => window.__ov);
    (await import('node:fs')).writeFileSync(`/tmp/ov_${z}.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
};
