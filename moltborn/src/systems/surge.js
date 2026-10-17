// Tidal surges: now and then, in the open realms, the sea heaves. A warning rumbles through the water, then for a while
// every current in the zone runs one way (pushing the swimmer, streaking the picture with silt and bubbles), and when it
// passes it leaves flotsam on the floor near where the swimmer stands: coins, ingredients and the odd ball of bait.
//
// Surges never start inside rifts, the gauntlet, boss fights or cutscenes, and they can be turned off in Options.
import { setting } from './settings.js';
import { FORAGE } from '../data/forage.js';
import { rng } from '../core/util.js';
import { TS, isSolid } from '../world/tiles.js';

export const SURGE = {
  first: [70, 130],          // seconds of play in a realm before the first surge can come
  gap: [170, 300],           // seconds between surges
  warn: 6,                   // seconds of rumbling before it hits
  length: 14,                // seconds the currents run
  force: 150,                // current strength: swimming drag eats most of it, so this is a firm shove, not a fling
  flotsam: [5, 9],           // pieces left behind
  realms: ['reef', 'forest', 'kingdom', 'graveyard', 'domain'],
};

export const inRange = (r, x) => r[0] + (r[1] - r[0]) * x;

// what washes up: a mix of coins, ingredients from the realm's forage patches, and bait
export function rollFlotsam(r, biome, n) {
  const kinds = FORAGE[biome] || [], pieces = [];
  for (let i = 0; i < n; i++) {
    const roll = r();
    if (roll < 0.58 || !kinds.length) pieces.push({ type: 'coin', value: r() < 0.25 ? 5 : 1 });
    else if (roll < 0.9) {
      const kind = kinds[Math.floor(r() * kinds.length)], pool = kind.yield.flatMap(([id, w]) => Array(w).fill(id));
      pieces.push({ type: 'item', id: pool[Math.floor(r() * pool.length)] });
    } else pieces.push({ type: 'item', id: r() < 0.7 ? 'bait_kelp' : 'bait_glow' });
  }
  return pieces;
}

export class Surge {
  constructor(game) {
    this.g = game; game.systems.surge = this;
    this.state = 'idle'; this.t = 0; this.next = inRange(SURGE.first, 0.5); this.dir = 1; this.area = null; this.r = rng(Date.now() % 100000);
    game.events.on('zone', () => this.reset());
  }

  // a new zone: cancel anything in flight and start the countdown again
  reset() {
    this.state = 'idle'; this.t = 0; this.area = null; this.next = inRange(SURGE.first, this.r());
  }

  // can a surge happen here and now?
  allowed() {
    const g = this.g, w = g.world; if (!w || !setting(g, 'surges')) return false;
    if (w.zone.rift || w.zone.arena || String(w.zone.id).includes(':')) return false;
    if (!SURGE.realms.includes(w.zone.biome) || w.zone.safe) return false;
    if (w.cinematic || (w.boss && (w.boss.engaged || w.boss.engaging)) || !w.player.alive) return false;
    return true;
  }

  update(dt) {
    const g = this.g, w = g.world; if (!w) return;
    if (this.state === 'idle') {
      if (!this.allowed()) return;
      this.next -= dt; if (this.next <= 0) this.begin();
      return;
    }
    if (!this.allowed() && this.state !== 'wake') { this.reset(); return; }
    this.t += dt;
    if (this.state === 'warn' && this.t >= SURGE.warn) this.rush();
    else if (this.state === 'rush') {
      if (this.t >= SURGE.length) this.calm();
      else if (Math.random() < dt * 1.5) w.shake(1.2);
    } else if (this.state === 'wake' && this.t >= 5) this.reset();
  }

  begin() {
    const g = this.g, w = g.world; this.state = 'warn'; this.t = 0; this.dir = this.r() < 0.5 ? -1 : 1;
    g.toast('The water draws back... a surge is coming.', '#9ad8ff'); w.shake(2); w.fx.ring(w.player.x, w.player.y, 6, 70, 0.8, '#9ad8ff', 2);
    g.events.emit('surge', 'warn');
  }
  rush() {
    const g = this.g, w = g.world, z = w.zone; this.state = 'rush'; this.t = 0;
    this.area = { kind: 'current', x: 0, y: 0, w: z.w * TS, h: z.h * TS, vx: this.dir * SURGE.force, vy: 0, ttl: SURGE.length + 0.5 };
    z.areas.push(this.area); w.shake(3); w.sky?.force('surge', { dir: this.dir });
    g.toast(this.dir > 0 ? 'The surge pours east.' : 'The surge pours west.', '#cfeeff'); g.events.emit('surge', 'rush');
  }
  calm() {
    const g = this.g, w = g.world; this.state = 'wake'; this.t = 0;
    const i = w.zone.areas.indexOf(this.area); if (i >= 0) w.zone.areas.splice(i, 1); this.area = null;
    const n = Math.round(inRange(SURGE.flotsam, this.r())), pieces = rollFlotsam(this.r, w.zone.biome, n);
    this.leave(pieces); g.toast('The surge passes. Flotsam litters the floor.', '#ffe9a8'); g.events.emit('surge', 'calm');
    if (g.state.records) g.state.records.surges = (g.state.records.surges || 0) + 1;
  }

  // drop the pieces along the floor within a short swim of the player
  leave(pieces) {
    const w = this.g.world, p = w.player;
    for (const piece of pieces) {
      const x = p.x + (this.r() - 0.5) * 360, y = this.floorBelow(x, p.y); if (y === null) continue;
      const o = { x, y: y - 6, vx: 0, vy: -20, delay: 0.2, life: 90 };
      w.addPickup(piece.type === 'coin' ? { ...o, kind: 'coin', value: piece.value } : { ...o, kind: 'item', id: piece.id });
      w.fx.burst(x, y - 6, ['#ffffff', '#cfeeff'], 40, 0.4, 1);
    }
  }
  // the first floor tile under (x, fromY), or null if the column is solid or has no floor within a short fall
  floorBelow(x, fromY) {
    const g = this.g.world.grid, tx = Math.floor(x / TS); let ty = Math.floor(fromY / TS);
    if (isSolid(g.get(tx, ty))) return null;
    for (let k = 0; k < 14; k++, ty++) if (isSolid(g.get(tx, ty + 1))) return (ty + 1) * TS;
    return null;
  }
}
