// Tidal Rifts: a run of procedurally built chambers reached from a Tide Board. Each depth must be cleared to open the way
// on; between depths the player chooses a relic that lasts for the run. Foes grow tougher with depth, modifiers ("tides")
// twist individual depths, and the final chamber holds a champion. A run ends in victory at the last depth or in defeat,
// and either way pays out according to how deep it got.
import { RELICS, RELIC_IDS, RARITY, RIFT_MODS, RIFT_MOD_IDS, RIFT_TIERS } from '../data/relics.js';
import { riftId, parseId, setRiftThemes, THEME_ORDER, today } from '../world/rift_gen.js';
import { RelicScene } from '../ui/relic_scene.js';
import { RiftSummary } from '../ui/board_scene.js';
import { ZONE_INFO } from '../data/zoneinfo.js';
import { INGREDIENT_IDS } from '../data/items_craft.js';
import { rng } from '../core/util.js';

export const isRiftZone = (id) => typeof id === 'string' && id.startsWith('rift:');
export { today };

export class Rifts {
  constructor(game) {
    this.g = game; game.systems.rifts = this; this.run = null; this.warnT = 0; this.checkT = 0; this.summary = null; this.timers = [];
    const ev = game.events;
    ev.on('hitdealt', (e, dmg) => this.has('leech_tooth') && this.g.world?.player.heal(Math.max(1, Math.round(dmg * 0.04))));
    ev.on('hurt', (n, src, blocked) => { if (!blocked && this.has('adrenal_gland')) this.g.world?.player.status.apply('haste', { dur: 4 }); });
    ev.on('kill', (type, e) => { if (this.run) this.run.kills++; if (this.has('shock_nova') && Math.random() < 0.25) this.nova(e); });
  }
  get active() { return !!this.run; }
  has(id) { return !!this.g.state.riftRelics?.includes(id); }
  relics() { return this.g.state.riftRelics || (this.g.state.riftRelics = []); }

  // ---- what the player may attempt -------------------------------------------------------------------------------------------------------------
  unlockedThemes() {
    const seen = this.g.state.visited, out = [];
    for (const t of THEME_ORDER) if (Object.keys(ZONE_INFO).some((z) => ZONE_INFO[z].biome === t && seen[z])) out.push(t);
    return out.length ? out : ['reef'];
  }
  tiers() { return RIFT_TIERS.map((t) => ({ ...t, open: !t.needs || !!this.g.state.bosses[t.needs] })); }
  bestDepth() { return this.g.state.records?.riftBest || 0; }

  // ---- multipliers folded into the difficulty system ---------------------------------------------------------------------------------------------
  mods(depth = this.run?.depth) {
    if (!this.run) return [];
    const r = rng(this.run.seed * 29 + depth * 101), n = depth >= 5 ? 2 : depth >= 2 ? 1 : 0, ids = RIFT_MOD_IDS.slice(), out = [];
    for (let i = 0; i < n; i++) out.push(ids.splice(Math.floor(r() * ids.length), 1)[0]);
    return out;
  }
  mult() {
    const run = this.run; if (!run) return null;
    const d = run.depth - 1, t = run.tier;
    const m = { hp: (1 + 0.1 * d) * t.mult, dmg: (1 + 0.07 * d) * (1 + (t.mult - 1) * 0.5), xp: 1 + 0.12 * d, coin: 1 };
    for (const id of this.mods()) { const x = RIFT_MODS[id].mult || {}; for (const k of Object.keys(m)) if (x[k]) m[k] *= x[k]; }
    return m;
  }
  eliteBonus() { return this.run ? this.mods().reduce((s, id) => s + (RIFT_MODS[id].elite || 0), 0) : 0; }

