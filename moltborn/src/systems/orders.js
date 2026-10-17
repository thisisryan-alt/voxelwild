// Kitchen orders: three requests a day (by the real calendar) from the people of the sea, each asking for a dish the
// swimmer already knows how to cook. Delivering one pays coins, sometimes a pearl, and makes the requester a little
// friendlier. Orders are generated from the date, so everyone sees the same board on the same day.
import { RECIPES } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';
import { NPCS } from '../data/npcs.js';
import { today } from '../world/rift_gen.js';
import { rng } from '../core/util.js';

const REQUESTERS = ['cowrie', 'pip', 'tessa', 'brack', 'morel', 'tallow', 'sear', 'fenwick', 'ruby', 'ostrea', 'inkwell', 'hobb', 'glimmer', 'old_brine'];
const LINES = {
  cowrie: 'My guests are hungry and my cook is hopeless. Bring me {dish}, darling.', pip: 'Can you make {dish}? I have never had it. Please? I will pay!',
  tessa: 'The seedlings take care of me. I would like {dish} to take care of myself.', brack: 'Counting is hungry work. {dish}, if you would.',
  morel: 'For research purposes only: {dish}. Do not ask what research.', tallow: 'The archive does not feed itself. {dish}, quietly, please.',
  sear: 'Forge work wants a proper meal. {dish}, hot.', fenwick: 'I have been drawing on an empty stomach. {dish} would help the lines.',
  ruby: 'A crew runs on a full belly. {dish}, sailor, and quick.', ostrea: 'Pearl-smithing is slow. {dish} would keep the hands steady.',
  inkwell: 'My muse is peckish. {dish}, and a fine story to follow.', hobb: 'Quartermaster rations are a crime. {dish}, if you please.',
  glimmer: 'The deep gets cold. {dish} would warm a lamp-keeper.', old_brine: 'An old crab remembers every dish he ever ate. Bring me {dish}.',
};
const STEP = 3;      // every STEP-th delivery pays a pearl

export class Orders {
  constructor(game) { this.g = game; game.systems.orders = this; }
  get state() { const s = this.g.state; return s.orders || (s.orders = { day: 0, list: [], delivered: 0 }); }

  // dishes the swimmer can already cook, as recipe ids with their output item
  cookable() { const k = this.g.systems.crafting; return RECIPES.filter((r) => k.known(r.id) && ['dish', 'consumable'].includes(ITEMS[r.out].type)); }

  refresh() {
    const st = this.state, day = today(); if (st.day === day && st.list.length) return st.list;
    const pool = this.cookable(), r = rng(day * 31 + 7); st.day = day; st.list = [];
    if (!pool.length) return st.list;
    const who = REQUESTERS.slice(); const n = Math.min(3, pool.length + 1);
    for (let i = 0; i < n; i++) {
      const rec = pool[Math.floor(r() * pool.length)], npc = who.splice(Math.floor(r() * who.length), 1)[0], count = 1 + Math.floor(r() * (rec.out === 'kelp_wrap' ? 3 : 2));
      const price = (ITEMS[rec.out].price || 40) + 20 * Object.keys(rec.needs).length;
      st.list.push({ id: `${day}:${i}`, npc, dish: rec.out, n: count, coins: Math.round(price * count * 1.4 + 30), done: false });
    }
    return st.list;
  }
  line(o) { return (LINES[o.npc] || 'Could you make {dish}?').replace('{dish}', ITEMS[o.dish].name + (o.n > 1 ? ` (x${o.n})` : '')); }
  who(o) { return NPCS[o.npc]; }
  canDeliver(o) { return !o.done && this.g.itemCount(o.dish) >= o.n; }

  deliver(o) {
    const g = this.g; if (!this.canDeliver(o)) return false;
    g.addItem(o.dish, -o.n); o.done = true;
    const st = this.state; st.delivered++;
    g.state.coins += o.coins; g.state.stats.coinsEarned += o.coins; const rec = g.state.records; if (rec) rec.ordersDone++;
    const pearl = st.delivered % STEP === 0; if (pearl) g.grantItem('pearl', 1, true);
    (g.state.regard ||= {})[o.npc] = (g.state.regard[o.npc] || 0) + 1;
    g.audio.sfx('coin'); g.toast(`${NPCS[o.npc]?.name || 'They'} pays ${o.coins} coins`, '#ffd84a'); g.events.emit('order', o.npc);
    return true;
  }
  regard(npc) { return (this.g.state.regard || {})[npc] || 0; }
}
