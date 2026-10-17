export default async (page, H) => {
  await H.load('?manual=1');
  const d = await H.eval(async () => {
    const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); const { ENEMIES } = await import('/src/data/enemies.js');
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 900; const o = cv.getContext('2d'); o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, 1500, 900);
    let x = 6, y = 6, rowH = 0; const Z = 2;
    for (const [k, d] of Object.entries(ENEMIES)) for (const pose of ['move', 'windup']) { const f = enemyFrame(k, d.sprite, pose, 1); if (x + f.w * Z > 1500) { x = 6; y += rowH + 14; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); if (pose === 'move') { o.fillStyle = '#fff'; o.font = '9px monospace'; o.fillText(k, x, y + f.h * Z + 9); } x += f.w * Z + 4; rowH = Math.max(rowH, f.h * Z); }
    return cv.toDataURL('image/png');
  });
  (await import('node:fs')).writeFileSync('/tmp/enemies.png', Buffer.from(d.split(',')[1], 'base64'));
};