  // ---- starting a run ---------------------------------------------------------------------------------------------------------------------------------
  start(opts = {}) {
    const g = this.g; if (this.run || !g.world) return false;
    const tier = RIFT_TIERS.find((t) => t.id === opts.tier) || RIFT_TIERS[0];
    const seed = opts.seed ?? Math.floor(Math.random() * 900000 + 100000), w = g.world, p = w.player;
    setRiftThemes(this.unlockedThemes());
    this.run = { seed, tier, max: tier.depths, depth: 1, kills: 0, cleared: false, picking: false, offered: 0, t0: g.state.playtime, daily: !!opts.daily, hub: { zone: w.zone.id, x: p.x, y: p.y }, hp0: p.hp, done: false, depthKills: 0 };
    g.state.riftRelics = [];
    g.events.emit('rift', 'enter');
    this.go(1, true);
    return true;
  }
  // the run's depth follows whichever chamber is about to be built (called before the world exists, so spawns scale correctly)
  enter(id) {
    const run = this.run, P = parseId(id); if (!run || !P || P.kind !== 'rift') return;
    run.depth = P.depth; run.cleared = false; run.picking = false; run.depthKills = 0; run.checkT = 0;
  }
  go(depth, first = false) {
    const g = this.g, ps = g.playScene, run = this.run; this.enter(riftId(run.seed, depth, run.max));
    const enter = () => { g.buildWorld(riftId(run.seed, depth, run.max), 'west', { silentBanner: true }); ps.fadeIn(0.5); };
    ps.fadeOut(first ? 0.5 : 0.3, enter);
  }

  // called by Game.buildWorld for every world: sets up a rift depth, or ends the run if the player left it
  onWorld(world) {
    const run = this.run, id = world.zone.id;
    if (!run) return;
    if (!isRiftZone(id)) { this.cleanup(); return; }
    const g = this.g, mods = this.mods();
    for (const m of mods) { const M = RIFT_MODS[m]; if (M.haste) for (const e of world.enemies) if (!e.def.friendly) e.status.apply('haste', { dur: 1e6, power: 1 }); if (M.dark) world.zone.dark = Math.max(world.zone.dark ?? world.biome.dark, M.dark); }
    if (world.zone.rift?.last) this.crown(world);
    world.player.recalc?.(); world.player.hp = Math.min(world.player.hp, world.player.stats.maxHp);
    const sub = mods.length ? mods.map((m) => RIFT_MODS[m].name).join('  ·  ').replace(/·/g, '-') : 'The water is calm. For now.';
    g.banner(`RIFT - DEPTH ${run.depth}/${run.max}`, sub); g.audio.sfx('rift');
    for (const m of mods) g.toast(RIFT_MODS[m].name + ': ' + RIFT_MODS[m].desc, RIFT_MODS[m].color);
    g.events.emit('rift', 'depth', run.depth);
  }
  // the last chamber's strongest creature becomes a champion with two affixes
  crown(world) {
    const foes = world.enemies.filter((e) => !e.def.friendly && !e.def.boss && !e.affixes); if (!foes.length) return;
    foes.sort((a, b) => b.maxHp - a.maxHp); const c = foes[0], ids = ['armored', 'swift', 'vampiric', 'volatile', 'scorching', 'frostbitten', 'mending', 'thorned', 'shielded'];
    const r = rng(this.run.seed + 99), a = ids[Math.floor(r() * ids.length)]; let b = ids[Math.floor(r() * ids.length)]; if (b === a) b = ids[(ids.indexOf(a) + 3) % ids.length];
    this.g.systems.elites.apply(c, [a, b]); c.maxHp = Math.round(c.maxHp * 1.6); c.hp = c.maxHp; c.scale = 1.25; c.w = Math.round(c.w * 1.25); c.h = Math.round(c.h * 1.25); c.xpMult = (c.xpMult || 1) * 2; c.name = 'Rift Champion'; c.champion = true;
  }

