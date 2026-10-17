// Title, pause/options, shop, forge, molt-shrine and story-panel screens.
import { drawScene } from '../gfx/cutscene_art.js';
import { panel, text, button, bar, COL, drawText, textWidth, wrapText } from './ui.js';
import { Save } from '../core/save.js';
import { KEYMAP } from '../core/input.js';
import { ITEMS, SHOP } from '../data/items.js';
import { FORMS, BRANCHES, EVOLUTIONS } from '../data/forms.js';
import { itemIcon, formIcon } from '../gfx/sprites_ui.js';
import { getBackground } from '../gfx/background.js';
import { playerFrame, variantFor } from '../gfx/sprites_player.js';
import { drawFrame } from '../entities/entity.js';
import { rng, TAU } from '../core/util.js';
import { EvolveScene } from './evolve_scene.js';

const rand = rng(11);
const fmtTime = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;

// ---------------------------------------------------------------------------------------------------------------
export class TitleScene {
  constructor(game) { this.g = game; this.opaque = true; this.t = 0; this.sel = 0; this.mode = 'main'; this.slotSel = 0; this.bg = getBackground('reef', 5); this.motes = Array.from({ length: 50 }, () => ({ x: rand() * 480, y: rand() * 270, s: 4 + rand() * 12, z: rand() })); this.msg = ''; this.fish = Array.from({ length: 9 }, () => ({ x: rand() * 520, y: 50 + rand() * 120, v: 8 + rand() * 18, c: ['#ffe65a', '#5ac0f0', '#ff7a6a'][Math.floor(rand() * 3)] })); this.confirm = null; }
  onEnter() { this.g.audio.music.play('title'); this.g.audio.ambience('shallows'); }
  items() {
    const has = Save.list().some((s) => s.meta);
    const l = []; if (has) l.push('CONTINUE'); l.push('NEW GAME'); if (has) l.push('LOAD GAME'); l.push('OPTIONS', 'CONTROLS', 'CREDITS'); return l;
  }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt;
    if (this.mode === 'main') {
      const items = this.items();
      if (inp.pressed('up')) { this.sel = (this.sel + items.length - 1) % items.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % items.length; g.audio.sfx('tick'); }
      if (inp.pressed('confirm')) {
        g.audio.sfx('select'); const it = items[this.sel];
        if (it === 'CONTINUE') { const last = Save.list().filter((s) => s.meta).sort((a, b) => b.meta.savedAt - a.meta.savedAt)[0]; this.start('load', last.slot); }
        else if (it === 'NEW GAME') { this.mode = 'new'; this.slotSel = 0; }
        else if (it === 'LOAD GAME') { this.mode = 'load'; this.slotSel = 0; }
        else if (it === 'OPTIONS') { g.openOptions?.(); } else if (it === 'CONTROLS') this.mode = 'controls'; else if (it === 'CREDITS') this.mode = 'credits';
      }
    } else if (this.mode === 'load' || this.mode === 'new') {
      const slots = Save.list();
      if (inp.pressed('up')) { this.slotSel = (this.slotSel + 2) % 3; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.slotSel = (this.slotSel + 1) % 3; g.audio.sfx('tick'); }
      if (inp.pressed('cancel')) { this.mode = 'main'; this.confirm = null; g.audio.sfx('back'); }
      if (this.confirm) { if (inp.pressed('confirm')) { Save.delete(this.confirm.slot); this.confirm = null; g.audio.sfx('select'); this.start('new', this.slotSel); } return; }
      if (inp.pressed('confirm')) {
        const s = slots[this.slotSel];
        if (this.mode === 'load') { if (s.meta) { g.audio.sfx('select'); this.start('load', s.slot); } else g.audio.sfx('deny'); }
        else if (s.meta) { this.confirm = s; g.audio.sfx('select'); } else { g.audio.sfx('select'); this.start('new', s.slot); }
      }
      if (inp.pressed('heavy') && this.mode === 'load' && slots[this.slotSel].meta) { Save.delete(slots[this.slotSel].slot); g.audio.sfx('back'); }
    } else if (inp.pressed('cancel') || inp.pressed('confirm')) { this.mode = 'main'; g.audio.sfx('back'); }
  }
  start(kind, slot) {
    const g = this.g; g.audio.unlock();
    if (kind === 'load') { g.loadGame(slot); }
    else { g.newGame(slot); g.startIntro?.(); }
  }
  draw(ctx) {
    const t = this.t, cam = { x: t * 14, y: 40 }; ctx.fillStyle = '#0a3a6a'; ctx.fillRect(0, 0, 480, 270);
    this.bg.draw(ctx, cam, { h: 40 }, t);
    for (const f of this.fish) { const x = ((f.x + t * f.v) % 540) - 30; ctx.fillStyle = f.c; ctx.fillRect(Math.round(x), Math.round(f.y + Math.sin(t + f.x) * 4), 5, 2); ctx.fillRect(Math.round(x) - 2, Math.round(f.y + Math.sin(t + f.x) * 4) - 1, 2, 4); }
    // seabed
    ctx.fillStyle = '#c89c5e'; ctx.fillRect(0, 232, 480, 40); ctx.fillStyle = '#eecb94'; ctx.fillRect(0, 232, 480, 3); ctx.fillStyle = '#dcb27a'; for (let x = 0; x < 480; x += 17) ctx.fillRect(x, 240 + (x * 7) % 12, 9, 1);
    // hero crab on the sand
    const f = playerFrame('shore', variantFor({ form: 'shore', branches: {}, dye: 'default' }), 'idle', Math.floor(t * 4) % 4); drawFrame(ctx, f, 108, 238);
    const fe = Math.floor(t * 0.7) % 3; // little crab looks around
    for (const m of this.motes) { ctx.globalAlpha = 0.3 + 0.4 * m.z; ctx.fillStyle = '#d8f4ff'; ctx.fillRect(Math.round((m.x + Math.sin(t * 0.5 + m.y) * 6) % 480), Math.round(((m.y - t * m.s) % 280 + 280) % 280), m.z > 0.7 ? 2 : 1, m.z > 0.7 ? 2 : 1); } ctx.globalAlpha = 1;
    // title
    const glow = 0.5 + 0.5 * Math.sin(t * 1.5);
    ctx.globalAlpha = 0.3 + glow * 0.15; ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.ellipse(240, 62, 130, 24, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    drawText(ctx, 'MOLTBORN', 240, 36, { color: '#ffe08a', scale: 5, align: 'center', outline: '#8a2a14', shadow: '#2a0a08' });
    drawText(ctx, 'FROM CRAB TO GODSLAYER', 240, 80, { color: '#9af0ff', scale: 1, align: 'center', shadow: '#05204a' });
    if (this.mode === 'main') {
      const items = this.items(); items.forEach((it, i) => { const y = 110 + i * 16, sel = i === this.sel; if (sel) { ctx.fillStyle = 'rgba(10,40,90,0.7)'; ctx.fillRect(176, y - 2, 128, 14); drawText(ctx, '▶', 182, y + 1, { color: '#ffd84a' }); } drawText(ctx, it, 240, y + 1, { color: sel ? '#ffffff' : '#a8c8e8', align: 'center', shadow: '#05204a' }); });
      const en = (this.g.state.settings.endings || []).length; drawText(ctx, 'Arrows + ENTER' + (en ? `     Endings ${en}/4` : ''), 240, 258, { color: '#6a9ad0', align: 'center' });
    } else if (this.mode === 'load' || this.mode === 'new') {
      panel(ctx, 60, 100, 360, 130, { alpha: 0.92 }); text(ctx, this.mode === 'new' ? 'NEW GAME — choose a slot' : 'LOAD GAME', 70, 106, COL.gold);
      Save.list().forEach((s, i) => { const y = 120 + i * 32, sel = i === this.slotSel; panel(ctx, 68, y, 344, 28, { fill: sel ? '#1e4a7a' : '#0c1830', border: sel ? COL.borderLit : COL.border }); if (s.meta) { text(ctx, `Slot ${i + 1}  Lv ${s.meta.level}  ${FORMS[s.meta.form]?.name || ''}`, 76, y + 4, COL.text); text(ctx, `${s.meta.zone}   ${fmtTime(s.meta.playtime || 0)}   ${s.meta.coins ?? 0} coins`, 76, y + 15, COL.dim); } else text(ctx, `Slot ${i + 1}  —  empty`, 76, y + 10, '#6a8ab0'); });
      if (this.confirm) { panel(ctx, 120, 150, 240, 44, { border: '#ff5a4a' }); text(ctx, 'Overwrite this save? ENTER = yes, ESC = no', 126, 166, '#ff9a7a'); }
      if (this.mode === 'load') text(ctx, 'K: delete slot', 70, 236, COL.dim);
    } else if (this.mode === 'controls') drawControls(ctx);
    else if (this.mode === 'credits') drawCredits(ctx);
  }
}

