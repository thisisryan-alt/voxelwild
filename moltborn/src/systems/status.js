// Timed status effects shared by the player and every enemy: burning, bleeding, chill, frailty, and the buffs
// that food, abilities and relics grant. A StatusSet hangs off an owner (Player or Enemy) and answers questions
// like "how much faster am I?" through mult(key), so combat code never has to know which effect is active.
//
// owner hooks (all optional):
//   statusResist(id)   -> multiplier on the duration of a harmful effect (bosses shrug off crowd control)
//   immune(id)         -> true to refuse an effect outright
//   statusTick(def, s) -> called once per tick; the set computes damage / healing via dotDamage / hotHeal
//   onStatusApplied(id, s) / onStatusEnd(id, s)
import { clamp } from '../core/util.js';

export const STATUS = {
  burn: {
    name: 'Burning', color: '#ff8a3a', harmful: true, dur: 4, tick: 0.5, maxStacks: 3, dot: 1.1,
    desc: 'Takes fire damage every half second.',
  },
  bleed: {
    name: 'Bleeding', color: '#e0304a', harmful: true, dur: 5, tick: 1, maxStacks: 3, dot: 1.6,
    desc: 'Loses blood steadily; heavy hits worsen it.',
  },
  chill: {
    name: 'Chilled', color: '#8ad0ff', harmful: true, dur: 3, mods: { speed: 0.65, atkSpeed: 0.82 }, cc: true,
    desc: 'Slowed to a crawl.',
  },
  frail: {
    name: 'Frail', color: '#d8a0ff', harmful: true, dur: 5, mods: { dmgIn: 1.25 }, cc: true,
    desc: 'Takes 25% more damage.',
  },
  weaken: {
    name: 'Weakened', color: '#b0a890', harmful: true, dur: 5, mods: { dmgOut: 0.75 }, cc: true,
    desc: 'Deals 25% less damage.',
  },
  regen: {
    name: 'Regeneration', color: '#7aff9a', dur: 20, tick: 1, hot: 0.022,
    desc: 'Recovers health every second.',
  },
  haste: {
    name: 'Haste', color: '#ffe65a', dur: 20, mods: { speed: 1.18, atkSpeed: 1.15 },
    desc: 'Swim and strike faster.',
  },
  might: {
    name: 'Might', color: '#ff7a5a', dur: 30, mods: { dmgOut: 1.2 },
    desc: 'Deals 20% more damage.',
  },
  ward: {
    name: 'Ward', color: '#9ad8ff', dur: 30, mods: { dmgIn: 0.78 },
    desc: 'Takes 22% less damage.',
  },
  focus: {
    name: 'Focus', color: '#6ab0ff', dur: 30, mods: { tideRegen: 1.8 },
    desc: 'Tide regenerates much faster.',
  },
  fortune: {
    name: 'Fortune', color: '#ffd84a', dur: 60, mods: { coin: 1.5 },
    desc: 'Coins from foes are 50% richer.',
  },
  baited: {
    name: 'Baited', color: '#7ad8ff', dur: 240, mods: {}, maxStacks: 1,
    desc: 'Something smells good on your line: rarer fish rise to it.',
  },
  sunlit: {
    name: 'Sunlit', color: '#ffe08a', dur: 1e6, mods: { tideRegen: 1.12 }, passive: true,
    desc: 'Warm shallows: Tide regenerates 12% faster.',
  },
  moonlit: {
    name: 'Moonlit', color: '#9ab0ff', dur: 1e6, mods: { speed: 1.04 }, passive: true,
    desc: 'Night swimming: a little faster. Foes are warier; experience is richer.',
  },
  ember: {
    name: 'Emberskin', color: '#ff9a3a', dur: 30, mods: { heat: 0.4, dmgOut: 1.08 },
    desc: 'Vent plumes hurt less and your blows burn hotter.',
  },
};
export const BUFFS = Object.keys(STATUS).filter((k) => !STATUS[k].harmful);
export const DEBUFFS = Object.keys(STATUS).filter((k) => STATUS[k].harmful);

// the damage one tick of a damage-over-time effect deals, scaled to what it is burning
export function dotDamage(owner, def, s) {
  const per = def.dot * s.power * (0.75 + s.stacks * 0.25);
  if (owner.stats && owner.stats.maxHp) return Math.max(1, Math.round(owner.stats.maxHp * 0.0085 * per * 2));  // the player
  const hp = owner.maxHp || 20, boss = owner.def?.boss;
  return Math.max(1, Math.round(hp * (boss ? 0.0035 : 0.018) * per * 1.5));
}
export function hotHeal(owner, def, s) {
  const mx = owner.stats ? owner.stats.maxHp : owner.maxHp;
  return Math.max(1, Math.round(mx * def.hot * s.power));
}

export class StatusSet {
  constructor(owner) { this.owner = owner; this.list = new Map(); this.version = 0; }

  get size() { return this.list.size; }
  has(id) { return this.list.has(id); }
  get(id) { return this.list.get(id) || null; }
  ids() { return [...this.list.keys()]; }
  // sorted for display: buffs first, then by time left
  entries() {
    return [...this.list.values()].sort((a, b) => (STATUS[a.id].harmful ? 1 : 0) - (STATUS[b.id].harmful ? 1 : 0) || b.t - a.t);
  }