  // ---- per-frame bookkeeping ------------------------------------------------------------------------------------------------------------------------------
  update(dt) {
    const run = this.run; this.warnT = Math.max(0, this.warnT - dt);
    for (const t of this.timers) t.t -= dt;
    for (const t of this.timers.filter((x) => x.t <= 0)) if (this.run && !this.run.done) t.fn();
    this.timers = this.timers.filter((x) => x.t > 0);
    if (!run) return;
    const w = this.g.world; if (!w || !isRiftZone(w.zone.id) || run.done) return;
    run.checkT -= dt; if (run.cleared || run.checkT > 0) return; run.checkT = 0.4;
    if (w.enemies.some((e) => e.alive && !e.dying && !e.def.friendly)) return;
    run.cleared = true; this.g.audio.sfx('wave_clear'); w.fx.ring(w.player.x, w.player.y, 6, 90, 0.6, '#ffe8a0', 3);
    if (w.zone.rift.last) { this.g.toast('The champion falls. The rift quiets.', '#ffd84a'); this.after(1.6, () => this.finish(true)); }
    else { this.g.toast('The way opens.', '#9ad8ff'); this.after(1.1, () => this.offer()); }
  }
  // game-time delays (they pause with the game and run under deterministic stepping)
  after(sec, fn) { this.timers.push({ t: sec, fn }); }

  canLeave() {
    const run = this.run; if (!run) return true;
    if (run.cleared && !run.picking) return true;
    if (this.warnT <= 0) { this.warnT = 2.5; this.g.toast(run.picking ? 'Choose a relic first' : 'Defeat every foe to open the way', '#ffb070'); this.g.audio.sfx('deny'); }
    return false;
  }

