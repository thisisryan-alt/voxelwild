// Hero form animation sheet: FORMS=shore,warrior:bulwark ANIMS=idle,walk,attack1  ->  /tmp/hero.png  (specs: form[:warriorBranch[:abyssalBranch[:leviathanBranch]]])
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(5);
  const forms = (process.env.FORMS || 'shore,warrior').split(','), anims = (process.env.ANIMS || 'idle,walk,swim,attack1,attack3,block,hurt').split(',');
  const url = await H.eval(async ([forms, anims, Z, ZFIX]) => {
    await import('/src/gfx/sprites_hero.js');
    const { playerFrame, variantFor, ANIMS } = await import('/src/gfx/sprites_player.js');
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 1100; const o = cv.getContext('2d'); o.imageSmoothingEnabled = false; o.fillStyle = '#1a6a9a'; o.fillRect(0, 0, 1500, 1100);
    let y = 6;
    for (const spec of forms) {
      const [form, b1, b2, b3] = spec.split(':'); const branches = {}; if (b1) branches.warrior = b1; if (b2) branches.abyssal = b2; if (b3) branches.leviathan = b3;
      let x = 6, rowH = 0;
      for (const a of anims) { const n = ANIMS[a].n; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 3))) { const f = playerFrame(form, variantFor({ form, branches, dye: 'default' }), a, i); const z = ZFIX || Math.max(1, Math.min(Z, Math.floor(130 / f.h))); if (x + f.w * z > 1490) { x = 6; y += rowH + 6; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * z, f.h * z); x += f.w * z + 4; rowH = Math.max(rowH, f.h * z); } x += 10; }
      y += rowH + 12;
    }
    return cv.toDataURL('image/png');
  }, [forms, anims, 3, +(process.env.ZOOM || 0)]);
  (await import('node:fs')).writeFileSync('/tmp/hero.png', Buffer.from(url.split(',')[1], 'base64'));
};
