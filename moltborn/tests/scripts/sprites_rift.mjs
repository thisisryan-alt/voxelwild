// A contact sheet of the rift creatures and the Warden, at 4x. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/rsp';
  await H.load('?manual=1'); await H.adv(10);
  const url = await H.eval(async () => {
    const { ENEMIES } = await import('/src/data/enemies.js'); const { enemyFrame } = await import('/src/gfx/sprites_enemies.js'); await import('/src/bosses/index.js');
    const { BOSS_CLASSES } = await import('/src/entities/bosses.js');
    const list = [['shardling', ENEMIES.shardling.sprite, ['move', 'windup']], ['latchleech', ENEMIES.latchleech.sprite, ['move', 'windup']], ['tidecaller', ENEMIES.tidecaller.sprite, ['move', 'attack']], ['glassgolem', ENEMIES.glassgolem.sprite, ['move', 'windup', 'attack']], ['rift_warden', BOSS_CLASSES.rift_warden.def.sprite, ['idle', 'open', 'stagger']]];
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 760; const c = cv.getContext('2d'); c.fillStyle = '#10182c'; c.fillRect(0, 0, 1000, 760); c.imageSmoothingEnabled = false;
    let y = 4;
    for (const [k, sp, poses] of list) { let x = 4, h = 0; for (const pose of poses) for (let f = 0; f < 2; f++) { const fr = enemyFrame(k, sp, pose, f), s = k === 'rift_warden' ? 2 : 3; c.drawImage(fr.canvas, x, y, fr.w * s, fr.h * s); x += fr.w * s + 6; h = Math.max(h, fr.h * s); } y += h + 6; }
    return cv.toDataURL('image/png');
  });
  (await import('node:fs')).writeFileSync(`${out}_sheet.png`, Buffer.from(url.split(',')[1], 'base64'));
};
