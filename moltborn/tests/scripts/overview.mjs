export default async (page, H) => {
  await H.load('?manual=1');
  const zones = (process.env.ZONES || '').split(',').filter(Boolean);
  for (const z of zones) {
    await H.eval((z) => { const g = window.__game; const ent = Object.keys(g.world ? {} : {}); g.buildWorld(z, Object.keys(g.world.zone.entries)[0] && 'x', {}); }, z).catch(() => {});
    const d = await H.eval(async (z) => {
      const g = window.__game; const { buildZone } = await import('/src/data/zones.js'); const { World } = await import('/src/world/world.js');
      const zone = buildZone(z); const first = Object.keys(zone.entries)[0]; g.buildWorld(z, first, { silentBanner: true });
      const w = g.world; const cv = w.layer.canvas; const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height; const o = out.getContext('2d');
      const bg = w.biome; const gr = o.createLinearGradient(0, 0, 0, out.height); gr.addColorStop(0, bg.top); gr.addColorStop(1, bg.bottom); o.fillStyle = gr; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(cv, 0, 0);
      for (const d of w.decor) { const f = d.spr.frames[0]; o.drawImage(f, Math.round(d.x - d.spr.ax), Math.round(d.y - (d.spr.hang ? 0 : d.spr.h))); }
      for (const p of w.pickups) { o.fillStyle = '#ffd84a'; o.fillRect(p.x - 2, p.y - 2, 5, 5); }
      for (const e of w.enemies) { o.fillStyle = e.def.boss ? '#ff00ff' : '#f33'; o.fillRect(e.x - 4, e.y - 4, 8, 8); }
      for (const i of w.interactables) { o.fillStyle = i.constructor.name === 'Shrine' ? '#f9f' : '#ff0'; o.fillRect(i.x - 5, i.y - 5, 10, 10); }
      for (const ex of w.zone.exits) { o.strokeStyle = '#0f0'; o.lineWidth = 2; o.strokeRect(ex.x, ex.y, ex.w, ex.h); }
      for (const [k, e] of Object.entries(w.zone.entries)) { o.fillStyle = '#0ff'; o.fillRect(e.x - 3, e.y - 12, 6, 12); }
      return out.toDataURL('image/png');
    }, z);
    (await import('node:fs')).writeFileSync(`/tmp/ov_${z}.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
};
