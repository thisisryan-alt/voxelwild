export default async (page, H) => {
  await H.load('?manual=1');
  const keys = process.env.KEYS.split(',');
  const d = await H.eval(async (keys) => {
    const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); await import('/src/gfx/sprites_bosses.js');
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 900; const o = cv.getContext('2d'); o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, 1500, 900);
    let x = 4, y = 4, rowH = 0;
    const defs = { lurelord: [150, 120, 76, 62, ['idle', 'open', 'charge']], krael: [250, 190, 120, 84, ['idle', 'windup', 'tail', 'smash', 'gaze']], kyros: [110, 130, 52, 100, ['idle', 'windup', 'thrust', 'guard', 'throw', 'spin']], poseidon: [200, 200, 100, 104, ['idle', 'thrust', 'raise', 'slam', 'cast']], maw: [180, 150, 88, 70, ['idle', 'open']], tyrant: [120, 100, 60, 62, ['idle', 'open', 'slam']] };
    for (const key of keys) { const [w, h, ax, ay, poses] = defs[key]; const variants = key === 'poseidon' ? [0, 1, 2, 3] : key === 'krael' ? [0, 2] : [0];
      for (const v of variants) for (const pose of poses) { const f = enemyFrame(key + 'T' + v, { plan: key, w, h, ax, ay, frames: 4, o: { phase: v, broken: v, rage: !!v } }, pose, 1); if (x + w > 1500) { x = 4; y += rowH + 4; rowH = 0; } o.drawImage(f.canvas, x, y); x += w + 4; rowH = Math.max(rowH, h); } }
    return cv.toDataURL('image/png');
  }, keys);
  (await import('node:fs')).writeFileSync(`/tmp/bs2_${keys[0]}.png`, Buffer.from(d.split(',')[1], 'base64'));
};