export function drawControls(ctx) {
  panel(ctx, 40, 20, 400, 232, { alpha: 0.96 }); text(ctx, 'CONTROLS', 50, 26, COL.gold);
  const rows = [['Move', 'A / D  or  Arrows'], ['Paddle / swim up', 'SPACE  /  W  /  Up'], ['Swim down', 'S  /  Down'], ['Claw (combo)', 'J  /  Z'], ['Heavy (hold to charge)', 'K  /  X'], ['Dash', 'L  /  C'], ['Block / parry', 'SHIFT  /  V'], ['Abilities', '1  2  3'], ['Ultimate', 'Q'], ['Interact', 'E'], ['Menu', 'TAB  /  B'], ['Map', 'M'], ['Pause', 'ESC  /  P'], ['Quick save', 'F5'], ['Quick heal (kelp wrap)', 'F']];
  rows.forEach((r, i) => { const col = i < 8 ? 0 : 1, y = 44 + (i % 8) * 20, x0 = col ? 250 : 52, x1 = col ? 430 : 232; text(ctx, r[0], x0, y, COL.dim); text(ctx, r[1], x1 - textWidth(r[1]), y + 9, COL.text); });
  ctx.fillStyle = '#1a3a5a'; ctx.fillRect(243, 40, 1, 160);
  text(ctx, 'Tip: block just as an attack lands to PARRY.', 52, 222, '#9ad8ff'); text(ctx, 'A gamepad works too: stick to move, face buttons to fight.', 52, 234, COL.dim);
}
function drawCredits(ctx) {
  panel(ctx, 40, 20, 400, 232, { alpha: 0.96 }); text(ctx, 'CREDITS', 50, 26, COL.gold);
  const lines = ['MOLTBORN: From Crab to Godslayer', '', 'Design, code, pixel art, music & sound: generated procedurally', 'Every sprite is painted at runtime from code; every sound and', 'melody is synthesised with WebAudio. No external assets.', '', 'Reference art direction: colourful pixel-art seaweed, coral,', 'rocks, coins and sand.', '', 'Thank you for playing.'];
  lines.forEach((l, i) => text(ctx, l, 52, 44 + i * 12, i === 0 ? '#ffffff' : COL.text));
}

