// Game rules shared with the Unity build: inventory + crafting (Gameplay.Inventory/Recipes), survival stats
// (Gameplay.SurvivalStats) and the weather Markov chain with surface wetness / snow (Rendering.WeatherModel).
import { ITEMS, Kind, RECIPES, B } from '../shared/blocks.js';
import { mulberry32 } from '../shared/noise.js';

export const HOTBAR = 9, INV_SIZE = 36;
export const CREATIVE_HOTBAR = [B.Cobblestone, B.Stone, B.Dirt, B.Planks, B.Bricks, B.OakLog, B.OakLeaves, B.Sandstone, B.Torch];

export class Inventory {
  constructor() { this.slots = new Array(INV_SIZE).fill(null); this.selected = 0; this.onChange = null; }
  changed() { if (this.onChange) this.onChange(); }
  get held() { return this.slots[this.selected]; }
  get heldItem() { const s = this.held; return s ? ITEMS[s.item] : null; }

  /** Adds a stack; returns the count that did not fit. */
  add(item, count, extra) {
    const def = ITEMS[item];
    if (!def) return count;
    const max = def.stack;
    if (max > 1) for (let i = 0; i < INV_SIZE && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === item && s.count < max) { const n = Math.min(count, max - s.count); s.count += n; count -= n; }
    }
    for (let i = 0; i < INV_SIZE && count > 0; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(count, max);
      this.slots[i] = { item, count: n, ...(def.kind === Kind.Tool ? { wear: extra && extra.wear || 0 } : {}) };
      count -= n;
    }
    this.changed();
    return count;
  }
  count(item) { let n = 0; for (const s of this.slots) if (s && s.item === item) n += s.count; return n; }
  remove(item, count) {
    let removed = 0;
    for (let i = INV_SIZE - 1; i >= 0 && removed < count; i--) {
      const s = this.slots[i];
      if (!s || s.item !== item) continue;
      const n = Math.min(count - removed, s.count);
      s.count -= n; removed += n;
      if (s.count <= 0) this.slots[i] = null;
    }
    this.changed();
    return removed;
  }
  consumeHeld() {
    const s = this.held;
    if (!s) return false;
    if (--s.count <= 0) this.slots[this.selected] = null;
    this.changed();
    return true;
  }
  /** One use of the held tool. Returns true when it broke. */
  wearHeld() {
    const s = this.held, d = this.heldItem;
    if (!s || !d || d.kind !== Kind.Tool) return false;
    s.wear = (s.wear || 0) + 1;
    if (s.wear >= d.durability) { this.slots[this.selected] = null; this.changed(); return true; }
    this.changed();
    return false;
  }
  /** Swaps or merges slot a into slot b. */
  move(a, b) {
    if (a === b) return;
    const A = this.slots[a], Bs = this.slots[b];
    if (A && Bs && A.item === Bs.item && ITEMS[A.item].stack > 1) {
      const n = Math.min(A.count, ITEMS[A.item].stack - Bs.count);
      Bs.count += n; A.count -= n;
      if (A.count <= 0) this.slots[a] = null;
    } else { this.slots[a] = Bs; this.slots[b] = A; }
    this.changed();
  }
  clear() { this.slots.fill(null); this.changed(); }
  toJSON() { return { slots: this.slots, selected: this.selected }; }
  load(o) { this.slots = (o.slots || []).concat(new Array(INV_SIZE).fill(null)).slice(0, INV_SIZE); this.selected = o.selected || 0; this.changed(); }
}

export const canCraft = (inv, r) => r.inputs.every(([item, n]) => inv.count(item) >= n);
export function craft(inv, r) {
  if (!canCraft(inv, r)) return false;
  for (const [item, n] of r.inputs) inv.remove(item, n);
  const left = inv.add(r.out, r.count);
  return { left };
}
export { RECIPES };

// ---------------------------------------------------------------- survival

export const MAX_HEALTH = 20, MAX_HUNGER = 20, MAX_AIR = 10, SAFE_FALL = 3;

export class SurvivalStats {
  constructor() { this.reset(); this.onDamage = null; this.onDeath = null; }
  reset() { this.health = MAX_HEALTH; this.hunger = MAX_HUNGER; this.saturation = 5; this.exhaustion = 0; this.air = MAX_AIR; this.regen = this.starve = this.drown = 0; }
  get dead() { return this.health <= 0; }
  addExhaustion(a) {
    this.exhaustion += a;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else this.hunger = Math.max(0, this.hunger - 1);
    }
  }
  eat(food, sat) { this.hunger = Math.min(MAX_HUNGER, this.hunger + food); this.saturation = Math.min(this.hunger, this.saturation + sat); }
  damage(amount, cause) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.addExhaustion(0.1);
    if (this.onDamage) this.onDamage(amount, cause);
    if (this.dead && this.onDeath) this.onDeath(cause);
  }
  land(distance, water) { if (water) return; const d = Math.floor(distance - SAFE_FALL); if (d > 0) this.damage(d, 'fall'); }
  tick(dt, moved, sprinting, jumps, headUnder) {
    if (this.dead) return;
    this.addExhaustion(moved * (sprinting ? 0.1 : 0.01) + jumps * (sprinting ? 0.2 : 0.05) + dt * 0.005);
    if (headUnder) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) { this.drown += dt; while (this.drown >= 1) { this.drown -= 1; this.damage(2, 'drowning'); } }
    } else { this.air = Math.min(MAX_AIR, this.air + dt * 5); this.drown = 0; }
    if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regen += dt * (this.saturation > 0 ? 2 : 1);
      while (this.regen >= 4 && this.health < MAX_HEALTH) { this.regen -= 4; this.health = Math.min(MAX_HEALTH, this.health + 1); this.addExhaustion(6); }
    } else this.regen = 0;
    if (this.hunger <= 0) { this.starve += dt; while (this.starve >= 4) { this.starve -= 4; if (this.health > 1) this.damage(1, 'starvation'); } }
    else this.starve = 0;
  }
  toJSON() { return { health: this.health, hunger: this.hunger, saturation: this.saturation, air: this.air }; }
  load(o) {
    this.reset();
    this.health = Math.max(0, Math.min(MAX_HEALTH, o.health ?? MAX_HEALTH)); this.hunger = Math.max(0, Math.min(MAX_HUNGER, o.hunger ?? MAX_HUNGER));
    this.saturation = Math.min(this.hunger, o.saturation ?? 5); this.air = Math.min(MAX_AIR, o.air ?? MAX_AIR);
  }
}

