// The options screen: settings grouped into pages (Audio / Video / Gameplay / Access), driven by systems/settings.js.
// Shared by the title screen, the pause menu and the stand-alone OptionsScene through updateOptions / drawOptions.
import { panel, text, bar, COL, drawText, textWidth, wrapText } from './ui.js';
import { Save } from '../core/save.js';
import { SCHEMA, GROUPS, stepSetting, displayValue } from '../systems/settings.js';

const rowsOf = (group) => SCHEMA.filter((r) => r.group === group);

function currentValue(g, row) {
  if (row.key === 'mute') return g.audio.muted ? 1 : 0;
  return g.state.settings[row.key];
}

function commit(g, row, value) {
  if (row.key === 'mute') { g.audio.muted = !!value; }
  else g.state.settings[row.key] = value;
  g.audio.applyVolumes?.();
  g.events.emit('setting', row.key, value);
}

export function updateOptions(scene, g, inp, back) {
  scene.og = scene.og ?? 0; scene.os = scene.os ?? 0; scene.ot = (scene.ot || 0) + 1;
  const group = GROUPS[scene.og], rows = rowsOf(group);
  const s = g.state.settings;
  if (inp.pressed('tabL')) { scene.og = (scene.og + GROUPS.length - 1) % GROUPS.length; scene.os = 0; g.audio.sfx('tick'); return; }
  if (inp.pressed('tabR')) { scene.og = (scene.og + 1) % GROUPS.length; scene.os = 0; g.audio.sfx('tick'); return; }
  if (inp.pressed('up')) { scene.os = (scene.os + rows.length - 1) % rows.length; g.audio.sfx('tick'); }
  if (inp.pressed('down')) { scene.os = (scene.os + 1) % rows.length; g.audio.sfx('tick'); }
  scene.os = Math.min(scene.os, rows.length - 1);
  const row = rows[scene.os], d = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
  if (d || (inp.pressed('confirm') && (row.type === 'toggle' || row.type === 'cycle'))) {
    commit(g, row, stepSetting(row, currentValue(g, row), d || 1));
    g.audio.sfx(row.type === 'toggle' ? 'select' : 'tick');
  }
  if (inp.pressed('cancel') || inp.pressed('pause')) { Save.saveSettings(s); g.audio.sfx('back'); back(); }
}

export function drawOptions(ctx, scene) {
  const g = scene.g, og = scene.og ?? 0, os = scene.os ?? 0;
  const X = 54, Y = 22, W = 372, H = 226;
  panel(ctx, X, Y, W, H, { alpha: 0.95 });
  drawText(ctx, 'OPTIONS', 240, Y + 6, { color: COL.gold, align: 'center', shadow: '#000' });
  // group tabs
  const tw = (W - 20) / GROUPS.length;
  GROUPS.forEach((n, i) => {
    const x = X + 10 + i * tw, sel = i === og;
    ctx.fillStyle = sel ? '#1e4a7a' : '#0c1830'; ctx.fillRect(x, Y + 20, tw - 2, 14);
    ctx.fillStyle = sel ? COL.borderLit : '#2a3a58'; ctx.fillRect(x, Y + 33, tw - 2, 1);
    text(ctx, n.toUpperCase(), x + (tw - 2) / 2 - textWidth(n.toUpperCase()) / 2, Y + 24, sel ? '#ffffff' : COL.dim);
  });
  text(ctx, 'Q', X + 3, Y + 24, '#6a9ad0'); text(ctx, 'E', X + W - 9, Y + 24, '#6a9ad0');
  const rows = rowsOf(GROUPS[og]), y0 = Y + 42, rh = 16;
  rows.forEach((row, i) => {
    const y = y0 + i * rh, sel = i === os, v = currentValue(g, row);
    if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(X + 6, y - 3, W - 12, rh - 1); }
    text(ctx, row.label, X + 14, y + 1, sel ? '#ffffff' : COL.dim);
    const vx = X + 196;
    if (row.type === 'slider') {
      bar(ctx, vx, y + 2, 100, 5, (v - row.min) / (row.max - row.min), '#3a8ae8', '#8ad0ff', '#0a1a3a');
      text(ctx, displayValue(row, v), vx + 108, y + 1, COL.text);
    } else {
      const on = row.type === 'toggle' ? !!v : v !== row.options[0];
      text(ctx, displayValue(row, v), vx, y + 1, on ? (row.type === 'toggle' ? COL.green : COL.gold) : COL.dim);
      if (sel && row.type === 'cycle') { text(ctx, '◀', vx - 10, y + 1, '#6a9ad0'); text(ctx, '▶', vx + textWidth(displayValue(row, v)) + 4, y + 1, '#6a9ad0'); }
    }
  });
  const row = rows[os];
  if (row?.hint) wrapText(row.hint, 340).forEach((l, i) => text(ctx, l, X + 14, Y + H - 34 + i * 10, '#9ad8ff'));
  text(ctx, '◀ ▶ change    Q/E page    ESC back', 240 - textWidth('◀ ▶ change    Q/E page    ESC back') / 2, Y + H - 12, COL.dim);
}