// ---------------------------------------------------------------------------------------------------------------
export class PauseScene {
  constructor(game) { this.g = game; this.opaque = false; this.sel = 0; this.mode = 'main'; this.t = 0; this.os = 0; }
  onEnter() { this.g.audio.setMuffle?.(0.6); this.g.audio.sfx('select'); }
  onExit() { this.g.audio.setMuffle?.(0); }
  items() { return ['RESUME', 'SAVE GAME', 'OPTIONS', 'CONTROLS', 'QUIT TO TITLE']; }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt;
    if (this.mode === 'main') {
      const it = this.items();
      if (inp.pressed('up')) { this.sel = (this.sel + it.length - 1) % it.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % it.length; g.audio.sfx('tick'); }
      if (inp.pressed('pause') || inp.pressed('cancel')) { g.audio.sfx('back'); g.engine.pop(); return; }
      if (inp.pressed('confirm')) {
        const k = it[this.sel]; g.audio.sfx('select');
        if (k === 'RESUME') g.engine.pop(); else if (k === 'SAVE GAME') { g.saveGame(); } else if (k === 'OPTIONS') { this.mode = 'options'; this.os = 0; } else if (k === 'CONTROLS') this.mode = 'controls';
        else if (k === 'QUIT TO TITLE') { g.saveGame(true); g.audio.music.stop?.(); g.world = null; g.engine.replace(new TitleScene(g)); }
      }
    } else if (this.mode === 'options') updateOptions(this, g, inp, () => { this.mode = 'main'; });
    else if (inp.pressed('cancel') || inp.pressed('confirm') || inp.pressed('pause')) this.mode = 'main';
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.7)'; ctx.fillRect(0, 0, 480, 270);
    if (this.mode === 'main') {
      panel(ctx, 170, 70, 140, 120); drawText(ctx, 'PAUSED', 240, 78, { color: COL.gold, align: 'center', shadow: '#000' });
      this.items().forEach((k, i) => button(ctx, k, 180, 94 + i * 18, 120, 15, i === this.sel));
    } else if (this.mode === 'options') drawOptions(ctx, this); else drawControls(ctx);
  }
}