// ---------------------------------------------------------------- weather

export const WEATHER_NAMES = ['Clear', 'Cloudy', 'Rain', 'Heavy rain', 'Storm', 'Fog'];
const P = (cloud, precip, fog, fogDist, wind, gust, light, lightning = 0) => ({ cloud, precip, fog, fogDist, wind, gust, light, lightning });
export const WEATHER_PRESETS = [
  P(0.42, 0, 1, 1, 0.07, 0.8, 1), P(0.72, 0, 1.4, 0.95, 0.1, 0.9, 0.8), P(0.9, 0.5, 2.2, 0.8, 0.13, 1, 0.55),
  P(1, 1, 3.2, 0.6, 0.18, 1, 0.4), P(1, 1, 3.5, 0.55, 0.32, 1, 0.3, 14), P(0.6, 0, 9, 0.3, 0.02, 0.3, 0.7),
];
const TRANSITIONS = [
  [0.30, 0.55, 0, 0, 0, 0.15], [0.35, 0.20, 0.35, 0, 0, 0.10], [0, 0.45, 0.20, 0.25, 0.10, 0],
  [0, 0.20, 0.50, 0, 0.30, 0], [0, 0, 0.50, 0.50, 0, 0], [0.50, 0.50, 0, 0, 0, 0],
];
const lerpP = (a, b, t) => { const o = {}; for (const k in a) o[k] = k === 'lightning' ? (t < 0.5 ? a[k] : b[k]) : a[k] + (b[k] - a[k]) * t; return o; };

export class Weather {
  constructor(seed, start = 0) {
    this.rng = mulberry32(seed ^ 0x5eed);
    this.current = start; this.params = { ...WEATHER_PRESETS[start] }; this.from = this.params;
    this.stateTime = 0; this.stateLength = this.nextLength(); this.blend = 1;
    this.wetness = 0; this.snowCover = 0; this.frozen = false;
    this.nextLightning = Infinity;
    this.windAngle = this.rng() * Math.PI * 2;
  }
  nextLength() { return 240 + this.rng() * 480; }
  force(kind) { this.from = this.params; this.current = kind; this.blend = 0; this.stateTime = 0; this.stateLength = this.nextLength(); this.nextLightning = this.drawLightning(); }
  drawLightning() { const iv = WEATHER_PRESETS[this.current].lightning; return iv > 0 ? -Math.log(1 - this.rng() * 0.999) * iv : Infinity; }
  /** Returns true when lightning strikes this step. cold: precipitation is snow here. sun 0..1. */
  step(dt, cold, sun) {
    if (!this.frozen) {
      this.stateTime += dt;
      if (this.stateTime >= this.stateLength) {
        const r = this.rng(); let acc = 0, next = this.current;
        for (let j = 0; j < 6; j++) { acc += TRANSITIONS[this.current][j]; if (r < acc) { next = j; break; } }
        this.force(next);
      }
    }
    this.blend = Math.min(1, this.blend + dt / 60);
    const t = this.blend * this.blend * (3 - 2 * this.blend);
    this.params = lerpP(this.from, WEATHER_PRESETS[this.current], t);
    const rain = cold ? 0 : this.params.precip, snow = cold ? this.params.precip : 0;
    this.wetness = rain > 0.05 ? Math.min(1, this.wetness + dt * rain / 60) : Math.max(0, this.wetness - dt * (0.2 + 0.8 * sun) / 240);
    this.snowCover = snow > 0.05 ? Math.min(1, this.snowCover + dt * snow / 90) : Math.max(0, this.snowCover - dt * (0.1 + 0.9 * sun) / 300);
    this.windAngle += dt * 0.01 * (this.rng() - 0.5);
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) { this.nextLightning = this.drawLightning(); return this.params.lightning > 0; }
    return false;
  }
  toJSON() { return { current: this.current, stateTime: this.stateTime, stateLength: this.stateLength, wetness: this.wetness, snowCover: this.snowCover }; }
  load(o) {
    this.current = o.current || 0; this.params = { ...WEATHER_PRESETS[this.current] }; this.from = this.params; this.blend = 1;
    this.stateTime = o.stateTime || 0; this.stateLength = o.stateLength || this.nextLength(); this.wetness = o.wetness || 0; this.snowCover = o.snowCover || 0;
    this.nextLightning = this.drawLightning();
  }
}
