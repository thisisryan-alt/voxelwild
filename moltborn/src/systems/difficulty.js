// Difficulty tiers and New Game+. Both reduce to four multipliers (enemy health, damage taken, experience, coins) that
// the rest of the game reads through scale(). Tiers live in the settings file, NG+ cycles in the save.
import { setting, DIFFICULTIES } from './settings.js';
import { ITEMS } from '../data/items.js';
import { FORM_ORDER } from '../data/forms.js';

export const TIERS = {
  calm:      { name: 'Calm',      hp: 0.8,  dmg: 0.7,  xp: 1.0, coin: 1.0, blurb: 'Forgiving: foes hit softer and fall faster.' },
  tide:      { name: 'Tide',      hp: 1.0,  dmg: 1.0,  xp: 1.0, coin: 1.0, blurb: 'As designed.' },
  rip:       { name: 'Rip',       hp: 1.3,  dmg: 1.25, xp: 1.2, coin: 1.15, blurb: 'Tougher foes, richer rewards.' },
  maelstrom: { name: 'Maelstrom', hp: 1.7,  dmg: 1.6,  xp: 1.5, coin: 1.3, blurb: 'Unforgiving. Every mistake is expensive.' },
};
// each New Game+ voyage stacks on top of the tier
export const NG_STEP = { hp: 0.35, dmg: 0.25, xp: 0.3, coin: 0.2 };
export const NG_MAX = 5;

// what carries over from a finished game into New Game+
export const NG_KEEP = ['level', 'xp', 'ep', 'sp', 'form', 'branches', 'dye', 'dyes', 'skills', 'abilities', 'slots', 'equip', 'mutations', 'mutOwned', 'upgrades', 'codex', 'coins', 'records', 'trophies', 'kitchen', 'stats'];
const KEEP_TYPES = new Set(['consumable', 'dish', 'ingredient', 'material', 'equip', 'mutation', 'dye']);

export class Difficulty {
  constructor(game) { this.g = game; game.systems.difficulty = this; }
  get tierKey() { const k = setting(this.g, 'difficulty'); return DIFFICULTIES.includes(k) ? k : 'tide'; }
  get ng() { return this.g.state.ng || 0; }
  scale() {
    const t = TIERS[this.tierKey], ng = this.ng;
    const s = { hp: t.hp * (1 + ng * NG_STEP.hp), dmg: t.dmg * (1 + ng * NG_STEP.dmg), xp: t.xp * (1 + ng * NG_STEP.xp), coin: t.coin * (1 + ng * NG_STEP.coin) };
    const r = this.g.systems.rifts?.mult() || this.g.systems.arena?.mult(); if (r) for (const k of Object.keys(s)) s[k] *= r[k];
    const c = this.g.systems.clock?.mult(); if (c) { s.xp *= c.xp; s.coin *= c.coin; }
    s.xp *= this.g.systems.companion?.xpBonus?.() ?? 1;
    return s;
  }
  label() { const ng = this.ng; return TIERS[this.tierKey].name + (ng ? `  NG+${ng}` : ''); }

  // New Game+ is open once any ending has been seen on this machine
  available() { return (this.g.state.settings.endings || []).length > 0; }

  // build the carried-over state for a new voyage from an old save's state
  carry(old, fresh) {
    for (const k of NG_KEEP) if (old[k] !== undefined) fresh[k] = JSON.parse(JSON.stringify(old[k]));
    fresh.inv = {};
    for (const [id, n] of Object.entries(old.inv || {})) if (ITEMS[id] && KEEP_TYPES.has(ITEMS[id].type) && n > 0) fresh.inv[id] = n;
    fresh.ng = Math.min(NG_MAX, (old.ng || 0) + 1);
    fresh.playtime = old.playtime || 0; fresh.hp = null; fresh.tide = null;
    // the forms already outgrown count as molted, so the opening quests do not wait for a molt that cannot happen
    const cur = FORM_ORDER.indexOf(fresh.form);
    for (let i = 1; i <= cur; i++) fresh.flags['evolved_' + FORM_ORDER[i]] = true;
    fresh.flags.ng_plus = fresh.ng;
    return fresh;
  }
}
