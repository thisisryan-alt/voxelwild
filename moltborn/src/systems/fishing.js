// Fishing: which fish bite where and when, how big they are, and the reeling game itself. The game is a plain class with no
// drawing (so it can be tested to the frame): a catch zone you lift by holding a button and let fall by releasing it, a fish
// that darts about, and a meter that fills while the fish is inside the zone and drains while it is not.
import { FISH, FISH_BY_ID, RARITY, SPOT_COOLDOWN } from '../data/fish.js';
import { rng, clamp } from '../core/util.js';

// the weighted catch for a place and an hour; `luck` shifts weight from common fish to rare ones
export function candidates(biome, phase) { return FISH.filter((f) => f.biomes.includes(biome) && (!f.phases || f.phases.includes(phase))); }
export function rollFish(r, biome, phase, luck = 0, boost = null) {
  const pool = candidates(biome, phase); if (!pool.length) return null;
  const w = pool.map((f) => { const R = RARITY[f.rarity]; return R.weight * (f.rarity === 'common' ? Math.max(0.3, 1 - luck) : 1 + luck * 1.5) * (boost && boost.fish === f.id ? boost.mult : 1); });
  let x = r() * w.reduce((a, b) => a + b, 0), i = 0; for (; i < pool.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
  return pool[i];
}
// length in cm: skewed small, with an occasional whopper
export function rollLength(r, fish) { const [lo, hi] = fish.len, t = Math.pow(r(), 1.6), big = r() < 0.06 ? 0.2 : 0; return Math.round(lo + (hi - lo) * clamp(t + big, 0, 1)); }
export const isBig = (fish, len) => len >= fish.len[0] + (fish.len[1] - fish.len[0]) * 0.85;

// special spots favour one fish: the Moonpool makes the Moon Koi six times likelier (it still only rises at night)
export const SPOT_BOOSTS = { moon: { fish: 'moon_koi', mult: 6 } };

// ---- the reeling game ------------------------------------------------------------------------------------------------------------------------------------
export class Reel {
  // skill widens the catch zone a little (from level and gear); seed makes a fight repeatable
  constructor(fish, skill = 0, seed = 1) {
    const f = fish.fight, R = RARITY[fish.rarity];
    this.fish = fish; this.r = rng(seed); this.f = f;
    this.zoneH = clamp(0.3 - (f.speed - 0.8) * 0.12 + skill * 0.1, 0.14, 0.42);       // fraction of the bar
    this.zone = 0.4; this.vel = 0; this.pos = 0.5; this.target = 0.5; this.retarget = 0; this.t = 0;
    this.progress = 0.25; this.state = 'play'; this.hold = 0; this.inZoneT = 0; this.rarity = R;
  }
  // advance by dt seconds; `hold` is true while the button is down
  step(dt, hold) {
    if (this.state !== 'play') return this.state;
    this.t += dt; const f = this.f;
    // the zone: held lifts it, released lets it fall, bouncing softly off the ends
    this.vel += (hold ? 1.5 : -1.3) * dt * 2.4; this.vel *= Math.exp(-2.2 * dt); this.zone += this.vel * dt;
    const lo = 0, hi = 1 - this.zoneH; if (this.zone < lo) { this.zone = lo; this.vel = Math.abs(this.vel) * 0.35; } if (this.zone > hi) { this.zone = hi; this.vel = -Math.abs(this.vel) * 0.35; }
    // the fish: picks a new spot every so often and darts toward it, with a wobble
    this.retarget -= dt; if (this.retarget <= 0) { this.retarget = 0.5 + this.r() * (1.6 - f.erratic); this.target = clamp(this.pos + (this.r() - 0.5) * (0.5 + f.erratic), 0.04, 0.96); }
    this.pos += clamp(this.target - this.pos, -1, 1) * f.speed * dt * 2.2 + Math.sin(this.t * (3 + f.erratic * 5)) * 0.004 * f.erratic;
    this.pos = clamp(this.pos, 0.02, 0.98);
    const inside = this.pos >= this.zone && this.pos <= this.zone + this.zoneH; this.inside = inside;
    this.progress += (inside ? 0.2 : -f.drain) * dt; this.inZoneT += inside ? dt : 0;
    if (this.progress >= 1) { this.progress = 1; this.state = 'won'; } else if (this.progress <= 0) { this.progress = 0; this.state = 'lost'; }
    return this.state;
  }
}

// ---- the system: log of what was caught, spot cooldowns -------------------------------------------------------------------------------------------
export class Fishing {
  constructor(game) { this.g = game; game.systems.fishing = this; }
  get log() { const s = this.g.state; return s.fish || (s.fish = { total: 0, species: {} }); }
  luck() { const g = this.g, st = g.state; return clamp((st.level || 1) / 60 + Math.min(0.15, (this.log.total || 0) / 400) + (g.world?.player?.stats?.fishLuck || 0), 0, 0.55); }
  skill() { return clamp((this.g.state.level || 1) / 40, 0, 0.6); }
  phase() { return this.g.systems.clock?.phase.id || 'day'; }

  // choose the fish for a spot; `salt` makes every cast different but a given cast repeatable
  pick(spot, salt) {
    const r = rng(Math.floor(this.g.state.playtime * 13) + (spot?.seed || 0) + salt * 101), biome = this.g.world.zone.biome;
    const fish = rollFish(r, biome, this.phase(), this.luck(), SPOT_BOOSTS[spot?.boost] || null); if (!fish) return null;
    return { fish, len: rollLength(r, fish), seed: Math.floor(r() * 1e6) };
  }

  landed(c) {
    const g = this.g, L = this.log, f = c.fish, e = L.species[f.id] || (L.species[f.id] = { n: 0, best: 0, first: g.state.playtime });
    const fresh = e.n === 0, record = c.len > e.best; e.n++; if (record) e.best = c.len; L.total++;
    g.grantItem('fish_' + f.id, 1, true); const rec = g.state.records; rec.fished = (rec.fished || 0) + 1;
    if (f.rarity === 'legendary') rec.legendFish = (rec.legendFish || 0) + 1;
    g.events.emit('fish', f.id, c.len, { fresh, record, big: isBig(f, c.len) });
    return { fresh, record, big: isBig(f, c.len), value: f.value };
  }
  speciesCaught() { return Object.keys(this.log.species).length; }
  // spots recover with play time, like forage patches
  ready(zs, key) { return this.g.state.playtime >= ((zs.fishing || {})[key] || 0); }
  cool(zs, key, mult = 1) { (zs.fishing ||= {})[key] = this.g.state.playtime + SPOT_COOLDOWN * mult; }
  bySpecies(id) { return FISH_BY_ID[id]; }
}
