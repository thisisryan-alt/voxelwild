// Renders a boss's poses to /tmp/bs_<key>.png : KEY=aurelia node tools/run.mjs ...
export default async (page, H) => {
  await H.load('?manual=1');
  const key = process.env.KEY;
  const d = await H.eval(async (key) => {
    const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); await import('/src/gfx/sprites_bosses.js');
    const { ENEMIES } = await import('/src/data/enemies.js'); const { BOSS_CLASSES } = await import('/src/entities/bosses.js');
    const C = BOSS_CLASSES[key]; const def = C.def; const poses = ['idle', 'windup', 'swing', 'slam', 'thrust', 'cast', 'roar', 'stagger', 'charge', 'toss'];
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 700; const o = cv.getContext('2d'); o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, 1400, 700);
    let x = 4, y = 4, rowH = 0;
    for (const rage of [false, true]) for (const pose of poses) { const f = enemyFrame(key + 'T' + (rage ? 'R' : ''), { ...def.sprite, o: { rage, ...(def.sprite.o || {}) } }, pose, 0); if (x + f.w > 1400) { x = 4; y += rowH + 4; rowH = 0; } o.drawImage(f.canvas, x, y); x += f.w + 4; rowH = Math.max(rowH, f.h); }
    return cv.toDataURL('image/png');
  }, key);
  (await import('node:fs')).writeFileSync(`/tmp/bs_${key}.png`, Buffer.from(d.split(',')[1], 'base64'));
};
