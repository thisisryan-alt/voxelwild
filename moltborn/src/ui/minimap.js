// Minimap: a small window onto the zone around the swimmer, one pixel (or two) per tile. Ground is only drawn where the
// player has actually been near (fog of war in 4x4-tile cells, kept in the save), and the markers are the things worth
// finding: exits, shrines, unopened chests, people, the boss's lair. N cycles off / small / large.
import { T, TS, isSolid } from '../world/tiles.js';
import { INTERACTABLES } from '../entities/interactables.js';
import { panel } from './ui.js';
import { setting } from '../systems/settings.js';
import { clamp } from '../core/util.js';

const CELL = 4, REVEAL = 22;           // fog cell size and reveal radius, in tiles
const MODES = { small: { s: 1, w: 104, h: 58 }, large: { s: 2, w: 152, h: 84 } };

export class Minimap {
  constructor(game) {
    this.g = game; game.systems.minimap = this; this.world = null; this.flash = 0;
    game.events.on('zone', () => { this.flush(); this.world = null; });
  }

  // ---- per-zone base images ---------------------------------------------------------------------------------------------
  build(world) {
    const z = world.zone, g = world.grid, W = z.w, H = z.h;
    this.world = world; this.cw = Math.ceil(W / CELL); this.ch = Math.ceil(H / CELL);
    const zs = this.g.zoneState(z.id);
    this.seen = new Uint8Array(this.cw * this.ch);
    if (typeof zs.fog === 'string') for (let i = 0; i < this.seen.length && i < zs.fog.length; i++) this.seen[i] = zs.fog.charCodeAt(i) === 49 ? 1 : 0;
    this.full = document.createElement('canvas'); this.full.width = W; this.full.height = H;
    const c = this.full.getContext('2d'), biome = world.biome;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = g.get(x, y);
      if (isSolid(t)) {
        const edge = !isSolid(g.get(x, y - 1)) || !isSolid(g.get(x - 1, y)) || !isSolid(g.get(x + 1, y)) || !isSolid(g.get(x, y + 1));
        c.fillStyle = edge ? (t === T.GROUND ? '#a8987a' : '#7a8ab0') : '#2a3450';
        c.fillRect(x, y, 1, 1);
      } else if (t === T.PLATFORM) { c.fillStyle = '#b8a070'; c.fillRect(x, y, 1, 1); }
      else if (t === T.SPIKE) { c.fillStyle = '#c04050'; c.fillRect(x, y, 1, 1); }
    }
    this.shown = document.createElement('canvas'); this.shown.width = W; this.shown.height = H;
    this.tint = biome.top;
    for (let cy = 0; cy < this.ch; cy++) for (let cx = 0; cx < this.cw; cx++) if (this.seen[cy * this.cw + cx]) this.copyCell(cx, cy);
    this.dirty = false;
  }
  copyCell(cx, cy) {
    const x = cx * CELL, y = cy * CELL; this.shown.getContext('2d').drawImage(this.full, x, y, CELL, CELL, x, y, CELL, CELL);
  }
  reveal(px, py) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS), cx0 = Math.floor((tx - REVEAL) / CELL), cx1 = Math.floor((tx + REVEAL) / CELL), cy0 = Math.floor((ty - REVEAL) / CELL), cy1 = Math.floor((ty + REVEAL) / CELL);
    for (let cy = Math.max(0, cy0); cy <= Math.min(this.ch - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(this.cw - 1, cx1); cx++) {
      const dx = (cx + 0.5) * CELL - tx, dy = (cy + 0.5) * CELL - ty;
      if (dx * dx + dy * dy > REVEAL * REVEAL) continue;
      const i = cy * this.cw + cx; if (!this.seen[i]) { this.seen[i] = 1; this.copyCell(cx, cy); this.dirty = true; }
    }
  }
  isSeen(tx, ty) { const i = Math.floor(ty / CELL) * this.cw + Math.floor(tx / CELL); return !!this.seen[i]; }
  // fog survives in the save: one character per cell
  flush() {
    if (!this.world || !this.dirty) return;
    const zs = this.g.zoneState(this.world.zone.id); let s = ''; for (let i = 0; i < this.seen.length; i++) s += this.seen[i] ? '1' : '0';
    zs.fog = s; this.dirty = false;
  }
  explored() { return this.seen ? this.seen.reduce((a, b) => a + b, 0) / Math.max(1, this.seen.length) : 0; }

  update(dt) {
    const w = this.g.world; if (!w || !w.player.alive) return;
    if (this.world !== w) this.build(w);
    this.reveal(w.player.x, w.player.y);
    this.flash += dt;
  }

  // N key: off -> small -> large -> off
  cycle() {
    const s = this.g.state.settings, order = ['off', 'small', 'large'], i = order.indexOf(s.minimap);
    s.minimap = order[(i + 1) % order.length]; this.g.audio.sfx('tick'); this.g.events.emit('setting', 'minimap', s.minimap);
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------------------
  draw(ctx, x0, y0) {
    const mode = MODES[setting(this.g, 'minimap')], w = this.g.world; if (!mode || !w || !this.shown || this.world !== w) return;
    const { s, w: pw, h: ph } = mode, p = w.player, z = w.zone;
    const tilesW = Math.floor(pw / s), tilesH = Math.floor(ph / s);
    const ptx = p.x / TS, pty = p.y / TS;
    const sx = clamp(Math.round(ptx - tilesW / 2), 0, Math.max(0, z.w - tilesW)), sy = clamp(Math.round(pty - tilesH / 2), 0, Math.max(0, z.h - tilesH));
    panel(ctx, x0 - 2, y0 - 2, pw + 4, ph + 4, { alpha: 0.6, border: '#2a3a58' });
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    ctx.fillStyle = 'rgba(8,18,40,0.55)'; ctx.fillRect(x0, y0, pw, ph);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.shown, sx, sy, Math.min(tilesW, z.w - sx), Math.min(tilesH, z.h - sy), x0, y0, Math.min(tilesW, z.w - sx) * s, Math.min(tilesH, z.h - sy) * s);
    const at = (tx, ty) => [x0 + Math.round((tx - sx) * s), y0 + Math.round((ty - sy) * s)];
    const dot = (tx, ty, col, n = s + 1) => { const [x, y] = at(tx, ty); if (x < x0 - 2 || y < y0 - 2 || x > x0 + pw || y > y0 + ph) return; ctx.fillStyle = col; ctx.fillRect(x - (n >> 1), y - (n >> 1), n, n); };
    for (const e of z.exits || []) { const tx = (e.x + e.w / 2) / TS, ty = (e.y + e.h / 2) / TS; if (this.isSeen(tx, ty)) dot(tx, ty, '#6af0ff', s + 2); }
    const sense = this.g.systems.companion?.has('sense');      // the hatchling's treasure sense shows closed chests through the fog
    for (const i of w.interactables) {
      const tx = i.x / TS, ty = i.y / TS, hidden = !this.isSeen(tx, ty);
      if (hidden && !(sense && i instanceof INTERACTABLES.chest && !i.opened)) continue;
      if (i instanceof INTERACTABLES.shrine) dot(tx, ty, '#ff9ad8', s + 2);
      else if (i instanceof INTERACTABLES.chest && !i.opened) dot(tx, ty, '#ffd84a');
      else if (i instanceof INTERACTABLES.npc) dot(tx, ty, '#8aff9a');
    }
    for (const e of w.enemies) {
      if (!e.alive || e.def.friendly || e.state === 'hidden' || e.disguised) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 190 && !e.def.boss) continue;
      dot(e.x / TS, e.y / TS, e.def.boss ? '#ff4a5a' : '#c06070', e.def.boss ? s + 3 : s);
    }
    // the player blinks so it can be found on a busy map
    if (Math.floor(this.flash * 3) % 3) dot(ptx, pty, '#ffffff', s + 2);
    else dot(ptx, pty, '#ffd84a', s + 2);
    ctx.restore();
  }
}
