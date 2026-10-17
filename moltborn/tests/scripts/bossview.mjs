// Pose sheet for one boss: BOSS=captain POSES=idle,windup,swing ZOOM=2 RAGE=1 PHASE=0  ->  /tmp/boss_view.png
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(5);
  const url = await H.eval(async ([boss, poses, Z, rage, phase]) => {
    await import('/src/bosses/index.js'); const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); const { BOSS_CLASSES } = await import('/src/entities/bosses.js');
    const C = BOSS_CLASSES[boss]; const sp = C.def.sprite;
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 1000; const o = cv.getContext('2d'); o.imageSmoothingEnabled = false; o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, 1500, 1000);
    let x = 6, y = 6, rowH = 0;
    for (const pose of poses) for (let fr = 0; fr < 2; fr++) { const f = enemyFrame(boss + '_v' + rage + phase, { ...sp, o: { ...sp.o, rage: !!+rage, phase: +phase } }, pose, fr * 2); if (x + f.w * Z > 1490) { x = 6; y += rowH + 14; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); o.fillStyle = '#fff'; o.font = '10px monospace'; o.fillText(pose, x + 4, y + 10); x += f.w * Z + 6; rowH = Math.max(rowH, f.h * Z); }
    return cv.toDataURL('image/png');
  }, [process.env.BOSS, (process.env.POSES || 'idle').split(','), +(process.env.ZOOM || 2), process.env.RAGE || '0', process.env.PHASE || '0']);
  (await import('node:fs')).writeFileSync('/tmp/boss_view.png', Buffer.from(url.split(',')[1], 'base64'));
};
