// The Pearl Gauntlet: a sealed arena where creatures arrive in waves. Each wave is built from a threat budget out of the
// creatures the wave has unlocked; every third wave offers a relic, every fifth pays pearls, every tenth is led by a champion.
// The run ends when the swimmer falls (or leaves from the pause menu); the best wave is kept in the records.
import { ENEMIES } from '../data/enemies.js';
import { RELICS, RARITY, RELIC_IDS } from '../data/relics.js';
import { arenaId } from '../world/rift_gen.js';
import { spawnFoe } from './spawner.js';
import { RelicScene } from '../ui/relic_scene.js';
import { RiftSummary } from '../ui/board_scene.js';
import { text, textWidth, panel } from '../ui/ui.js';
import { rng, clamp } from '../core/util.js';

const SKIP_AI = new Set(['turret', 'ambush', 'mimic', 'noop', 'healer', 'summoner']);
const power = (d) => d.hp + d.dmg * 4;
// every creature that can fight in an open arena, weakest first
export const ARENA_POOL = Object.keys(ENEMIES).filter((k) => { const d = ENEMIES[k]; return d.dmg > 0 && !d.friendly && !d.boss && !SKIP_AI.has(d.ai); }).sort((a, b) => power(ENEMIES[a]) - power(ENEMIES[b]));
export const isArenaZone = (id) => typeof id === 'string' && id.startsWith('arena:');

export function waveBudget(n) { return 6 + n * 2.4; }
export function unlocked(n) { return Math.min(ARENA_POOL.length, Math.ceil(3 + n * 1.1)); }
// the creatures for wave n: deterministic given the rng
export function composeWave(n, r) {
  const pool = ARENA_POOL.slice(0, unlocked(n)), out = []; let budget = waveBudget(n);
  while (budget > 0 && out.length < 16) {
    const lo = Math.max(0, pool.length - 6), type = pool[lo + Math.floor(r() * (pool.length - lo))], cost = Math.max(1.5, power(ENEMIES[type]) / 22);
    if (cost > budget && out.length) break;
    const swarm = ENEMIES[type].ai === 'swarm', n2 = swarm ? 3 : 1; for (let i = 0; i < n2; i++) out.push(type); budget -= cost * (swarm ? 1.6 : 1);
  }
  return out;
}

export class Arena {
  constructor(game) { this.g = game; game.systems.arena = this; this.run = null; this.timers = []; game.events.on('kill', () => { if (this.run && !this.run.done) this.run.kills++; }); }
  get active() { return !!this.run; }

  mult() { const run = this.run; if (!run) return null; const n = Math.max(0, run.wave - 1); return { hp: 1 + 0.07 * n, dmg: 1 + 0.045 * n, xp: 1 + 0.05 * n, coin: 1 }; }
  eliteChance() { return this.run ? clamp(0.04 + this.run.wave * 0.02, 0, 0.45) : 0; }

  start() {
    const g = this.g; if (this.run || g.systems.rifts?.active || !g.world) return false;
    const w = g.world, p = w.player, seed = Math.floor(Math.random() * 90000 + 10000);
    this.run = { seed, wave: 0, kills: 0, state: 'wait', left: 0, bonus: 0, pearls: 0, hub: { zone: w.zone.id, x: p.x, y: p.y }, hp0: p.hp, t0: g.state.playtime, pending: 0, picking: false, done: false };
    g.state.riftRelics = []; this.timers = [];
    g.events.emit('arena', 'enter');
    g.playScene.fadeOut(0.5, () => { g.buildWorld(arenaId(seed), 'start', { silentBanner: true }); g.playScene.fadeIn(0.5); });
    return true;
  }
  onWorld(world) {
    const run = this.run; if (!run) return;
    if (!isArenaZone(world.zone.id)) { this.cleanup(); return; }
    this.g.banner('THE PEARL GAUNTLET', 'Survive the waves'); this.g.audio.sfx('rift');
    world.enemies.length = 0; world.overlayExtra.push((ctx) => this.drawHud(ctx));
    run.state = 'wait'; this.after(3.2, () => this.nextWave());
  }

  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  update(dt) {
    for (const t of this.timers) t.t -= dt;
    for (const t of this.timers.filter((x) => x.t <= 0)) if (this.run && !this.run.done) t.fn();
    this.timers = this.timers.filter((x) => x.t > 0);
    const run = this.run, w = this.g.world; if (!run || run.done || !w || !isArenaZone(w.zone.id)) return;
    if (run.state === 'fight' && run.pending === 0 && !w.enemies.some((e) => e.alive && !e.dying && !e.def.friendly)) this.clear();
  }

