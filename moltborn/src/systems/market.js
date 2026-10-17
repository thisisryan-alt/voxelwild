// Selling: some people buy what the swimmer catches and gathers. A buyer lists what it wants and how much of an item's
// base value it pays; the hour of the day nudges the price (merchants pay more at dusk, via the clock's coin multiplier).
// Nothing here knows about screens: the sell scene and dialogue call sellable(), price() and sell().
import { ITEMS } from '../data/items.js';
import { FISH_BY_ID } from '../data/fish.js';

export const BUYERS = {
  // the fishmonger pays full price for fish, a little for anything cooked or gathered
  tunny: { name: 'Old Tunny', fish: 1.0, types: { ingredient: 0.4, dish: 0.5 }, greeting: 'What have you got for me?' },
  // the board-keeper takes odds and ends
  marlin: { name: 'Marlin', fish: 0.7, types: { ingredient: 0.5 }, greeting: 'Surplus? I love surplus.' },
};

const baseValue = (id) => { const it = ITEMS[id]; if (!it) return 0; if (it.fish) return FISH_BY_ID[it.fish]?.value ?? Math.round((it.price || 0) / 0.6); return it.price || 0; };

export class Market {
  constructor(game) { this.g = game; game.systems.market = this; }
  rate(buyer, id) { const B = BUYERS[buyer], it = ITEMS[id]; if (!B || !it) return 0; if (it.fish) return B.fish; return B.types[it.type] || 0; }
  hour() { const c = this.g.systems.clock?.mult(); return c ? c.coin : 1; }
  // coins for one item (never zero for something the buyer wants)
  price(buyer, id) { const r = this.rate(buyer, id); if (!r) return 0; return Math.max(1, Math.round(baseValue(id) * r * this.hour())); }
  // inventory entries this buyer will take, best price first
  sellable(buyer) {
    const inv = this.g.state.inv, out = [];
    for (const [id, n] of Object.entries(inv)) { if (n > 0 && this.rate(buyer, id) > 0) out.push({ id, n, price: this.price(buyer, id) }); }
    return out.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  }
  // sell up to n of an item; returns coins earned
  sell(buyer, id, n = 1) {
    const g = this.g, have = g.itemCount(id), p = this.price(buyer, id); n = Math.min(n, have); if (n <= 0 || !p) return 0;
    const total = p * n; g.addItem(id, -n); g.state.coins += total; g.state.stats.coinsEarned += total;
    const rec = g.state.records; rec.sold = (rec.sold || 0) + n; if (ITEMS[id].fish) rec.fishSold = (rec.fishSold || 0) + n; rec.soldCoins = (rec.soldCoins || 0) + total;
    g.events.emit('sold', id, n, total); return total;
  }
  // everything sellable at once
  sellAll(buyer) { let t = 0; for (const e of this.sellable(buyer)) t += this.sell(buyer, e.id, e.n); return t; }
}
