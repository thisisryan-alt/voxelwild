// The help compendium: tabbed pages of short entries. Pages marked `from` are built from live data (statuses, affixes, the
// tide clock, difficulty tiers) so the text always matches the rules.
import { panel, text, button, COL, drawText, textWidth, wrapText } from './ui.js';
import { PAGES, TIPS_FOOTER } from '../data/help.js';
import { STATUS, statusIcon } from '../systems/status.js';
import { AFFIXES, AFFIX_IDS, ELITE_REWARD } from '../data/affixes.js';
import { PHASES, CYCLE } from '../data/clock.js';
import { TIERS } from '../systems/difficulty.js';
import { TRICKS } from '../entities/companion.js';
import { DIFFICULTIES } from '../systems/settings.js';

const pct = (m) => (m === 1 ? '-' : (m > 1 ? '+' : '') + Math.round((m - 1) * 100) + '%');

// the entries of a page as { t, x: [lines], icon?, color? }
export function entriesFor(page, game) {
  if (page.entries && !page.from) return page.entries.map(resolve);
  if (page.from === 'status') return Object.entries(STATUS).filter(([, d]) => !d.passive).map(([id, d]) => ({ t: d.name, x: [d.desc, d.harmful ? 'A harmful effect.' : 'A beneficial effect.'], icon: id, color: d.color })).concat(Object.entries(STATUS).filter(([, d]) => d.passive).map(([id, d]) => ({ t: d.name, x: [d.desc, 'Comes with the hour of the day.'], icon: id, color: d.color })));
  if (page.from === 'affixes') return [{ t: 'Elite foes', x: [`Some creatures are born elite: marked with a coloured name and a pip, and carrying one or two modifiers. They pay about ${Math.round((ELITE_REWARD.xp - 1) * 100)}% more experience and ${ELITE_REWARD.coin}x coins, and may drop pearls.`] }, ...AFFIX_IDS.map((id) => ({ t: AFFIXES[id].name, x: [AFFIXES[id].tip], color: AFFIXES[id].color }))];
  if (page.from === 'difficulty') return [...DIFFICULTIES.map((k) => { const T = TIERS[k]; return { t: T.name, x: [T.blurb, `Foe health ${pct(T.hp)}, damage taken ${pct(T.dmg)}, experience ${pct(T.xp)}, coins ${pct(T.coin)}`] }; }),
    { t: 'New Game+', x: ['After any ending, start again with your level, forms, skills and gear. Foes grow tougher each voyage (up to five), and so do the rewards.'] },
    { t: 'Accessibility', x: ['Options > Access: sound captions, reduced flashes and motion, high-contrast telegraphs, colour-blind palettes, large HUD, key rebinding and controller rumble.'] }];
  return [];
}
function resolve(e) {
  if (e.from === 'companion') return { t: 'Your hatchling', x: ['Buy a Hatchling Egg from Madame Cowrie and a small crab will follow you, grow with every foe you defeat (to level 10), and learn tricks:', ...TRICKS.map((t) => `Level ${t.lv}, ${t.name}: ${t.desc}`)] };
  if (e.from === 'clock') return { t: 'The tide clock', x: [`A day on the reef lasts ${Math.round(CYCLE / 60)} minutes of play. Light, foes and rewards change with the hour:`, ...PHASES.map((p) => `${p.name}: ${[p.mods.xp !== 1 && `${pct(p.mods.xp)} experience`, p.mods.coin !== 1 && `${pct(p.mods.coin)} coins`, p.mods.aggro !== 1 && `foes ${pct(p.mods.aggro)} warier`, p.status && 'a passive boon'].filter(Boolean).join(', ') || 'no change'}`), 'Turn it off in Options > Video > Day and night.'] };
  return e;
}

export class HelpScene {
  constructor(game, page = 0) { this.g = game; this.opaque = false; this.page = page; this.scroll = 0; this.t = 0; this.cache = {}; }
  onEnter() { this.g.audio.sfx('select'); }
  entries() { return this.cache[this.page] ||= entriesFor(PAGES[this.page], this.g); }
  // lines laid out for the current page: [{ y, kind, s, color }], and the total height
  layout() {
    const out = []; let y = 0; const W = 360;
    for (const e of this.entries()) {
      out.push({ y, k: 't', s: e.t, color: e.color || COL.gold, icon: e.icon }); y += 12;
      for (const par of e.x || []) for (const l of wrapText(par, W - (e.icon ? 0 : 0))) { out.push({ y, k: 'x', s: l }); y += 10; }
      y += 6;
    }
    return { lines: out, h: y };
  }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const n = PAGES.length;
    if (inp.pressed('left') || inp.pressed('tabL')) { this.page = (this.page + n - 1) % n; this.scroll = 0; g.audio.sfx('tick'); }
    if (inp.pressed('right') || inp.pressed('tabR')) { this.page = (this.page + 1) % n; this.scroll = 0; g.audio.sfx('tick'); }
    const L = this.layout(), max = Math.max(0, L.h - 150);
    if (inp.pressed('up')) this.scroll = Math.max(0, this.scroll - 24); if (inp.pressed('down')) this.scroll = Math.min(max, this.scroll + 24);
    this.scroll = Math.min(this.scroll, max);
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.82)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 30, 12, 420, 246, { alpha: 0.97 }); drawText(ctx, 'HELP', 240, 18, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    let x = 40; PAGES.forEach((p, i) => { const w = textWidth(p.name) + 12; button(ctx, p.name, x, 40, w, 14, i === this.page); x += w + 3; });
    const L = this.layout(), top = 62, h = 160;
    ctx.save(); ctx.beginPath(); ctx.rect(40, top, 400, h); ctx.clip();
    for (const ln of L.lines) {
      const y = top + ln.y - this.scroll; if (y < top - 12 || y > top + h) continue;
      if (ln.k === 't') { if (ln.icon) { ctx.drawImage(statusIcon(ln.icon, 1), 42, y - 1); text(ctx, ln.s, 54, y, ln.color); } else text(ctx, ln.s, 44, y, ln.color); }
      else text(ctx, ln.s, 52, y, COL.text);
    }
    ctx.restore();
    if (L.h > h) { const bh = Math.max(14, Math.round(h * h / L.h)), by = top + Math.round((h - bh) * (this.scroll / Math.max(1, L.h - h))); ctx.fillStyle = '#0a1a38'; ctx.fillRect(444, top, 3, h); ctx.fillStyle = '#6ab0ff'; ctx.fillRect(444, by, 3, bh); }
    text(ctx, TIPS_FOOTER, 240 - textWidth(TIPS_FOOTER) / 2, 236, '#9ad8ff');
  }
}
