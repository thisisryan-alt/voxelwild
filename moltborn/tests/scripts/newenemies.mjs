// Contact sheet of the expansion roster: move / windup / attack poses at 3x. KEYS=comma list overrides.
export default async (page, H) => {
  await H.load('?manual=1');
  const keys = (process.env.KEYS || 'mantis,mender,spawncoral,spawnling,splitjelly,jellet,hookjaw,tuskram,fumecap').split(',');
  const d = await H.eval(async (keys) => {
    const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); const { ENEMIES } = await import('/src/data/enemies.js');
    const Z = 3, cv = document.createElement('canvas'); cv.width = 1500; cv.height = 130 * Z * Math.ceil(keys.length / 2); const o = cv.getContext('2d'); o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, cv.width, cv.height);
    keys.forEach((k, i) => { const d = ENEMIES[k]; let x = 8 + (i % 2) * 750, y = 8 + Math.floor(i / 2) * 130 * Z / 1.0 * 0.5; y = 8 + Math.floor(i / 2) * 120 * Z * 0.62;
      o.fillStyle = '#fff'; o.font = '12px monospace'; o.fillText(k, x, y + 10);
      for (const pose of ['move', 'windup', 'attack']) for (const fr of [0, 2]) { const f = enemyFrame(k, d.sprite, pose, fr); if (pose !== 'move' && fr === 2) continue; o.drawImage(f.canvas, x, y + 14, f.w * Z / 1.5, f.h * Z / 1.5); x += f.w * Z / 1.5 + 6; } });
    return cv.toDataURL('image/png');
  }, keys);
  (await import('node:fs')).writeFileSync(process.env.OUT || '/tmp/claude-0/cs/newenemies.png', Buffer.from(d.split(',')[1], 'base64'));
};
