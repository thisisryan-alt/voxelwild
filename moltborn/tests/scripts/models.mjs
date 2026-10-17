// Contact sheets of every model at zoom: /tmp/m_forms.png, m_enemies{0,1}.png, m_bosses.png, m_npcs.png
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(10);
  const out = await H.eval(async () => {
    const g = window.__game; await import('/src/bosses/index.js');
    const { playerFrame, variantFor } = await import('/src/gfx/sprites_player.js'); const { enemyFrame } = await import('/src/gfx/sprites_enemies.js');
    const { ENEMIES } = await import('/src/data/enemies.js'); const { NPCS } = await import('/src/data/npcs.js'); const { npcFrame } = await import('/src/gfx/sprites_npc.js');
    const { BOSS_CLASSES } = await import('/src/entities/bosses.js');
    const mk = (w, h, bg = '#1a6a9a') => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const o = cv.getContext('2d'); o.imageSmoothingEnabled = false; o.fillStyle = bg; o.fillRect(0, 0, w, h); return [cv, o]; };
    const res = {};
    // forms
    { const [cv, o] = mk(1500, 760); let x = 10; const forms = [['shore', {}], ['warrior', { warrior: 'bulwark' }], ['warrior', { warrior: 'duelist' }], ['abyssal', { warrior: 'bulwark', abyssal: 'venom' }], ['abyssal', { warrior: 'bulwark', abyssal: 'tidal' }], ['leviathan', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }], ['mythic', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }], ['primordial', {}]];
      let y = 10, rowH = 0; for (const [form, br] of forms) for (const anim of ['idle', 'move', 'attack1']) { try { const f = playerFrame(form, variantFor({ form, branches: br, dye: 'default' }), anim, 1); const Z = f.w > 90 ? 2 : 3; if (x + f.w * Z > 1490) { x = 10; y += rowH + 8; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); x += f.w * Z + 6; rowH = Math.max(rowH, f.h * Z); } catch (e) { o.fillStyle = '#f00'; o.fillText(form + ' ' + e.message, x, y + 10); } }
      res.forms = cv.toDataURL('image/png'); }
    // enemies in two sheets
    const ents = Object.entries(ENEMIES); const half = Math.ceil(ents.length / 2);
    for (let s = 0; s < 2; s++) { const [cv, o] = mk(1500, 800); let x = 6, y = 6, rowH = 0; for (const [k, d] of ents.slice(s * half, (s + 1) * half)) { const f = enemyFrame(k, d.sprite, 'move', 1); const Z = f.w > 60 ? 2 : 4; if (x + f.w * Z > 1500) { x = 6; y += rowH + 16; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); o.fillStyle = '#fff'; o.font = '9px monospace'; o.fillText(k, x, y + f.h * Z + 9); x += f.w * Z + 10; rowH = Math.max(rowH, f.h * Z); } res['enemies' + s] = cv.toDataURL('image/png'); }
    // bosses
    { const [cv, o] = mk(1500, 900); let x = 6, y = 6, rowH = 0; for (const key of Object.keys(BOSS_CLASSES)) { const C = BOSS_CLASSES[key]; const sp = C.def?.sprite; if (!sp) continue; let f; try { f = enemyFrame(key + '0', { ...sp, o: { ...sp.o, phase: 0 } }, 'idle', 1); } catch (e) { continue; } const Z = f.w > 150 ? 1 : 2; if (x + f.w * Z > 1500) { x = 6; y += rowH + 16; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); o.fillStyle = '#fff'; o.font = '9px monospace'; o.fillText(key, x, y + f.h * Z + 9); x += f.w * Z + 10; rowH = Math.max(rowH, f.h * Z); } res.bosses = cv.toDataURL('image/png'); }
    // npcs
    { const [cv, o] = mk(1200, 400); let x = 6, y = 6, rowH = 0; for (const [k, d] of Object.entries(NPCS)) { let f; try { f = npcFrame(d.sprite, 1); } catch (e) { continue; } const Z = 4; if (x + f.w * Z > 1200) { x = 6; y += rowH + 16; rowH = 0; } o.drawImage(f.canvas, x, y, f.w * Z, f.h * Z); o.fillStyle = '#fff'; o.font = '9px monospace'; o.fillText(k, x, y + f.h * Z + 9); x += f.w * Z + 10; rowH = Math.max(rowH, f.h * Z); } res.npcs = cv.toDataURL('image/png'); }
    return res;
  });
  const fs = await import('node:fs');
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(`/tmp/m_${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
};