export function updateOptions(scene, g, inp, back) {
  const s = g.state.settings, rows = ['music', 'sfx', 'shake', 'mute'];
  if (inp.pressed('up')) { scene.os = (scene.os + 3) % 4; g.audio.sfx('tick'); } if (inp.pressed('down')) { scene.os = (scene.os + 1) % 4; g.audio.sfx('tick'); }
  const k = rows[scene.os], d = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
  if (d) { if (k === 'mute') { g.audio.muted = !g.audio.muted; } else s[k] = Math.max(0, Math.min(1, Math.round((s[k] + d * 0.1) * 10) / 10)); g.audio.applyVolumes(); Save.saveSettings(s); g.audio.sfx('tick'); }
  if (inp.pressed('confirm') && k === 'mute') { g.audio.muted = !g.audio.muted; g.audio.applyVolumes(); }
  if (inp.pressed('cancel') || inp.pressed('pause')) { Save.saveSettings(s); g.audio.sfx('back'); back(); }
}
export function drawOptions(ctx, scene) {
  const g = scene.g, s = g.state.settings; panel(ctx, 110, 70, 260, 120); drawText(ctx, 'OPTIONS', 240, 78, { color: COL.gold, align: 'center', shadow: '#000' });
  [['Music volume', s.music], ['Effects volume', s.sfx], ['Screen shake', s.shake], ['Mute all', g.audio.muted ? 1 : 0]].forEach(([n, v], i) => { const y = 96 + i * 20, sel = i === scene.os; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(116, y - 3, 248, 16); } text(ctx, n, 124, y + 1, sel ? '#fff' : COL.dim); if (i < 3) { bar(ctx, 240, y + 2, 100, 5, v, '#3a8ae8', '#8ad0ff', '#0a1a3a'); text(ctx, String(Math.round(v * 100)), 346, y + 1, COL.text); } else text(ctx, v ? 'ON' : 'OFF', 250, y + 1, v ? '#ff9a7a' : COL.green); });
  text(ctx, '◀ ▶ change     ESC back', 240 - textWidth('◀ ▶ change     ESC back') / 2, 176, COL.dim);
}
export class OptionsScene { constructor(g) { this.g = g; this.os = 0; this.opaque = false; } update() { updateOptions(this, this.g, this.g.input, () => this.g.engine.pop()); } draw(ctx) { ctx.fillStyle = 'rgba(2,8,20,0.7)'; ctx.fillRect(0, 0, 480, 270); drawOptions(ctx, this); } }

