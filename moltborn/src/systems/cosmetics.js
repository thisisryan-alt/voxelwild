// Cosmetic choices: which title and wake the swimmer uses. Unlocks come from trophies, so nothing is stored but the choice.
import { TITLES, TRAILS } from '../data/cosmetics.js';

export class Cosmetics {
  constructor(game) { this.g = game; game.systems.cosmetics = this; }
  get pick() { const s = this.g.state; return s.cosmetics || (s.cosmetics = { title: 'none', trail: 'default' }); }
  has(entry) { return !entry.by || !!this.g.systems.achievements?.has(entry.by); }
  titles() { return Object.entries(TITLES).map(([id, t]) => ({ id, ...t, owned: this.has(t) })); }
  trails() { return Object.entries(TRAILS).map(([id, t]) => ({ id, ...t, owned: this.has(t) })); }
  titleText() { const t = TITLES[this.pick.title]; return t && this.pick.title !== 'none' && this.has(t) ? t.name : ''; }
  trail() { const t = TRAILS[this.pick.trail]; return t && this.has(t) ? t : TRAILS.default; }
  equip(kind, id) {
    const table = kind === 'title' ? TITLES : TRAILS, e = table[id]; if (!e || !this.has(e)) return false;
    this.pick[kind] = id; this.g.events.emit('cosmetic', kind, id); return true;
  }
  counts() { const t = this.titles(), w = this.trails(); return { titles: [t.filter((x) => x.owned).length, t.length], trails: [w.filter((x) => x.owned).length, w.length] }; }
}
