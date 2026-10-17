// Photo mode (F2): the world freezes and the interface steps aside. Arrow keys move the camera, Z / X zoom, F cycles the
// filter, G the frame, V hides this help, B summons an ocean event for the shot, T turns the swimmer around, ENTER takes
// the picture, which is downloaded as a PNG. The filters live in gfx/post.js (photoFilter); frames are drawn here.
import { text, textWidth, panel, COL } from './ui.js';
import { clamp } from '../core/util.js';

export const FILTERS = ['none', 'warm', 'noir', 'vivid', 'dream', 'abyss'];
export const FRAMES = ['none', 'polaroid', 'film', 'gold', 'corners'];
const EVENTS = ['whale', 'stream', 'sun', 'ghost', 'snow', 'drift'];

export class PhotoScene {
  constructor(game) {
    this.g = game; this.opaque = false; this.t = 0; this.filter = 0; this.frame = 0; this.help = true; this.shoot = 0; this.flash = 0; this.ev = 0; this.taken = 0;
    const w = game.world; this.saved = { x: w.cam.x, y: w.cam.y, zoom: 0 }; this.pan = { x: 0, y: 0 }; this.zoom = 0;
  }
  onEnter() { const g = this.g; g.photoMode = { filter: 'none', hideHud: true }; g.audio.sfx('select'); g.audio.setMuffle?.(0.15); }
  onExit() {
    const g = this.g, w = g.world; g.photoMode = null; g.audio.setMuffle?.(0);
    if (w) { w.cam.x = this.saved.x; w.cam.y = this.saved.y; } if (g.systems.post) g.systems.post.photoZoom = 0;
  }
  update(dt) {
    const g = this.g, inp = g.input, w = g.world; this.t += dt; this.flash = Math.max(0, this.flash - dt * 3);
    if (inp.pressed('cancel') || inp.pressed('pause') || inp.pressed('photo')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const sp = (inp.isDown('dash') || inp.isDown('block') ? 220 : 110) * dt;
    this.pan.x = clamp(this.pan.x + inp.axisX() * sp, -220, 220); this.pan.y = clamp(this.pan.y + inp.axisY() * sp, -130, 130);
    w.cam.x = this.saved.x + this.pan.x; w.cam.y = this.saved.y + this.pan.y; w.clampCam();
    if (inp.rawPressed('KeyZ')) this.zoom = clamp(this.zoom + 0.04, 0, 0.2); if (inp.rawPressed('KeyX')) this.zoom = clamp(this.zoom - 0.04, 0, 0.2);
    if (g.systems.post) g.systems.post.photoZoom = this.zoom;
    if (inp.rawPressed('KeyF')) { this.filter = (this.filter + 1) % FILTERS.length; g.photoMode.filter = FILTERS[this.filter]; g.audio.sfx('tick'); }
    if (inp.rawPressed('KeyG')) { this.frame = (this.frame + 1) % FRAMES.length; g.audio.sfx('tick'); }
    if (inp.rawPressed('KeyV')) this.help = !this.help;
    if (inp.rawPressed('KeyT')) { w.player.facing *= -1; g.audio.sfx('tick'); }
    if (inp.rawPressed('KeyB')) { w.sky.force(EVENTS[this.ev++ % EVENTS.length], { mid: true }); g.audio.sfx('tick'); }
    if (inp.pressed('confirm') && !this.shoot) { this.shoot = 2; }
    w.t += dt * 0.3; w.fx.update?.(dt * 0.15);   // a slow living shimmer so the water is not dead still
    w.sky.update(dt * 0.6);
  }
  draw(ctx) {
    const g = this.g, w = g.world, cap = this.shoot === 1;
    this.drawFrame(ctx, FRAMES[this.frame]);
    if (!cap && this.help && !this.shoot) this.drawHelp(ctx);
    if (this.flash > 0) { ctx.globalAlpha = this.flash; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    if (this.shoot === 2) { this.shoot = 1; return; }                   // one clean frame without the help text, then capture
    if (cap) { this.capture(ctx, w); this.shoot = 0; this.flash = 1; this.taken++; }
  }
  capture(ctx, w) {
    const g = this.g, rec = g.state.records; if (rec) rec.photos++;
    g.audio.sfx('shutter'); g.events.emit('photo', w.zone.id);
    try {
      const url = ctx.canvas.toDataURL('image/png'), a = document.createElement('a');
      a.href = url; a.download = `moltborn-${w.zone.id.replace(/[^a-z0-9]+/gi, '_')}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* downloads can be blocked; the shutter still counts */ }
    g.toast('Photograph taken', '#c0f0ff');
  }
  drawHelp(ctx) {
    const rows = ['ARROWS move camera', 'Z / X zoom', `F filter: ${FILTERS[this.filter]}`, `G frame: ${FRAMES[this.frame]}`, 'B ocean event', 'T turn around', 'V hide help', 'ENTER take photo   ESC back'];
    const w = Math.max(...rows.map((r) => textWidth(r))) + 12, h = rows.length * 10 + 8, x = 480 - w - 6, y = 6;
    panel(ctx, x, y, w, h, { alpha: 0.7, border: '#2a3a58' }); rows.forEach((r, i) => text(ctx, r, x + 6, y + 5 + i * 10, i === 7 ? COL.green : COL.text));
  }
  drawFrame(ctx, kind) {
    if (kind === 'none') return;
    ctx.save();
    if (kind === 'polaroid') { ctx.fillStyle = '#f2ecdc'; ctx.fillRect(0, 0, 480, 14); ctx.fillRect(0, 270 - 38, 480, 38); ctx.fillRect(0, 0, 14, 270); ctx.fillRect(480 - 14, 0, 14, 270); ctx.fillStyle = '#c8c0a8'; ctx.fillRect(14, 14, 452, 1); ctx.fillRect(14, 232, 452, 1); const n = this.g.world.zone.title || this.g.world.zone.name; text(ctx, n, 240 - textWidth(n) / 2, 245, '#5a4a3a', { shadow: null }); }
    else if (kind === 'film') { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 480, 18); ctx.fillRect(0, 252, 480, 18); ctx.fillStyle = '#e8dcc0'; for (let x = 4; x < 480; x += 14) { ctx.fillRect(x, 5, 7, 8); ctx.fillRect(x, 257, 7, 8); } }
    else if (kind === 'gold') { for (const [i, c] of [[0, '#6a4a1a'], [1, '#ffd84a'], [2, '#a87a22'], [3, '#6a4a1a']]) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(5 + i + 0.5, 5 + i + 0.5, 470 - i * 2, 260 - i * 2); } ctx.fillStyle = '#ffd84a'; for (const [x, y] of [[8, 8], [468, 8], [8, 258], [468, 258]]) ctx.fillRect(x - 2, y - 2, 6, 6); }
    else if (kind === 'corners') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; const L = 28, m = 12; for (const [x, y, dx, dy] of [[m, m, 1, 1], [480 - m, m, -1, 1], [m, 270 - m, 1, -1], [480 - m, 270 - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke(); } }
    ctx.restore();
  }
}
