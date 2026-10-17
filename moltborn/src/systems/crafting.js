// Kitchen: creatures drop ingredients, recipes are learned the first time every ingredient has been held, and dishes
// grant timed buffs through the status system. The same `use` function also handles plain consumables so the Items
// menu and any quick-use key share one rule set.
import { ITEMS } from '../data/items.js';
import { RECIPES, RECIPE_BY_ID, DROPS } from '../data/recipes.js';
import { STATUS } from './status.js';
import { rng } from '../core/util.js';

const rand = rng(90210);

export class Crafting {
  constructor(game) {
    this.g = game; game.systems.crafting = this;
    game.events.on('kill', (type, e) => this.rollDrops(type, e));
    game.events.on('gotitem', (id) => this.noteSeen(id));
  }
  get kitchen() { const s = this.g.state; return s.kitchen || (s.kitchen = { seen: {}, known: {} }); }

  // ---- drops ------------------------------------------------------------------------------------------------------------------------
  rollDrops(type, e) {
    const table = DROPS[type]; if (!table) return;
    const w = this.g.world, luck = 1 + (w?.player?.stats?.coinBonus || 0) * 0.5;
    for (const [id, chance] of table) {
      if (rand() < Math.min(0.95, chance * luck * (e?.xpMult > 1 ? 1.5 : 1))) this.g.grantItem(id, 1, true);
    }
  }

  // ---- recipes ------------------------------------------------------------------------------------------------------------------------
  noteSeen(id) {
    if (!ITEMS[id] || (ITEMS[id].type !== 'ingredient' && id !== 'pearl')) return;
    const k = this.kitchen; if (k.seen[id]) { return; } k.seen[id] = true;
    for (const r of RECIPES) if (!k.known[r.id] && Object.keys(r.needs).every((n) => k.seen[n])) {
      k.known[r.id] = true; this.g.toast('Recipe learned: ' + ITEMS[r.out].name, '#ffd8a0'); this.g.audio.sfx('pickup');
      this.g.events.emit('recipe', r.id);
    }
  }
  known(id) { return !!this.kitchen.known[id]; }
  knownCount() { return RECIPES.filter((r) => this.kitchen.known[r.id]).length; }
  have(r) { return Object.entries(r.needs).every(([id, n]) => this.g.itemCount(id) >= n); }
  missing(r) { return Object.entries(r.needs).filter(([id, n]) => this.g.itemCount(id) < n).map(([id, n]) => [id, n - this.g.itemCount(id)]); }
  // how many of a recipe can be cooked from the current inventory
  maxBatches(r) { return Math.min(...Object.entries(r.needs).map(([id, n]) => Math.floor(this.g.itemCount(id) / n))); }

  craft(id, times = 1) {
    const r = RECIPE_BY_ID[id]; if (!r || !this.known(id)) return false;
    let made = 0;
    for (let i = 0; i < times && this.have(r); i++) {
      for (const [item, n] of Object.entries(r.needs)) this.g.addItem(item, -n);
      this.g.addItem(r.out, r.n); made += r.n;
    }
    if (!made) return false;
    const rec = this.g.state.records;
    if (rec) { rec.crafted += made; rec.craftedBy[id] = (rec.craftedBy[id] || 0) + made; }
    this.g.audio.sfx('item'); this.g.popup(r.out, ITEMS[r.out].name + (made > 1 ? ' x' + made : ''), '#ffd8a0');
    this.g.events.emit('crafted', id, made);
    return made;
  }

  // ---- using food and tonics ----------------------------------------------------------------------------------------------------------
  // returns null on success or a message explaining why nothing happened
  use(id) {
    const g = this.g, it = ITEMS[id], p = g.world?.player; if (!it || !it.use || !p) return 'Cannot use that';
    const u = it.use;
    const wasteful = !(u.tide && p.tide < p.stats.maxTide) && !(u.fury) && !(u.buffs?.length) && !(u.cleanse && p.status.size) && !(u.heal && p.hp < p.stats.maxHp);
    if (wasteful) return u.heal ? 'Already at full health' : 'No need right now';
    g.addItem(id, -1);
    if (u.heal) p.heal(Math.round(p.stats.maxHp * u.heal));
    if (u.tide) p.addTide(p.stats.maxTide * u.tide);
    if (u.fury) p.addFury(u.fury);
    if (u.cleanse) p.status.cleanse(u.cleanse);
    for (const b of u.buffs || []) if (STATUS[b.id]) p.status.apply(b.id, { dur: b.dur, power: b.power });
    const rec = g.state.records;
    if (it.type === 'dish' && rec) rec.eaten[id] = (rec.eaten[id] || 0) + 1;
    p.world.fx.ring(p.x, p.y, 4, 26, 0.4, '#ffd8a0', 2); g.audio.sfx('pickup');
    g.events.emit('ate', id);
    return null;
  }
}
