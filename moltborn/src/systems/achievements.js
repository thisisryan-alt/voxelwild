// Trophy engine: watches the save, awards achievements from data/achievements.js and queues the banners that announce
// them. Trophies are stored twice: in the save (state.trophies) and in the settings file, so a trophy earned in one
// voyage is still on the wall after starting another.
import { ACHIEVEMENTS, BY_ID, TIERS, CATS } from '../data/achievements.js';
import { Save } from '../core/save.js';
import { panel, text, textWidth, COL } from '../ui/ui.js';

const WATCH = ['kill', 'boss', 'zone', 'questdone', 'evolved', 'codex', 'chest', 'gotitem', 'item', 'rest', 'levelup', 'ending', 'crafted', 'rift', 'photo', 'travel', 'playerdied', 'trophycheck'];
const BANNER_TIME = 4.2;

export class Achievements {
  constructor(game) {
    this.g = game; game.systems.achievements = this;
    this.dirty = true; this.timer = 0; this.banners = []; this.cur = null; this.quiet = 0;
    for (const ev of WATCH) game.events.on(ev, () => { this.dirty = true; });
  }
  get earned() { return this.g.state.trophies || (this.g.state.trophies = {}); }
  get wall() { const s = this.g.state.settings; return s.trophies || (s.trophies = {}); }

  has(id) { return !!this.earned[id]; }
  count() { return ACHIEVEMENTS.reduce((n, a) => n + (this.has(a.id) ? 1 : 0), 0); }
  total() { return ACHIEVEMENTS.length; }
  points() { return ACHIEVEMENTS.reduce((n, a) => n + (this.has(a.id) ? TIERS[a.tier].pts : 0), 0); }

  // everything an achievement's get() may look at, computed once per pass
  context() {
    const g = this.g, s = g.state, r = s.records;
    const kills = Object.values(r.kills).reduce((a, b) => a + b, 0);
    return {
      g, s, r, kills, zones: g.systems.stats ? g.systems.stats.zonesSeen() : 0,
      combo: Math.max(r.bestCombo, s.stats.comboBest || 0, g.world?.player?.comboBest || 0),
      codex: g.systems.codex ? g.systems.codex.count() : 0,
      endings: (s.settings.endings || []).length,
      others: 0, totalOthers: ACHIEVEMENTS.length - 1,
    };
  }

  progress(a, ctx = this.context()) {
    let v = 0; try { v = a.get(ctx); } catch (e) { v = 0; }
    return Math.max(0, Math.min(a.goal, +v || 0));
  }
  fraction(a, ctx) { return this.progress(a, ctx) / a.goal; }

  update(dt) {
    this.timer += dt;
    this.stepBanner(dt);
    if (!this.g.world) return;
    if (!this.merged) this.mergeWall();
    if (this.timer < (this.dirty ? 0.6 : 5)) return;
    this.timer = 0; this.dirty = false; this.scan();
  }

  // trophies from the settings file flow into a fresh save without announcing themselves again
  mergeWall() {
    this.merged = true; const e = this.earned, w = this.wall;
    for (const id of Object.keys(w)) if (BY_ID[id] && !e[id]) e[id] = w[id];
    for (const id of Object.keys(e)) if (BY_ID[id] && !w[id]) w[id] = e[id];
  }

  scan() {
    const ctx = this.context();
    for (const a of ACHIEVEMENTS) {
      if (a.id === 'completionist') continue;
      if (!this.has(a.id) && this.progress(a, ctx) >= a.goal) this.award(a);
    }
    const last = BY_ID.completionist;
    if (last && !this.has(last.id)) {
      ctx.others = ACHIEVEMENTS.reduce((n, a) => n + (a.id !== last.id && this.has(a.id) ? 1 : 0), 0);
      if (this.progress(last, ctx) >= last.goal) this.award(last);
    }
  }

  award(a, silent = false) {
    if (this.has(a.id)) return false;
    const mark = { at: Math.round(this.g.state.playtime) };
    this.earned[a.id] = mark; this.wall[a.id] = mark;
    Save.saveSettings(this.g.state.settings);
    if (!silent) {
      this.banners.push(a);
      this.g.audio.sfx('trophy');
    }
    this.g.events.emit('trophy', a.id);
    return true;
  }

  // ---- banner (drawn by the HUD) -----------------------------------------------------------------------------------------
  stepBanner(dt) {
    if (this.cur) { this.cur.t += dt; if (this.cur.t > BANNER_TIME) this.cur = null; }
    if (!this.cur && this.banners.length) this.cur = { a: this.banners.shift(), t: 0 };
  }
  drawBanner(ctx) {
    const b = this.cur; if (!b) return;
    const a = b.a, tier = TIERS[a.tier], k = Math.min(1, b.t * 4, (BANNER_TIME - b.t) * 4);
    const name = a.name, w = Math.max(120, textWidth(name) + 44), x = 478 - w * (0.2 + 0.8 * k), y = 8;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4);
    panel(ctx, x, y, w, 26, { alpha: 0.92 });
    ctx.fillStyle = tier.color; ctx.fillRect(x + 4, y + 4, 18, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 6, y + 6, 14, 14);
    drawTrophyGlyph(ctx, x + 13, y + 13, tier.color, a.cat);
    text(ctx, 'TROPHY — ' + tier.name.toUpperCase(), x + 27, y + 4, tier.color);
    text(ctx, name, x + 27, y + 14, COL.text);
    ctx.restore();
  }

  // ---- for the trophy page --------------------------------------------------------------------------------------------------
  list(cat) { return ACHIEVEMENTS.filter((a) => !cat || a.cat === cat); }
  categories() { return CATS; }
  describe(a, ctx = this.context()) {
    const got = this.has(a.id);
    if (a.hidden && !got) return { name: '???', desc: 'A hidden trophy. Keep exploring.', got, frac: 0, now: 0 };
    return { name: a.name, desc: a.desc, got, frac: got ? 1 : this.fraction(a, ctx), now: got ? a.goal : this.progress(a, ctx) };
  }
}

// a tiny 7x7 glyph per category so the wall reads at a glance
const GLYPHS = {
  combat: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  explore: ['...#...', '..###..', '.#.#.#.', '#######', '.#.#.#.', '..###..', '...#...'],
  story: ['.#####.', '#.....#', '#.###.#', '#.#...#', '#.###.#', '#.....#', '.#####.'],
  collect: ['..###..', '.#####.', '#######', '#######', '.#####.', '..###..', '...#...'],
  challenge: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
};
export function drawTrophyGlyph(ctx, cx, cy, color, cat = 'combat') {
  const map = GLYPHS[cat] || GLYPHS.combat; ctx.fillStyle = color;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (map[y][x] === '#') ctx.fillRect(Math.round(cx) - 3 + x, Math.round(cy) - 3 + y, 1, 1);
}
