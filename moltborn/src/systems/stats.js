// Lifetime statistics ("records"): what the player has done, kept in the save so the Trophy page, the Bestiary and
// the achievement system can all read the same numbers. The tracker only listens to game events; nothing in combat
// or movement depends on it, so it can never change how the game plays.
import { ZONE_INFO } from '../data/zoneinfo.js';
import { DIFFICULTIES } from './settings.js';
import { activeSets } from '../data/sets.js';

export function newRecords() {
  return {
    kills: {}, killsByForm: {}, dmgDealt: 0, dmgTaken: 0, hits: 0, crits: 0, bestHit: 0, bestCombo: 0,
    dashes: 0, strokes: 0, distance: 0, swim: 0, ground: 0, chests: 0, rests: 0, pearls: 0,
    deathsBy: {}, deathsIn: {}, zoneTime: {}, biomeTime: {}, zoneVisits: {},
    bossStart: null, bossHits: 0, bossBest: {}, flawless: {}, bossTries: {},
    burned: 0, chilled: 0, bled: 0, healed: 0, healsUsed: 0, crafted: 0, craftedBy: {}, eaten: {},
    rifts: 0, riftBest: 0, riftTime: 0, arenaBest: 0, arenaKills: 0, photos: 0, travels: 0, coinsSpent: 0, maxCoins: 0,
    buffPeak: 0, sessions: 1, hardest: -1, forage: 0, ordersDone: 0, elites: 0, champions: 0, affixKills: {}, setsSeen: {}, relicPeak: 0,
  };
}

// fill in any keys an older save lacks without touching what it already has
export function ensureRecords(state) {
  const fresh = newRecords();
  state.records = Object.assign(fresh, state.records || {});
  for (const k of Object.keys(fresh)) if (state.records[k] === undefined) state.records[k] = fresh[k];
  state.trophies = state.trophies || {};
  return state.records;
}

export class Stats {
  constructor(game) {
    this.g = game; game.systems.stats = this;
    this.px = null; this.py = null; this.accT = 0;
    const ev = game.events;
    ev.on('kill', (type, e) => this.onKill(type, e));
    ev.on('hitdealt', (e, dmg, crit) => this.onHit(e, dmg, crit));
    ev.on('hurt', (n, src) => this.onHurt(n, src));
    ev.on('dash', () => { this.r.dashes++; });
    ev.on('stroke', () => { this.r.strokes++; });
    ev.on('chest', () => { this.r.chests++; });
    ev.on('rest', () => { this.r.rests++; });
    ev.on('playerdied', (src) => this.onDeath(src));
    ev.on('bossengage', (key) => this.onBossEngage(key));
    ev.on('boss', (key) => this.onBossDown(key));
    ev.on('zone', (id) => { this.r.zoneVisits[id] = (this.r.zoneVisits[id] || 0) + 1; this.px = null; });
    ev.on('statusapplied', (e, id) => { if (e === this.g.world?.player) return; if (id === 'burn') this.r.burned++; else if (id === 'chill') this.r.chilled++; else if (id === 'bleed') this.r.bled++; });
    ev.on('gotitem', (id) => { if (id === 'pearl' || id === 'black_pearl') this.r.pearls++; });
    ev.on('relic', () => { this.r.relicPeak = Math.max(this.r.relicPeak, this.g.state.riftRelics?.length || 0); });
  }
  get r() { return this.g.state.records || ensureRecords(this.g.state); }

  // called every play frame
  update(dt) {
    const w = this.g.world, p = w?.player; if (!p || !p.alive) return;
    const r = this.r;
    if (this.px !== null) {
      const d = Math.hypot(p.x - this.px, p.y - this.py);
      if (d < 40) { r.distance += d; if (p.onGround) r.ground += d; else r.swim += d; }
    }
    this.px = p.x; this.py = p.y;
    const z = w.zone.id, b = w.zone.biome;
    r.zoneTime[z] = (r.zoneTime[z] || 0) + dt; r.biomeTime[b] = (r.biomeTime[b] || 0) + dt;
    this.accT += dt;
    if (this.accT > 1) { this.accT = 0; for (const a of activeSets(this.g.state.equip)) if (a.count >= 3) r.setsSeen[a.id] = true; r.maxCoins = Math.max(r.maxCoins, this.g.state.coins); r.bestCombo = Math.max(r.bestCombo, p.comboBest || 0); r.buffPeak = Math.max(r.buffPeak, p.status.size); }
  }