// ---------------------------------------------------------------------------------------------------------------
export class ShopScene {
  constructor(game, id, done) { this.g = game; this.id = id; this.done = done; this.opaque = false; this.sel = 0; this.msg = ''; this.msgT = 0; this.t = 0; }
  onExit() { this.done?.(); }
  stock() { return SHOP[this.id] || []; }
  price(id) { return Math.max(1, Math.round((ITEMS[id].price || 50) * (1 - this.g.world.player.stats.discount))); }
  update(dt) {
    const g = this.g, inp = g.input, list = this.stock(); this.t += dt; this.msgT -= dt;
    if (inp.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('cancel')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('confirm')) {
      const id = list[this.sel], p = this.price(id), it = ITEMS[id];
      if (it.type === 'equip' && g.hasItem(id)) { this.msg = 'You already own that'; this.msgT = 1.5; g.audio.sfx('deny'); return; }
      if (g.state.coins < p) { this.msg = 'Not enough coins'; this.msgT = 1.5; g.audio.sfx('deny'); return; }
      g.state.coins -= p; g.grantItem(id, 1, false); g.audio.sfx('coin'); this.msg = 'Bought ' + it.name; this.msgT = 1.5;
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.75)'; ctx.fillRect(0, 0, 480, 270); const list = this.stock();
    panel(ctx, 60, 30, 360, 200); drawText(ctx, 'WARES', 240, 38, { color: COL.gold, align: 'center', shadow: '#000' }); text(ctx, `Coins ${this.g.state.coins}`, 350, 38, COL.gold);
    list.forEach((id, i) => { const y = 54 + i * 18, sel = i === this.sel, it = ITEMS[id], own = this.g.itemCount(id); if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(64, y - 2, 352, 17); } ctx.drawImage(itemIcon(id), 68, y - 3); text(ctx, it.name, 90, y + 2, sel ? '#fff' : COL.text); text(ctx, own ? `(own ${own})` : '', 220, y + 2, COL.dim); text(ctx, String(this.price(id)), 410 - textWidth(String(this.price(id))), y + 2, this.g.state.coins >= this.price(id) ? COL.gold : '#a06060'); });
    const id = list[this.sel]; if (id) wrapText(ITEMS[id].desc, 340).forEach((l, i) => text(ctx, l, 70, 186 + i * 10, COL.dim));
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 216, COL.green);
  }
}