  apply(id, o = {}) {
    const def = STATUS[id]; if (!def) return false;
    const owner = this.owner;
    if (def.harmful && owner.immune?.(id)) return false;
    let dur = (o.dur ?? def.dur) * (def.harmful ? (owner.statusResist?.(id) ?? 1) : 1);
    if (dur <= 0.05) return false;
    const cur = this.list.get(id);
    if (cur) {
      cur.t = Math.max(cur.t, dur); cur.max = Math.max(cur.max, cur.t);
      cur.power = Math.max(cur.power, o.power ?? 1);
      if (def.maxStacks > 1) cur.stacks = Math.min(def.maxStacks, cur.stacks + 1);
    } else {
      const s = { id, t: dur, max: dur, power: o.power ?? 1, stacks: 1, acc: 0, src: o.src || null, age: 0 };
      this.list.set(id, s); owner.onStatusApplied?.(id, s);
    }
    this.version++;
    return true;
  }
  remove(id) { const s = this.list.get(id); if (!s) return false; this.list.delete(id); this.owner.onStatusEnd?.(id, s); this.version++; return true; }
  clear(harmfulOnly = false) { for (const id of this.ids()) if (!harmfulOnly || STATUS[id].harmful) this.remove(id); }
  // cleanse: remove up to n harmful effects
  cleanse(n = 99) { let c = 0; for (const id of this.ids()) { if (c >= n) break; if (STATUS[id].harmful && this.remove(id)) c++; } return c; }

  // multiplicative modifier from every active effect, e.g. mult('speed') -> 0.65 while chilled
  mult(key) {
    let m = 1;
    for (const s of this.list.values()) { const v = STATUS[s.id].mods?.[key]; if (v !== undefined) m *= v; }
    return m;
  }
  update(dt) {
    if (!this.list.size) return;
    const owner = this.owner;
    for (const s of [...this.list.values()]) {
      const def = STATUS[s.id];
      s.t -= dt; s.age += dt;
      if (def.tick) {
        s.acc += dt;
        while (s.acc >= def.tick) {
          s.acc -= def.tick;
          if (def.dot) { const n = dotDamage(owner, def, s); owner.hurtDot?.(n, s.id, def.color); if (owner.alive === false || owner.dying) break; }
          else if (def.hot) owner.heal?.(hotHeal(owner, def, s));
          owner.statusTick?.(def, s);
        }
      }
      if (s.t <= 0 || owner.alive === false) { this.list.delete(s.id); owner.onStatusEnd?.(s.id, s); this.version++; }
    }
  }
}

// ---- icons: 7x7 pixel maps, tinted per status -------------------------------------------------------------------------
const MAPS = {
  burn:   ['...#...', '..##...', '..###..', '.#####.', '.#####.', '.#####.', '..###..'],
  bleed:  ['...#...', '..###..', '..###..', '.#####.', '.#####.', '.#####.', '..###..'],
  chill:  ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  frail:  ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  weaken: ['.#####.', '#.....#', '#.###.#', '#.#.#.#', '#.###.#', '#.....#', '.#####.'],
  regen:  ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'],
  haste:  ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  might:  ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
  ward:   ['#######', '#.....#', '#.....#', '#.....#', '.#...#.', '..#.#..', '...#...'],
  focus:  ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  fortune:['..###..', '.#####.', '###.###', '###.###', '.#####.', '..###..', '.......'],
  baited: ['...#...', '...#...', '...#...', '...#...', '#..#..#', '.#.#.#.', '..###..'],
  sunlit: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  moonlit: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##..#.', '..###..'],
  ember:  ['..#.#..', '.#####.', '#######', '#######', '.#####.', '..###..', '...#...'],
};
const iconCache = new Map();
export function statusIcon(id, scale = 1) {
  const key = id + '@' + scale; let c = iconCache.get(key); if (c) return c;
  const map = MAPS[id] || MAPS.might, col = STATUS[id]?.color || '#ffffff';
  c = document.createElement('canvas'); c.width = 9 * scale; c.height = 9 * scale; const g = c.getContext('2d');
  g.fillStyle = '#05030a'; for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (map[y][x] === '#') { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillRect((x + 1 + dx) * scale, (y + 1 + dy) * scale, scale, scale); }
  g.fillStyle = col; for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (map[y][x] === '#') g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
  g.fillStyle = 'rgba(255,255,255,0.55)'; for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (map[y][x] === '#' && (y === 0 || map[y - 1][x] !== '#')) g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
  iconCache.set(key, c); return c;
}

// Convert an ability / hit `status` object ({burn: 3, chill: 2, ...}) into applied effects on a StatusSet.
export const HIT_STATUS_KEYS = ['burn', 'bleed', 'chill', 'frail', 'weaken'];
export function applyHitStatuses(set, status, src = null) {
  if (!status) return;
  for (const k of HIT_STATUS_KEYS) {
    const v = status[k]; if (!v) continue;
    set.apply(k, { power: clamp(typeof v === 'number' ? v : 1, 0.5, 6), src });
  }
}
