// Dev gallery: ?gallery=player  — renders sprite sheets at 5x for visual QA.
import { playerFrame, ANIMS, FORMS, defaultVariant, variantFor } from '../gfx/sprites_player.js';
import '../gfx/sprites_forms.js';
import '../gfx/sprites_hero.js';
import { drawText } from '../gfx/font.js';
import { R } from '../gfx/palette.js';

export function gallery(kind) {
  const cv = document.getElementById('game');
  const S = 4;
  const rows = [];
  if (kind === 'player' || !kind) {
    const form = new URLSearchParams(location.search).get('form') || 'shore';
    for (const a of Object.keys(ANIMS)) rows.push({ label: a, frames: Array.from({ length: ANIMS[a].n }, (_, i) => playerFrame(form, variantFor({ form, branches: Object.fromEntries((new URLSearchParams(location.search).get('br') || '').split(',').filter(Boolean).map((x) => x.split(':'))), dye: 'default' }), a, i)) });
  }
  cv.width = 1280; cv.height = 720; cv.style.width = '100%';
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1d5a7a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const Z = +(new URLSearchParams(location.search).get('z') || 2); const only = new URLSearchParams(location.search).get('only'); let y = 6, x = 6;
  for (const r of rows) {
    if (only && !only.split(',').includes(r.label)) continue;
    drawText(ctx, r.label, x, y, { color: '#fff', scale: 1 });
    let fx = x + 80;
    for (const f of r.frames) { ctx.drawImage(f.canvas, fx, y, f.w * Z, f.h * Z); fx += f.w * Z + 4; }
    y += 33 * Z;
    if (y > 700) { y = 6; x += 640; }
  }
}

export async function galleryWorld() {
  const { propSprite, PROP_TYPES } = await import('../gfx/sprites_world.js');
  const cv = document.getElementById('game');
  cv.width = 1280; cv.height = 720; cv.style.width = '100%';
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a8ab0'; ctx.fillRect(0, 0, cv.width, cv.height);
  let x = 10, y = 10; const Z = 3;
  for (const t of PROP_TYPES) {
    for (let v = 0; v < 3; v++) {
      const s = propSprite(t, v);
      if (x + s.w * Z > 1270) { x = 10; y += 130; }
      ctx.drawImage(s.frames[1] || s.frames[0], x, y, s.frames[0].width * Z, s.frames[0].height * Z);
      x += s.frames[0].width * Z + 8;
    }
  }
}