  onKill(type, e) {
    const r = this.r; r.kills[type] = (r.kills[type] || 0) + 1;
    const f = this.g.state.form; r.killsByForm[f] = (r.killsByForm[f] || 0) + 1;
    const arena = this.g.world?.zone?.arena; if (arena) r.arenaKills++;
    if (e?.affixes) { r.elites++; for (const id of e.affixes) r.affixKills[id] = (r.affixKills[id] || 0) + 1; if (e.champion) r.champions++; }
  }
  onHit(e, dmg, crit) {
    const r = this.r; r.hits++; r.dmgDealt += Math.round(dmg); if (crit) r.crits++; if (dmg > r.bestHit) r.bestHit = Math.round(dmg);
    if (this.g.world?.boss?.engaged) { /* boss damage is counted in dmgDealt like any other */ }
  }
  onHurt(n, src) {
    const r = this.r; r.dmgTaken += n;
    if (this.g.world?.boss?.engaged) r.bossHits++;
    this.lastSource = src?.source?.type || src?.source?.def?.name || (src?.spike ? 'hazard' : src?.field ? 'cloud' : src?.thorn ? 'thorns' : this.lastSource);
    if (src?.source?.type) this.lastSource = src.source.type;
  }
  onDeath(src) {
    const r = this.r, key = (src && (src.type || src.name)) || this.lastSource || 'the tide';
    r.deathsBy[key] = (r.deathsBy[key] || 0) + 1;
    const z = this.g.world?.zone?.id; if (z) r.deathsIn[z] = (r.deathsIn[z] || 0) + 1;
  }
  onBossEngage(key) {
    const r = this.r; r.bossStart = { key, t: this.g.state.playtime, hits: r.bossHits };
    r.bossTries[key] = (r.bossTries[key] || 0) + 1;
  }
  onBossDown(key) {
    const r = this.r, b = r.bossStart; if (!b || b.key !== key) return;
    const secs = Math.max(1, Math.round(this.g.state.playtime - b.t));
    if (!r.bossBest[key] || secs < r.bossBest[key]) r.bossBest[key] = secs;
    if (r.bossHits === b.hits) r.flawless[key] = true;
    r.hardest = Math.max(r.hardest, DIFFICULTIES.indexOf(this.g.state.settings.difficulty || 'tide'));
    r.bossStart = null;
  }

  // ---- queries for the UI ----------------------------------------------------------------------------------------------
  totalKills() { return Object.values(this.r.kills).reduce((a, b) => a + b, 0); }
  killsOf(type) { return this.r.kills[type] || 0; }
  favouriteBiome() {
    const t = this.r.biomeTime; let best = null; for (const [k, v] of Object.entries(t)) if (!best || v > t[best]) best = k; return best;
  }
  deadliest() {
    const d = this.r.deathsBy; let best = null; for (const [k, v] of Object.entries(d)) if (!best || v > d[best]) best = k; return best;
  }
  zonesSeen() { return Object.keys(this.g.state.visited).filter((z) => ZONE_INFO[z]).length; }
  summary() {
    const r = this.r, s = this.g.state;
    return [
      ['Foes defeated', this.totalKills()], ['Damage dealt', Math.round(r.dmgDealt)], ['Damage taken', Math.round(r.dmgTaken)],
      ['Best single hit', r.bestHit], ['Longest combo', Math.max(r.bestCombo, s.stats.comboBest || 0)], ['Critical hits', r.crits],
      ['Parries', s.stats.parries || 0], ['Dashes', r.dashes], ['Distance travelled', Math.round(r.distance / 16) + ' tiles'],
      ['Chests opened', r.chests], ['Times rested', r.rests], ['Times fallen', s.stats.deaths || 0],
    ];
  }
}