  // ---- waves ---------------------------------------------------------------------------------------------------------------------------------------------
  nextWave() {
    const run = this.run, g = this.g, w = g.world; if (!run || run.done || !w) return;
    run.wave++; run.state = 'fight';
    const r = rng(run.seed * 31 + run.wave), list = composeWave(run.wave, r), boss = run.wave % 10 === 0;
    g.banner(boss ? `WAVE ${run.wave} - CHAMPION` : `WAVE ${run.wave}`, `${list.length} foes`); g.audio.sfx('wave_start');
    run.left = list.length; run.pending = list.length;
    list.forEach((type, i) => this.after(0.6 + i * 0.22, () => this.spawn(type, r, boss && i === list.length - 1)));
    g.events.emit('arena', 'wave', run.wave);
  }
  spawn(type, r, champion) {
    const run = this.run, w = this.g.world; if (!run || !w) return;
    const e = spawnFoe(w, type, r); run.pending = Math.max(0, run.pending - 1); if (!e) return;
    if (champion) { this.g.systems.elites.apply(e, ['shielded', 'armored']); e.maxHp = Math.round(e.maxHp * 1.8); e.hp = e.maxHp; e.xpMult = (e.xpMult || 1) * 2; e.champion = true; }
    else if (r() < this.eliteChance()) { const ids = ['armored', 'swift', 'vampiric', 'volatile', 'scorching', 'frostbitten', 'brooding', 'mending', 'thorned', 'shielded']; this.g.systems.elites.apply(e, [ids[Math.floor(r() * ids.length)]]); }
  }
  clear() {
    const run = this.run, g = this.g, w = g.world, p = w.player, n = run.wave; run.state = 'rest';
    g.audio.sfx('wave_clear'); w.fx.ring(p.x, p.y, 6, 100, 0.6, '#ffe8a0', 3);
    const bonus = n * 10; run.bonus += bonus; g.state.coins += bonus; g.state.stats.coinsEarned += bonus; w.fx.text(p.x, p.y - 20, '+' + bonus, '#ffd84a', true);
    p.heal(Math.round(p.stats.maxHp * 0.25)); p.addTide(p.stats.maxTide * 0.4);
    if (n % 5 === 0) { const pearls = n % 10 === 0 ? 2 : 1; run.pearls += pearls; g.grantItem('pearl', pearls, true); }
    const rec = g.state.records; if (rec) rec.arenaBest = Math.max(rec.arenaBest, n);
    g.toast(`Wave ${n} cleared`, '#9ad8ff'); g.events.emit('arena', 'clear', n);
    if (n % 3 === 0) this.after(1.2, () => this.offer()); else this.after(3, () => this.nextWave());
  }
  offer() {
    const run = this.run; if (!run) return; const r = rng(run.seed + run.wave * 17), have = new Set(this.g.state.riftRelics), pool = RELIC_IDS.filter((id) => !have.has(id) && RELICS[id].rarity !== 'epic' || (run.wave >= 6 && !have.has(id)));
    const choices = []; while (choices.length < 3 && pool.length) choices.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    if (!choices.length) { this.after(1, () => this.nextWave()); return; }
    run.picking = true;
    this.g.engine.push(new RelicScene(this.g, choices, (id) => {
      this.g.state.riftRelics.push(id); this.g.world.player.recalc(); this.g.audio.sfx('relic'); this.g.events.emit('relic', id); this.g.toast(RELICS[id].name + ': ' + RELICS[id].desc, RARITY[RELICS[id].rarity].color);
      run.picking = false; this.after(1.5, () => this.nextWave());
    }));
  }

  // ---- finishing ----------------------------------------------------------------------------------------------------------------------------------------------
  summary() {
    const run = this.run, g = this.g, n = Math.max(0, run.wave - (run.state === 'fight' ? 1 : 0));
    return { success: n >= 10, title: 'GAUNTLET OVER', label: `Wave ${run.wave} reached`, tier: 'Pearl Gauntlet', depth: run.wave, max: run.wave, secs: Math.round(g.state.playtime - run.t0), kills: run.kills, relics: [...(g.state.riftRelics || [])], rw: { coins: run.bonus, xp: 0, pearls: run.pearls, black: 0, items: {}, sp: 0 } };
  }
  onDeath() { return this.end(true); }
  abandon() { return this.end(false); }
  end(died) {
    const run = this.run, g = this.g; if (!run || run.done) return false; run.done = true;
    const rec = g.state.records; if (rec) rec.arenaBest = Math.max(rec.arenaBest, Math.max(0, run.wave - 1));
    const s = this.summary(); this.timers = [];
    g.playScene.fadeOut(0.9, () => {
      const hub = run.hub; this.cleanup();
      g.buildWorld(hub.zone, null, { silentBanner: true, respawn: died }); const p = g.world.player; p.x = hub.x; p.y = hub.y; g.world.clearSpawn(p); g.world.snapCamera();
      if (!died) p.hp = Math.min(p.stats.maxHp, Math.max(p.hp, run.hp0 || 1)); else p.setState('free');
      g.playScene.fadeIn(0.7); g.events.emit('rift', 'lost'); g.engine.push(new RiftSummary(g, s));
    });
    return true;
  }
  cleanup() { this.run = null; this.timers = []; this.g.state.riftRelics = []; this.g.world?.player?.recalc?.(); }

  drawHud(ctx) {
    const run = this.run; if (!run || run.done) return; const w = this.g.world;
    const foes = w.enemies.filter((e) => e.alive && !e.dying && !e.def.friendly).length + (run.pending || 0);
    const s = run.state === 'fight' ? `WAVE ${run.wave}   FOES ${foes}` : run.wave ? `WAVE ${run.wave} CLEARED` : 'GET READY';
    const tw = textWidth(s) + 14; panel(ctx, 240 - tw / 2, 24, tw, 14, { alpha: 0.7, border: '#a08a3a' }); text(ctx, s, 247 - tw / 2, 28, '#ffe8a0');
  }
}