export class ForgeScene {
  constructor(game, done) { this.g = game; this.done = done; this.opaque = false; this.sel = 0; this.msg = ''; this.msgT = 0; }
  onExit() { this.done?.(); }
  gear() { return Object.keys(this.g.state.inv).filter((id) => ITEMS[id]?.type === 'equip'); }
  cost(id) { const lv = this.g.state.upgrades[id] || 0; return { pearl: lv + 1, black: lv >= 2 ? 1 : 0, coins: 40 * (lv + 1), lv }; }
  update(dt) {
    const g = this.g, inp = g.input, list = this.gear(); this.msgT -= dt;
    if (inp.pressed('cancel')) { g.engine.pop(); return; }
    if (!list.length) return;
    if (inp.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) {
      const id = list[this.sel], c = this.cost(id);
      if (c.lv >= 5) { this.msg = 'Fully reforged'; this.msgT = 1.5; return; }
      if (g.itemCount('pearl') < c.pearl || g.itemCount('black_pearl') < c.black || g.state.coins < c.coins) { this.msg = 'Not enough materials'; this.msgT = 1.5; g.audio.sfx('deny'); return; }
      g.addItem('pearl', -c.pearl); if (c.black) g.addItem('black_pearl', -c.black); g.state.coins -= c.coins; g.state.upgrades[id] = c.lv + 1; g.world.player.recalc(); g.audio.sfx('levelup'); this.msg = `${ITEMS[id].name} reforged to +${c.lv + 1}`; this.msgT = 2;
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.75)'; ctx.fillRect(0, 0, 480, 270); const list = this.gear(), g = this.g;
    panel(ctx, 60, 30, 360, 200); drawText(ctx, 'THE PEARL FORGE', 240, 38, { color: COL.gold, align: 'center', shadow: '#000' }); text(ctx, `Pearls ${g.itemCount('pearl')}  Black ${g.itemCount('black_pearl')}  Coins ${g.state.coins}`, 70, 52, '#d0dcf8');
    if (!list.length) { text(ctx, 'You have no gear to reforge.', 70, 80, COL.dim); return; }
    list.forEach((id, i) => { const y = 68 + i * 16, sel = i === this.sel, c = this.cost(id); if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(64, y - 2, 352, 15); } ctx.drawImage(itemIcon(id), 68, y - 3); text(ctx, `${ITEMS[id].name}  +${c.lv}`, 90, y + 1, sel ? '#fff' : COL.text); const cs = c.lv >= 5 ? 'MAX' : `${c.pearl} pearl${c.black ? ' + 1 black' : ''} + ${c.coins}c`; text(ctx, cs, 410 - textWidth(cs), y + 1, COL.dim); });
    text(ctx, 'Each +1: attack +1.5 / defence +1 on the piece.', 70, 206, COL.dim);
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 218, COL.green);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Molt shrine: rest, or evolve (with branch choice)
export class MoltShrineScene {
  constructor(game, shrine) { this.g = game; this.shrine = shrine; this.opaque = false; this.mode = 'main'; this.sel = 0; this.t = 0; this.formSel = 0; this.brSel = 0; this.target = null; }
  onEnter() { this.g.audio.sfx('select'); }
  update(dt) {
    const g = this.g, inp = g.input, ev = g.systems.evolution; this.t += dt;
    if (this.mode === 'main') {
      const n = 3; if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; g.audio.sfx('tick'); }
      if (inp.pressed('cancel')) { g.engine.pop(); return; }
      if (inp.pressed('confirm')) { g.audio.sfx('select'); if (this.sel === 0) { g.engine.pop(); g.rest(this.shrine); } else if (this.sel === 1) { this.mode = 'forms'; this.formSel = 0; } else g.engine.pop(); }
    } else if (this.mode === 'forms') {
      const opts = ev.options(); if (inp.pressed('cancel')) { this.mode = 'main'; return; }
      if (!opts.length) return;
      if (inp.pressed('up')) { this.formSel = (this.formSel + opts.length - 1) % opts.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.formSel = (this.formSel + 1) % opts.length; g.audio.sfx('tick'); }
      if (inp.pressed('confirm')) {
        const id = opts[this.formSel], r = ev.requirements(id, this.shrine.o.entry);
        if (!r.ok) { g.audio.sfx('deny'); return; }
        this.target = id; const E = EVOLUTIONS[id];
        if (E.branches.length) { this.mode = 'branch'; this.brSel = 0; } else this.mode = 'confirm';
      }
    } else if (this.mode === 'branch') {
      const E = EVOLUTIONS[this.target]; if (inp.pressed('cancel')) { this.mode = 'forms'; return; }
      if (inp.pressed('left') || inp.pressed('right') || inp.pressed('up') || inp.pressed('down')) { this.brSel = (this.brSel + 1) % E.branches.length; g.audio.sfx('tick'); }
      if (inp.pressed('confirm')) { this.mode = 'confirm'; }
    } else if (this.mode === 'confirm') {
      if (inp.pressed('cancel')) { this.mode = 'forms'; return; }
      if (inp.pressed('confirm')) { const E = EVOLUTIONS[this.target], br = E.branches[this.brSel]; g.engine.pop(); g.engine.push(new EvolveScene(g, this.target, br)); g.state.checkpoint = { zone: g.world.zone.id, entry: this.shrine.o.entry, shrine: this.shrine.key }; }
    }
  }
  draw(ctx) {
    const g = this.g, ev = g.systems.evolution; ctx.fillStyle = 'rgba(30,6,28,0.75)'; ctx.fillRect(0, 0, 480, 270);
    if (this.mode === 'main') { panel(ctx, 150, 80, 180, 96, { border: '#ff9ad8' }); drawText(ctx, 'MOLT SHRINE', 240, 88, { color: '#ff9ad8', align: 'center', shadow: '#000' }); ['Rest here', 'Molt (evolve)', 'Leave'].forEach((k, i) => button(ctx, k, 164, 104 + i * 22, 152, 18, i === this.sel)); return; }
    panel(ctx, 40, 20, 400, 230, { border: '#ff9ad8' });
    if (this.mode === 'forms') {
      drawText(ctx, 'AVAILABLE MOLTS', 240, 28, { color: '#ff9ad8', align: 'center', shadow: '#000' }); const opts = ev.options();
      if (!opts.length) { text(ctx, 'There is no further molt from this form.', 56, 60, COL.dim); return; }
      opts.forEach((id, i) => {
        const F = FORMS[id], r = ev.requirements(id, this.shrine.o.entry), y = 44 + i * 96, sel = i === this.formSel; panel(ctx, 50, y, 380, 90, { fill: sel ? '#1e2a58' : '#0c1830', border: sel ? '#ffffff' : r.ok ? '#7aff9a' : COL.border });
        ctx.drawImage(formIcon(id), 58, y + 6); text(ctx, F.name, 92, y + 6, COL.gold); text(ctx, EVOLUTIONS[id].title, 92, y + 17, '#ff9ad8');
        wrapText(F.blurb, 330).forEach((l, k) => text(ctx, l, 58, y + 32 + k * 10, COL.text));
        r.list.forEach((q, k) => text(ctx, (q.ok ? '✓ ' : '✗ ') + q.label, 58 + (k % 2) * 180, y + 60 + Math.floor(k / 2) * 10, q.ok ? COL.green : '#ff9a7a'));
        if (r.list[3].hint) text(ctx, r.list[3].hint, 58, y + 80, '#ff9a7a');
      });
      text(ctx, 'ENTER: choose   ESC: back', 56, 238, COL.dim);
    } else if (this.mode === 'branch') {
      const E = EVOLUTIONS[this.target]; drawText(ctx, 'CHOOSE YOUR LINE', 240, 28, { color: '#ff9ad8', align: 'center', shadow: '#000' });
      E.branches.forEach((b, i) => { const B = BRANCHES[b], x = 54 + i * 190, sel = i === this.brSel; panel(ctx, x, 46, 176, 164, { fill: sel ? '#1e2a58' : '#0c1830', border: sel ? '#ffffff' : COL.border }); text(ctx, B.name, x + 8, 54, COL.gold); wrapText(B.desc, 160).forEach((l, k) => text(ctx, l, x + 8, 70 + k * 10, COL.text)); wrapText(B.trait, 160).forEach((l, k) => text(ctx, l, x + 8, 122 + k * 10, '#ffd84a')); text(ctx, 'Signature ability:', x + 8, 160, COL.dim); text(ctx, ({ shellSlam: 'Shell Slam', riposte: 'Riposte', venomSpines: 'Venom Spines', lumenBeam: 'Lumen Beam', quake: 'Seabed Quake', maelstrom: 'Maelstrom' })[B.ability], x + 8, 172, '#9ad8ff'); });
      text(ctx, 'ARROWS: switch   ENTER: choose   This cannot be undone.', 56, 238, COL.dim);
    } else if (this.mode === 'confirm') {
      const F = FORMS[this.target]; drawText(ctx, 'READY TO MOLT?', 240, 60, { color: '#ff9ad8', align: 'center', scale: 2, shadow: '#000' });
      drawText(ctx, F.name, 240, 100, { color: COL.gold, align: 'center', shadow: '#000' }); const E = EVOLUTIONS[this.target]; if (E.branches.length) drawText(ctx, BRANCHES[E.branches[this.brSel]].name, 240, 116, { color: '#ffd84a', align: 'center', shadow: '#000' });
      text(ctx, 'The old shell will be left behind.', 240 - textWidth('The old shell will be left behind.') / 2, 150, COL.text); text(ctx, 'ENTER: begin the molt     ESC: not yet', 240 - textWidth('ENTER: begin the molt     ESC: not yet') / 2, 180, COL.dim);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Story panels (intro / endings): fading text over procedural illustrations
export class CutsceneScene {
  constructor(game, panels, done, opts = {}) { this.g = game; this.panels = panels; this.done = done; this.opts = opts; this.opaque = true; this.i = 0; this.t = 0; this.shown = 0; this.prev = null; this.xf = 1; }
  onEnter() { const m = this.panels[0]?.music || (this.opts.music === undefined ? 'title' : this.opts.music); if (m) this.g.audio.music.play?.(m); }
  go(i) { this.prev = { p: this.panels[this.i], t: this.t + this.i * 3 }; this.i = i; this.t = 0; this.shown = 0; this.xf = 0; this.g.audio.sfx('tick'); if (this.panels[i].music) this.g.audio.music.play?.(this.panels[i].music); }
  update(dt) {
    const inp = this.g.input, p = this.panels[this.i]; this.t += dt; this.shown += dt * 38; this.xf = Math.min(1, this.xf + dt / 0.9); if (this.prev) this.prev.t += dt * 0.3; if (this.xf >= 1) this.prev = null;
    if (this.t > 0.5 && (inp.pressed('confirm') || inp.pressed('attack') || inp.pressed('interact'))) {
      const full = p.text.length; if (this.shown < full) { this.shown = full; return; }
      if (this.i < this.panels.length - 1) this.go(this.i + 1); else { this.g.engine.pop(); this.done?.(); }
    }
    if (inp.pressed('pause')) { this.g.engine.pop(); this.done?.(); }
  }
  draw(ctx) {
    const info = { st: this.g.state }, p = this.panels[this.i];
    drawScene(ctx, p.art, this.t + this.i * 3, info, 26);
    if (this.prev && this.xf < 1) { ctx.save(); ctx.globalAlpha = 1 - this.xf; drawScene(ctx, this.prev.p.art, this.prev.t, info, 26); ctx.restore(); }
    // cinematic bars, a soft shade under the text, then the text
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 480, 14);
    const sh = ctx.createLinearGradient(0, 168, 0, 270); sh.addColorStop(0, 'rgba(2,6,14,0)'); sh.addColorStop(0.35, 'rgba(2,6,14,0.82)'); sh.addColorStop(1, 'rgba(2,6,14,0.96)'); ctx.fillStyle = sh; ctx.fillRect(0, 168, 480, 102);
    if (p.title) { const a = Math.min(1, this.t * 0.8); const sc = textWidth(p.title, 3) <= 430 ? 3 : textWidth(p.title, 2) <= 440 ? 2 : 1; drawText(ctx, p.title, 240, sc === 3 ? 30 : 34, { color: '#ffe08a', scale: sc, align: 'center', outline: '#3a1008', shadow: '#000', alpha: a }); }
    const wrapped = wrapText(p.text, 410); let before = 0;
    wrapped.forEach((l, i) => { const part = l.slice(0, Math.max(0, Math.floor(this.shown) - before)); before += l.length + 1; text(ctx, part, 240 - textWidth(l) / 2, 206 + i * 11, '#eaf6ff', { shadow: '#000' }); });
    const dots = this.panels.length; for (let k = 0; k < dots; k++) { ctx.fillStyle = k === this.i ? '#9ad8ff' : '#2a4a6a'; ctx.fillRect(240 - dots * 4 + k * 8, 258, 5, 2); }
    if (this.shown >= p.text.length && Math.floor(this.t * 2) % 2) text(ctx, 'ENTER', 440, 256, '#6aa8d8');
    const a = Math.max(0, 1 - this.t * 1.4); if (this.i === 0 && a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
  }
}

// Credits / summary shown after an ending, then back to the title
export class CreditsScene {
  constructor(game, kind, title) { this.g = game; this.kind = kind; this.title = title; this.opaque = true; this.t = 0; }
  onEnter() { this.g.audio.music.play?.('credits'); }
  update(dt) {
    this.t += dt;
    if (this.t > 2 && (this.g.input.pressed('confirm') || this.g.input.pressed('pause'))) { this.g.audio.music.stop?.(); this.g.world = null; this.g.engine.replace(new TitleScene(this.g)); }
  }
  draw(ctx) {
    const g = this.g, s = g.state, t = this.t;
    drawScene(ctx, 'night', t, { st: s }); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 480, 270);
    const a = Math.min(1, t * 0.6); ctx.globalAlpha = a;
    drawText(ctx, 'THE END', 240, 20, { color: '#ffe08a', scale: 3, align: 'center', outline: '#3a1008', shadow: '#000' });
    drawText(ctx, 'Ending: ' + this.title, 240, 56, { color: '#9af0ff', align: 'center', shadow: '#000' });
    const secrets = g.systems.codex.count() + ' / ' + g.systems.codex.total(); const ends = (s.settings.endings || []).length;
    const rows = [['Time', fmtTime(s.playtime)], ['Level', s.level], ['Form', FORMS[s.form].name], ['Enemies defeated', s.stats.kills], ['Times fallen', s.stats.deaths], ['Codex entries', secrets], ['Endings found', ends + ' / 4']];
    rows.forEach((r, i) => { text(ctx, r[0], 150, 86 + i * 14, COL.dim); text(ctx, String(r[1]), 330 - textWidth(String(r[1])) + 0, 86 + i * 14, '#ffffff'); });
    if (ends < 4) text(ctx, 'There are more ways this tide could have turned.', 240 - textWidth('There are more ways this tide could have turned.') / 2, 200, COL.dim);
    if (t > 2 && Math.floor(t * 2) % 2) text(ctx, 'ENTER: return to title', 240 - textWidth('ENTER: return to title') / 2, 248, COL.borderLit);
    ctx.globalAlpha = 1;
  }
}
