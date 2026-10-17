// The Hall of Tides: a record of what the swimmer has done. Three pages: recent runs of the rifts and the Pearl Gauntlet,
// the fish log, and lifetime totals. Left and right change page; ESC leaves.
import { panel, text, button, COL, drawText, textWidth } from './ui.js';
import { FISH, RARITY } from '../data/fish.js';
import { itemIcon } from '../gfx/sprites_ui.js';

const PAGES = ['Runs', 'Fish', 'Totals'];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
export const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 10000 ? Math.round(n / 1000) + 'k' : String(Math.round(n)));
const hours = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;

// the rows of the Totals page, from the records in the save
export function totals(state) {
  const r = state.records || {}, sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0), b = state.bounties || {}, f = state.fish || { total: 0, species: {} };
  return [
    ['Foes defeated', sum(r.kills)], ['Damage dealt', r.dmgDealt || 0], ['Damage taken', r.dmgTaken || 0], ['Deaths', sum(r.deathsBy)], ['Best hit', r.bestHit || 0], ['Best combo', r.bestCombo || 0],
    ['Distance swum', Math.round((r.distance || 0) / 16)], ['Chests opened', r.chests || 0], ['Shrine rests', r.rests || 0], ['Dishes cooked', r.crafted || 0],
    ['Forage patches', r.forage || 0], ['Fish caught', f.total || 0], ['Species found', Object.keys(f.species).length], ['Rifts cleared', r.rifts || 0], ['Deepest rift', r.riftBest || 0],
    ['Gauntlet best', r.arenaBest || 0], ['Wardens felled', r.wardens || 0], ['Bounties claimed', b.claimed || 0], ['Elites slain', r.elites || 0], ['Time played', hours(state.playtime || 0)],
  ];
}

export class HallScene {
  constructor(game, page = 0) { this.g = game; this.opaque = false; this.page = page; this.t = 0; }
  onEnter() { this.g.audio.sfx('select'); }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const n = PAGES.length; if (inp.pressed('left') || inp.pressed('tabL')) { this.page = (this.page + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('right') || inp.pressed('tabR')) { this.page = (this.page + 1) % n; g.audio.sfx('tick'); }
  }
  draw(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(2,8,20,0.84)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 24, 12, 432, 246, { alpha: 0.97 }); drawText(ctx, 'HALL OF TIDES', 240, 18, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    let x = 36; PAGES.forEach((p, i) => { button(ctx, p, x, 40, 60, 14, i === this.page); x += 63; });
    if (this.page === 0) this.drawRuns(ctx); else if (this.page === 1) this.drawFish(ctx); else this.drawTotals(ctx);
    const h = 'LEFT / RIGHT page    ESC close'; text(ctx, h, 240 - textWidth(h) / 2, 240, '#9ad8ff');
  }
  drawRuns(ctx) {
    const H = this.g.systems.history, S = H.stats(), rows = H.recent(9);
    text(ctx, `${S.runs} run${S.runs === 1 ? '' : 's'}   ${S.wins} cleared (${Math.round(S.rate * 100)}%)   Streak ${S.streak} (best ${S.longest})`, 36, 60, COL.dim);
    const right = `Deepest ${S.deepest}   Gauntlet wave ${S.bestWave}`; text(ctx, right, 444 - textWidth(right), 60, COL.dim);
    if (!rows.length) { text(ctx, 'No runs yet. The Tide Board in the reef hub offers rifts and the Pearl Gauntlet.', 36, 90, COL.dim); return; }
    text(ctx, 'RESULT', 36, 76, COL.gold); text(ctx, 'RUN', 96, 76, COL.gold); text(ctx, 'DEPTH', 220, 76, COL.gold); text(ctx, 'TIME', 272, 76, COL.gold); text(ctx, 'FOES', 314, 76, COL.gold); text(ctx, 'COINS', 350, 76, COL.gold); text(ctx, 'WHEN', 396, 76, COL.gold);
    rows.forEach((r, i) => {
      const y = 90 + i * 14, tag = r.kind === 'arena' ? (r.success ? 'SURVIVED' : 'FELL') : r.success ? 'CLEARED' : 'LOST', col = r.success ? COL.green : '#ff9a8a';
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(20,48,90,0.35)'; ctx.fillRect(32, y - 2, 416, 13); }
      text(ctx, tag, 36, y, col); text(ctx, (r.kind === 'daily' ? 'Daily - ' : '') + r.tier, 96, y, COL.text); text(ctx, r.kind === 'arena' ? `wave ${r.depth}` : `${r.depth}/${r.max}`, 220, y, COL.text);
      text(ctx, fmt(r.secs), 272, y, COL.dim); text(ctx, String(r.kills), 314, y, COL.dim); text(ctx, '+' + r.coins, 350, y, COL.gold); text(ctx, H.ago(r), 396, y, COL.dim);
    });
    const b = Object.entries(H.best); if (b.length) text(ctx, 'Fastest: ' + b.map(([k, v]) => `${k} ${fmt(v)}`).join('   '), 36, 222, '#9ad8ff');
  }
  drawFish(ctx) {
    const st = this.g.state.fish || { total: 0, species: {} }, n = Object.keys(st.species).length;
    text(ctx, `${n}/${FISH.length} species   ${st.total} caught`, 36, 60, COL.dim);
    FISH.forEach((f, i) => {
      const col = Math.floor(i / 10), row = i % 10, x = 36 + col * 210, y = 74 + row * 15, e = st.species[f.id], R = RARITY[f.rarity];
      ctx.globalAlpha = e ? 1 : 0.28; ctx.drawImage(itemIcon('fish_' + f.id), x, y - 2, 12, 12); ctx.globalAlpha = 1;
      text(ctx, e ? f.name : '???', x + 16, y, e ? R.color : '#4a5a74');
      if (e) { const s = `x${e.n}  ${e.best} cm`; text(ctx, s, x + 196 - textWidth(s), y, COL.dim); }
    });
  }
  drawTotals(ctx) {
    totals(this.g.state).forEach(([k, v], i) => {
      const col = Math.floor(i / 10), row = i % 10, x = 40 + col * 210, y = 66 + row * 16, s = typeof v === 'number' ? num(v) : v;
      if (row % 2 === 0) { ctx.fillStyle = 'rgba(20,48,90,0.3)'; ctx.fillRect(x - 4, y - 3, 204, 14); }
      text(ctx, k, x, y, COL.dim); text(ctx, s, x + 196 - textWidth(s), y, COL.text);
    });
  }
}