  // ---- relics --------------------------------------------------------------------------------------------------------------------------------------------------------
  roll(n = 3) {
    const run = this.run, r = rng(run.seed * 13 + run.depth * 7 + run.offered * 3), have = new Set(this.relics()), out = [];
    const pool = RELIC_IDS.filter((id) => !have.has(id) && (RELICS[id].rarity !== 'epic' || run.depth >= 2));
    while (out.length < n && pool.length) {
      const weights = pool.map((id) => RARITY[RELICS[id].rarity].weight); let x = r() * weights.reduce((a, b) => a + b, 0), i = 0;
      for (; i < pool.length - 1; i++) { x -= weights[i]; if (x <= 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
  offer() {
    const run = this.run; if (!run || run.picking) return;
    const choices = this.roll(); if (!choices.length) { run.picking = false; return; }
    run.picking = true; run.offered++;
    this.g.engine.push(new RelicScene(this.g, choices));
  }
  pick(id) {
    const g = this.g, run = this.run; if (!run) return;
    this.relics().push(id); run.picking = false; g.world.player.recalc(); g.audio.sfx('relic');
    g.toast(RELICS[id].name + ': ' + RELICS[id].desc, RARITY[RELICS[id].rarity].color);
    g.events.emit('relic', id);
  }
  nova(e) {
    const w = this.g.world, p = w.player, R = 46; if (!w || !e) return;
    w.fx.ring(e.x, e.y, 4, R, 0.35, '#9af0ff', 3); w.fx.burst(e.x, e.y, ['#c8f8ff', '#ffffff'], 90, 0.4, 2);
    w.spawnHitbox({ team: 'player', x: e.x - R, y: e.y - R, w: R * 2, h: R * 2, dmg: Math.round(p.stats.atk * 0.8), life: 0.1, kb: 80, poise: 10, owner: p, fromAbility: true });
  }

  // ---- ending a run -------------------------------------------------------------------------------------------------------------------------------------------
  rewards(success) {
    const run = this.run, cleared = success ? run.max : run.depth - 1, t = run.tier, r = rng(run.seed + 5);
    const out = { coins: 0, xp: 0, pearls: 0, black: 0, items: {}, sp: 0 };
    if (success) {
      out.coins = Math.round((120 + 60 * run.max) * t.reward); out.xp = 200 * run.max; out.pearls = run.max >= 8 ? 3 : run.max >= 6 ? 2 : 1; out.black = run.max >= 8 ? 1 : 0;
      for (let i = 0; i < 3 + run.max; i++) { const id = INGREDIENT_IDS[Math.floor(r() * INGREDIENT_IDS.length)]; out.items[id] = (out.items[id] || 0) + 1; }
      const key = 'rift_first_' + t.id; if (!this.g.state.flags[key]) { out.sp = 1; out.first = key; }
      if (run.daily) { const dk = 'daily_' + today(); if (!this.g.state.flags[dk]) { out.coins += 200; out.pearls += 1; out.dailyKey = dk; } }
    } else { out.coins = Math.round(25 * cleared * t.reward); out.xp = 40 * cleared; out.pearls = Math.floor(cleared / 3); }
    out.cleared = cleared; return out;
  }
  finish(success) {
    const g = this.g, run = this.run; if (!run || run.done) return; run.done = true;
    const rw = this.rewards(success), s = g.state, rec = s.records;
    const secs = Math.round(s.playtime - run.t0), depth = success ? run.max : run.depth;
    if (rec) { if (success) rec.rifts++; rec.riftBest = Math.max(rec.riftBest, depth); rec.riftTime += secs; }
    this.summary = { success, depth, max: run.max, tier: run.tier.name, secs, kills: run.kills, relics: [...this.relics()], rw, daily: run.daily };
    const ps = g.playScene;
    ps.fadeOut(success ? 1.2 : 0.9, () => {
      this.pay(rw); const hub = run.hub; this.cleanup();
      g.buildWorld(hub.zone, null, { silentBanner: true, respawn: !success }); const p = g.world.player; p.x = hub.x; p.y = hub.y; g.world.clearSpawn(p); g.world.snapCamera();
      p.hp = Math.min(p.stats.maxHp, Math.max(p.hp, run.hp0 || 1)); if (!p.alive) p.alive = true;
      ps.fadeIn(0.6); g.events.emit('rift', success ? 'won' : 'lost');
      g.engine.push(new RiftSummary(g, this.summary));
    });
  }
  pay(rw) {
    const g = this.g, s = g.state, p = g.world.player;
    s.coins += rw.coins; s.stats.coinsEarned += rw.coins; g.giveXp(rw.xp, p.x, p.y);
    if (rw.pearls) g.grantItem('pearl', rw.pearls, false); if (rw.black) g.grantItem('black_pearl', rw.black, false);
    for (const [id, n] of Object.entries(rw.items)) g.grantItem(id, n, false);
    if (rw.sp) { s.sp += rw.sp; s.flags[rw.first] = true; } if (rw.dailyKey) s.flags[rw.dailyKey] = true;
  }
  // the player died inside a rift: the run is over, nothing is lost but the run
  onDeath() {
    const run = this.run; if (!run) return false;
    const g = this.g;
    if (!run.done) {
      run.done = true; const rw = this.rewards(false), rec = g.state.records;
      if (rec) { rec.riftBest = Math.max(rec.riftBest, run.depth); rec.riftTime += Math.round(g.state.playtime - run.t0); }
      this.summary = { success: false, depth: run.depth, max: run.max, tier: run.tier.name, secs: Math.round(g.state.playtime - run.t0), kills: run.kills, relics: [...this.relics()], rw, daily: run.daily };
      g.playScene.fadeOut(0.9, () => {
        this.pay(rw); const hub = run.hub; this.cleanup();
        g.buildWorld(hub.zone, null, { silentBanner: true, respawn: true }); const np = g.world.player; np.x = hub.x; np.y = hub.y; g.world.clearSpawn(np); g.world.snapCamera();
        g.playScene.fadeIn(0.8); np.setState('free'); g.events.emit('rift', 'lost');
        g.engine.push(new RiftSummary(g, this.summary));
      });
    }
    return true;
  }
  abandon() { if (this.run && !this.run.done) this.finish(false); }
  cleanup() { this.run = null; this.g.state.riftRelics = []; this.g.world?.player?.recalc?.(); }
}
