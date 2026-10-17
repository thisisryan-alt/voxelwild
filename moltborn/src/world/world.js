// Runtime for one zone: tile layer, entities, hitboxes, hazards, camera, lighting and drawing.
import { TS, T } from './tiles.js';
import { TileLayer } from './bake.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Projectile, Pickup } from '../entities/entity.js';
import { INTERACTABLES } from '../entities/interactables.js';
import { Particles } from '../gfx/particles.js';
import { Ambience } from '../gfx/ambience.js';
import { propSprite } from '../gfx/sprites_world.js';
import { getBackground } from '../gfx/background.js';
import { BIOMES } from '../data/biomes.js';
import { ENEMIES } from '../data/enemies.js';
import { createBoss } from '../entities/bosses.js';
import { clamp, rng, rectsOverlap } from '../core/util.js';
import { bodyBlocked } from './physics.js';
import { AmbientEvents } from '../gfx/events.js';

const rand = rng(2024);

export class World {
  constructor(game, zone, entryName) {
    this.game = game; this.zone = zone; this.grid = zone.grid; this.biome = BIOMES[zone.biome];
    this.t = 0; this.fx = new Particles();
    this.layer = new TileLayer(zone); this.applyBroken(); this.layer.renderAll();
    this.bg = getBackground(zone.biome, zone.seed); this.amb = new Ambience(zone, this.biome); this.sky = new AmbientEvents(this);
    this.enemies = []; this.projectiles = []; this.pickups = []; this.hitboxes = []; this.interactables = []; this.decor = []; this.fields = []; this.beams = [];
    this.boss = null; this.cinematic = false; this.slowT = 0; this.slowFactor = 1; this.flash = 0; this.hurtFlash = 0; this.shakeAmt = 0; this.kickX = 0; this.kickY = 0; this.camLock = null;
    this.exitsDisabled = false; this.drawExtra = []; this.overlayExtra = []; this.extraLights = []; this.lightCv = null; this.exiting = false; this.difficulty = 0;
    this.cam = { x: 0, y: 0, lookX: 0, lookY: 0 };
    this.buildEntities(); game.systems.elites?.roll(this);
    const entry = zone.entries[entryName] || Object.values(zone.entries)[0];
    this.player = new Player(this, entry.x, entry.y - 6, game);
    this.player.y = entry.y - this.player.h / 2 - 0.5; this.player.facing = entry.facing || 1;
    this.clearSpawn(this.player);
    this.snapCamera();
  }
  // a broad form can arrive wedged against a rock lip beside a narrow entry: slide it to the nearest spot that fits
  clearSpawn(b) {
    if (!bodyBlocked(this.grid, b)) return;
    const ox = b.x, oy = b.y; let best = null, bd = Infinity;
    for (let dy = 0; dy <= 48; dy += 4) for (let dx = -64; dx <= 64; dx += 4) {
      b.x = ox + dx; b.y = oy - dy;
      const d = Math.hypot(dx, dy * 1.5); if (d < bd && !bodyBlocked(this.grid, b)) { bd = d; best = [b.x, b.y]; }
    }
    if (best) { b.x = best[0]; b.y = best[1]; } else { b.x = ox; b.y = oy; }
  }
  zs() { return this.game.zoneState(this.zone.id); }
  applyBroken() { const zs = this.zs(); for (const k of Object.keys(zs.broken || {})) { const [x, y] = k.split(',').map(Number); this.grid.set(x, y, T.AIR); } }

  buildEntities() {
    const z = this.zone, zs = this.zs(), g = this.game;
    z.spawns.forEach((s, i) => {
      const id = `${z.id}:s${i}`;
      if (s.unique && zs.killed?.[id]) return;
      if (s.boss) { if (g.state.bosses[s.boss]) return; const b = createBoss(this, s.boss, s.x, s.y, s); if (b) { this.enemies.push(b); this.boss = b; } return; }
      const def = ENEMIES[s.type]; if (!def) return;
      const n = s.count || 1;
      for (let k = 0; k < n; k++) {
        const ox = (k - (n - 1) / 2) * (s.spread ?? 14), oy = s.floor ? 0 : ((k % 2) - 0.5) * (s.spreadY ?? 8);
        const e = new Enemy(this, s.type, s.x + ox, s.floor ? s.y - def.h / 2 - 0.1 : s.y + oy, { p: s.p, hpMult: s.hpMult, dmgMult: s.dmgMult, xpMult: s.xpMult, spawnId: id, facing: s.facing });
        e.unique = !!s.unique; e.persistKey = id; this.enemies.push(e);
      }
    });
    for (const p of z.props) {
      const cls = INTERACTABLES[p.type];
      if (cls) { const o = new cls(this, p); this.interactables.push(o); continue; }
      if (p.type === 'coin' || p.type === 'pearl' || p.type === 'item' || p.type === 'orb') {
        const key = p.key || `${z.id}:pk:${Math.round(p.x)}:${Math.round(p.y)}`;
        if (zs.collected?.[key]) continue;
        this.pickups.push(new Pickup(this, { kind: p.type, id: p.id, value: p.value || 1, x: p.x, y: p.y - 8, fixed: true, delay: 0, life: 1e9, vx: 0, vy: 0, key })); this.pickups[this.pickups.length - 1].key = key; continue;
      }
      if (p.type === 'npc') continue;
      let spr; try { spr = propSprite(p.type, p.v || 0); } catch (e) { continue; }
      if (p.type === 'cocoons' && this.game.flag('hatchlings_freed')) continue;
      this.decor.push({ spr, x: p.x, y: p.y, ph: rand() * 6, layer: p.layer || 'back', glow: spr.glow, type: p.type, cocoon: p.type === 'cocoons' });
    }
  }

  // ---- API used by entities/abilities ----------------------------------------------------------
  spawnHitbox(o) {
    const hb = { x: 0, y: 0, w: 10, h: 10, dmg: 1, life: 0.1, kb: 60, poise: 0, hits: new Set(), t: 0, ...o };
    if (hb.once) hb.hits = hb.once;
    this.hitboxes.push(hb); return hb;
  }
  spawnMinion(type, x, y, o = {}) {
    if (!ENEMIES[type]) return null;
    const e = new Enemy(this, type, x, y, o); e.minion = true; e.vx = o.vx || 0; e.vy = o.vy || 0; this.enemies.push(e); return e;
  }
  addProjectile(o) { const p = new Projectile(this, o); this.projectiles.push(p); return p; }
  addField(o) { this.fields.push({ tick: 0, t: 0, ...o }); }
  addBeam(o) { this.beams.push({ t: 0, ...o }); }
  addPickup(o) { this.pickups.push(new Pickup(this, o)); }
  shake(a) {
    const s = this.game.state.settings;
    this.shakeAmt = Math.max(this.shakeAmt, a * (s.shake ?? 1) * (s.reduceMotion ? 0 : 1));
    if (a >= 5) this.game.events.emit('bigshake', this.player.x, this.player.y, a);
  }
  // A one-direction camera shove that eases back: gives a heavy blow a sense of weight that random shake cannot.
  kickCam(dx, dy = 0) { const k = this.game.state.settings.shake ?? 1; this.kickX = clamp(this.kickX + dx * k, -6, 6); this.kickY = clamp(this.kickY + dy * k, -6, 6); }
  nearestEnemy(x, y, r) { let best = null, bd = r * r; for (const e of this.enemies) { if (!e.alive || !e.canBeHit()) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } } return best; }
  currentAt(x, y) { for (const a of this.zone.areas) if (a.kind === 'current' && x > a.x && x < a.x + a.w && y > a.y && y < a.y + a.h) return a; return null; }
  pressureAt(x, y) { let p = this.zone.pressure || 0; for (const a of this.zone.areas) if (a.kind === 'pressure' && x > a.x && x < a.x + a.w && y > a.y && y < a.y + a.h) p = a.level; return p; }
  setTile(tx, ty, t) { this.grid.set(tx, ty, t); this.layer.renderRegion(tx - 1, ty - 1, tx + 1, ty + 1); }
  breakTile(tx, ty, silent) {
    const t = this.grid.get(tx, ty); if (t !== T.CRACKED && t !== T.SEAL && t !== T.TIDEGATE) return false;
    this.grid.set(tx, ty, T.AIR); (this.zs().broken ||= {})[`${tx},${ty}`] = true;
    if (!silent) { this.fx.burst((tx + 0.5) * TS, (ty + 0.5) * TS, ['#8896bc', '#b0bcdc', '#ffffff', '#ffe0a0'], 90, 0.6, 3, { grav: 120 }); }
    return true;
  }
  breakBlocks(list) { // list of [tx,ty]; re-render once
    let any = false, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const [tx, ty] of list) if (this.breakTile(tx, ty)) { any = true; x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx); y1 = Math.max(y1, ty); }
    if (any) { this.layer.renderRegion(x0 - 1, y0 - 1, x1 + 1, y1 + 1); this.game.audio.sfx('rockbreak'); this.shake(2); this.game.events.emit('tilebroken'); this.game.onSecretMaybe?.(x0, y0); }
    return any;
  }
  breakAround(x, y, r, mode) {
    const list = []; for (let ty = Math.floor((y - r) / TS); ty <= Math.floor((y + r) / TS); ty++) for (let tx = Math.floor((x - r) / TS); tx <= Math.floor((x + r) / TS); tx++) { const t = this.grid.get(tx, ty); if (t === T.CRACKED || (mode === 'seal' && t === T.SEAL)) list.push([tx, ty]); }
    this.breakBlocks(list);
  }
  cataclysm(p, mult) {
    for (const e of this.enemies) if (e.alive && Math.abs(e.x - p.x) < 280 && Math.abs(e.y - p.y) < 170 && e.canBeHit()) e.takeHit({ dmg: p.abDmg(mult), dir: Math.sign(e.x - p.x) || 1, kb: 220, poise: 200, stop: 4, stun: 1.5, fromAbility: true, crit: true }, p);
    const list = []; for (let ty = Math.floor((p.y - 170) / TS); ty <= Math.floor((p.y + 170) / TS); ty++) for (let tx = Math.floor((p.x - 280) / TS); tx <= Math.floor((p.x + 280) / TS); tx++) { const t = this.grid.get(tx, ty); if (t === T.CRACKED || t === T.SEAL) list.push([tx, ty]); }
    this.breakBlocks(list);
    for (const pr of this.projectiles) if (pr.team === 'enemy') pr.die(true);
  }
  collect(pk) {
    if (pk.key) (this.zs().collected ||= {})[pk.key] = true;
    this.game.collect(pk);
  }
  lockCamera(rectTiles) { this.camLock = rectTiles ? { x: rectTiles.x * TS, y: rectTiles.y * TS, w: rectTiles.w * TS, h: rectTiles.h * TS } : null; }
  setBarrier(rects, on) { // rects in tiles; place or clear BARRIER tiles
    for (const r of rects) for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { if (on) { if (this.grid.get(r.x + i, r.y + j) === T.AIR) this.grid.set(r.x + i, r.y + j, T.BARRIER); } else if (this.grid.get(r.x + i, r.y + j) === T.BARRIER) this.grid.set(r.x + i, r.y + j, T.AIR); }
    for (const r of rects) this.layer.renderRegion(r.x - 1, r.y - 1, r.x + r.w, r.y + r.h);
  }

  // ---- update -----------------------------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    const pl = this.player;
    const edt = this.slowT > 0 ? dt * this.slowFactor : dt;
    if (this.slowT > 0) this.slowT -= dt;
    pl.update(dt);
    for (const e of this.enemies) e.update(edt);
    for (const i of this.interactables) i.update?.(dt);
    for (const p of this.projectiles) p.update(edt);
    for (const p of this.pickups) p.update(dt);
    this.updateHitboxes(dt);
    this.updateFields(edt);
    this.hazards(dt);
    // cull
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.pickups = this.pickups.filter((p) => p.alive);
    this.hitboxes = this.hitboxes.filter((h) => h.life > 0);
    this.beams = this.beams.filter((b) => (b.t += dt) < b.life);
    this.fx.update(dt);
    this.flash = Math.max(0, this.flash - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt); this.shakeAmt *= Math.exp(-9 * dt);
    this.kickX *= Math.exp(-11 * dt); this.kickY *= Math.exp(-11 * dt);
    this.ambientFx(dt); this.amb.update(dt, this); this.sky.update(dt);
    this.updateCamera(dt);
    // nearest interactable
    this.near = null; if (pl.alive && !pl.locked) { let bd = 1e9; for (const i of this.interactables) { if (!i.prompt() || !i.canInteract(pl)) continue; const d = Math.abs(i.x - pl.x) + Math.abs(i.y - pl.y); if (d < bd) { bd = d; this.near = i; } } }
    // exits
    if (!this.exiting && !this.exitsDisabled && pl.alive) for (const ex of this.zone.exits) if (pl.x > ex.x && pl.x < ex.x + ex.w && pl.y > ex.y && pl.y < ex.y + ex.h) { if (ex.cond && !ex.cond(this.game)) continue; this.exiting = true; this.game.changeZone(ex.to, ex.entry, ex); break; }
  }
  updateHitboxes(dt) {
    const pl = this.player, S = pl.stats;
    for (const hb of this.hitboxes) {
      hb.t += dt;
      if (hb.follow) { hb.x = hb.follow.x + (hb.ox ?? 0); hb.y = hb.follow.y + (hb.oy ?? 0); }
      hb.life -= dt;
      if (hb.team === 'player') {
        if (hb.multi && hb.hits.size && hb.t % (hb.interval || 0.1) < dt) hb.hits.clear();
        for (const e of this.enemies) {
          if (!e.alive || hb.hits.has(e) || !e.canBeHit()) continue;
          const boxes = e.hurtBoxes ? e.hurtBoxes() : [e.hurtBox()]; if (!boxes.some((b) => rectsOverlap(hb, b))) continue;
          hb.hits.add(e);
          let dmg = hb.dmg * pl.status.mult('dmgOut'), crit = false;
          if (hb.crit && rand() < S.crit) { crit = true; dmg *= S.critMult; }
          if (hb.crit && S.execute && e.hp / e.maxHp < 0.3) dmg *= 1 + S.execute;
          if (pl.stats.dmg && !hb.crit) dmg *= 1 + 0;
          const res = e.takeHit({ dmg: Math.max(1, Math.round(dmg)), dir: Math.sign(e.x - pl.x) || pl.facing, kb: hb.kb, poise: hb.poise, stop: hb.stop, shake: hb.shake, guardBreak: hb.guardBreak, heavy: hb.heavy, status: hb.status, crit, stun: hb.stun, fromAbility: !!hb.ability, x: pl.x, y: pl.y }, pl);
          if (res === true) pl.onHitLanded(e, hb, dmg, crit);
        }
        if (hb.breaks || hb.seals || hb.gates) this.hitBreakables(hb);
        for (const i of this.interactables) if (i.onHit && rectsOverlap(hb, i.box()) && !hb.hits.has(i)) { hb.hits.add(i); i.onHit(hb); }
        for (const pr of this.projectiles) if (pr.team === 'enemy' && !hb.hits.has(pr) && pr.reflectable && hb.heavy && rectsOverlap(hb, pr.box())) { hb.hits.add(pr); pr.reflect(); }
      } else if (hb.team === 'enemy') {
        if (pl.alive && !hb.hits.has(pl) && rectsOverlap(hb, pl.hurtBox())) {
          hb.hits.add(pl);
          pl.takeHit({ dmg: hb.dmg, x: hb.x + hb.w / 2, y: hb.y + hb.h / 2, kb: hb.kb, status: hb.status, source: hb.owner, unblockable: hb.unblockable, boss: hb.boss, owner: hb.owner });
        }
      }
    }
  }
  hitBreakables(hb) {
    const list = [];
    for (let ty = Math.floor(hb.y / TS); ty <= Math.floor((hb.y + hb.h) / TS); ty++) for (let tx = Math.floor(hb.x / TS); tx <= Math.floor((hb.x + hb.w) / TS); tx++) {
      const t = this.grid.get(tx, ty);
      if ((t === T.CRACKED && hb.breaks) || (t === T.SEAL && hb.seals) || (t === T.TIDEGATE && hb.gates)) list.push([tx, ty]);
      else if ((t === T.SEAL && !hb.seals) || (t === T.TIDEGATE && !hb.gates)) { if (!hb.warned) { hb.warned = true; this.fx.text((tx + 0.5) * TS, ty * TS - 4, t === T.SEAL ? 'Needs greater power' : 'Sealed by the tide', '#9ad8ff'); this.game.audio.sfx('deny'); } }
    }
    if (list.length) this.breakBlocks(list);
  }
  updateFields(dt) {
    for (const f of this.fields) {
      f.t += dt; f.life -= dt; f.tick -= dt;
      if (f.team === 'enemy') {
        const pl = this.player; const dx = f.x - pl.x, dy = f.y - pl.y, d = Math.hypot(dx, dy);
        if (pl.alive && d < f.r && pl.state !== 'locked') { const k = (1 - d / f.r + 0.2) * f.pull; pl.vx += dx / (d || 1) * k * dt * 5; pl.vy += dy / (d || 1) * k * dt * 5; if (f.tick <= 0) pl.takeHit({ dmg: Math.max(1, Math.round(f.dps)), x: f.x, y: f.y, kb: 0, unblockable: true, field: true, status: f.poison ? { poison: f.poison } : undefined }); }
        if (f.tick <= 0) f.tick = 0.5; continue;
      }
      for (const e of this.enemies) {
        if (!e.alive || !e.canBeHit()) continue;
        const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy);
        if (d < f.r) { const k = f.pull * dt * (1 - d / f.r + 0.2) / (e.def.mass || 1); e.vx += dx / (d || 1) * k * 6; e.vy += dy / (d || 1) * k * 6; if (f.tick <= 0) e.takeHit({ dmg: Math.max(1, Math.round(f.dps * 0.4)), dir: Math.sign(e.x - f.x) || 1, kb: 0, poise: 4, stop: 0, fromAbility: true }, this.player); }
      }
      if (f.tick <= 0) f.tick = 0.4;
    }
    this.fields = this.fields.filter((f) => f.life > 0);
  }
  hazards(dt) {
    const pl = this.player; if (!pl.alive) return;
    const x0 = Math.floor((pl.x - pl.w / 2) / TS), x1 = Math.floor((pl.x + pl.w / 2) / TS), y0 = Math.floor((pl.y - pl.h / 2) / TS), y1 = Math.floor((pl.y + pl.h / 2) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.grid.get(tx, ty) === T.SPIKE) {
      const r = pl.takeHit({ dmg: 8 + Math.round(pl.stats.maxHp * 0.04), x: pl.x, y: pl.y + 8, kb: 90, spike: true }); if (r) { pl.vy = -120; }
    }
    for (const a of this.zone.areas) if (a.kind === 'vent' && pl.x > a.x && pl.x < a.x + a.w && pl.y > a.y && pl.y < a.y + a.h) {
      const on = (this.t + (a.phase || 0)) % (a.period || 4) < (a.on || 1.4); if (on) pl.takeHit({ dmg: a.dmg || 10, x: pl.x, y: pl.y + 20, kb: 100, spike: true, vent: true });
    }
  }
  ambientFx(dt) {
    const c = this.cam, B = this.biome;
    if (rand() < dt * 5) this.fx.add({ x: c.x + rand() * 480, y: c.y + 270 + 4, vx: (rand() - 0.5) * 6, vy: -8 - rand() * 14, life: 6, size: 1, color: B.particles === 'sparks' ? '#9af0e0' : B.particles === 'ash' ? '#a07ab0' : B.particles === 'spores' ? '#d8ff90' : B.particles === 'pearls' ? '#ffd8f0' : '#bfeaff', fade: true });
    if (B.particles === 'snow' && rand() < dt * 3) this.fx.add({ x: c.x + rand() * 480, y: c.y - 4, vx: (rand() - 0.5) * 3, vy: 6 + rand() * 6, life: 8, size: 1, color: '#8aa0d0' });
    for (const d of this.decor) if (d.spr.glow && rand() < dt * 0.6 && Math.abs(d.x - this.player.x) < 260) this.fx.add({ x: d.x + (rand() - 0.5) * 8, y: d.y - 14, vx: 0, vy: -6, life: 1.4, size: 1, color: d.spr.glow });
  }

  // ---- camera -------------------------------------------------------------------------------------------------
  snapCamera() { this.cam.x = this.player.x - 240; this.cam.y = this.player.y - 135; this.clampCam(); }
  clampCam() {
    const c = this.cam, W = this.zone.w * TS, H = this.zone.h * TS;
    const r = this.camLock || { x: 0, y: 0, w: W, h: H };
    c.x = r.w <= 480 ? r.x + (r.w - 480) / 2 : clamp(c.x, r.x, r.x + r.w - 480);
    c.y = r.h <= 270 ? r.y + (r.h - 270) / 2 : clamp(c.y, r.y, r.y + r.h - 270);
  }
  updateCamera(dt) {
    const c = this.cam, p = this.player, k = 1 - Math.exp(-5 * dt);
    const ly = (p.state === 'dash' ? 0 : p.vy) * 0.2, lx = p.facing * 30 + p.vx * 0.2;
    c.lookX += (lx - c.lookX) * (1 - Math.exp(-2.5 * dt)); c.lookY += (clamp(ly, -30, 30) - c.lookY) * (1 - Math.exp(-2 * dt));
    const tx = (this.camFocus ? this.camFocus.x : p.x) + c.lookX - 240, ty = (this.camFocus ? this.camFocus.y : p.y) + c.lookY - 135 - 6;
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    this.clampCam();
  }

  // ---- draw -----------------------------------------------------------------------------------------------------
  draw(ctx) {
    const c = this.cam; let sx = 0, sy = 0;
    if (this.shakeAmt > 0.3) { sx = Math.round((rand() - 0.5) * this.shakeAmt * 2); sy = Math.round((rand() - 0.5) * this.shakeAmt * 2); }
    const cam = { x: Math.round(c.x + this.kickX) + sx, y: Math.round(c.y + this.kickY) + sy };
    this.bg.draw(ctx, cam, this.zone, this.t);
    this.amb.drawBehind(ctx, cam, this.t, clamp(cam.y / Math.max(1, this.zone.h * TS - 270), 0, 1));
    this.sky.draw(ctx, cam, 'back');
    // tiles
    const cvw = this.layer.canvas.width, cvh = this.layer.canvas.height;
    const sx0 = Math.max(0, cam.x), sy0 = Math.max(0, cam.y), sw = Math.min(480, cvw - sx0), sh = Math.min(270, cvh - sy0);
    if (sw > 0 && sh > 0) ctx.drawImage(this.layer.canvas, sx0, sy0, sw, sh, sx0 - cam.x, sy0 - cam.y, sw, sh);
    const view = { x0: cam.x - 60, y0: cam.y - 60, x1: cam.x + 540, y1: cam.y + 330 };
    const drawDecor = (layer) => {
      for (const d of this.decor) {
        if (d.layer !== layer || d.x < view.x0 || d.x > view.x1 || d.y < view.y0 - 40 || d.y > view.y1 + 60) continue;
        const f = d.spr.frames[Math.floor(this.t * d.spr.fps + d.ph) % d.spr.frames.length];
        const x = Math.round(d.x - cam.x - d.spr.ax), y = Math.round(d.y - cam.y - (d.spr.hang ? 0 : d.spr.h));
        ctx.drawImage(f, x, y);
      }
    };
    drawDecor('back');
    for (const i of this.interactables) i.draw(ctx, cam);
    for (const p of this.pickups) p.draw(ctx, cam);
    for (const e of this.enemies) e.draw(ctx, cam);
    for (const f of this.fields) this.drawField(ctx, cam, f);
    for (const p of this.projectiles) p.draw(ctx, cam);
    this.player.draw(ctx, cam);
    for (const b of this.beams) { const k = 1 - b.t / b.life; ctx.globalAlpha = k; ctx.fillStyle = b.color; const x = b.dir > 0 ? b.x : b.x - b.len; ctx.fillRect(Math.round(x - cam.x), Math.round(b.y - cam.y) - 4 * k - 1, b.len, Math.max(2, Math.round(8 * k))); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - cam.x), Math.round(b.y - cam.y) - 1, b.len, 2); ctx.globalAlpha = 1; }
    for (const fn of this.drawExtra) fn(ctx, cam);
    drawDecor('front');
    this.amb.drawAhead(ctx, cam, this.t);
    this.sky.draw(ctx, cam, 'front');
    this.fx.draw(ctx, cam);
    this.drawAtmosphere(ctx, cam);
    this.drawLighting(ctx, cam);
    for (const fn of this.overlayExtra) fn(ctx, cam);
    this.game.systems.post?.apply(ctx, this, cam);
    if (this.flash > 0) { ctx.globalAlpha = Math.min(0.8, this.flash * 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    if (this.hurtFlash > 0) { ctx.globalAlpha = Math.min(0.35, this.hurtFlash * 1.4); ctx.fillStyle = '#ff2a2a'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    if (this.slowT > 0) { ctx.globalAlpha = 0.12; ctx.fillStyle = '#8ae8ff'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    this.lastCam = cam;
  }
  drawField(ctx, cam, f) {
    const x = f.x - cam.x, y = f.y - cam.y, k = Math.min(1, f.life * 2, f.t * 4);
    if (f.kind === 'cloud') { // drifting spore puffs: soft green discs that rise and wobble
      for (let i = 0; i < 14; i++) { const a = i * 2.4 + f.t * (0.4 + (i % 3) * 0.15), rr = f.r * (0.25 + ((i * 37) % 10) / 14), px = x + Math.cos(a) * rr, py = y + Math.sin(a * 1.3) * rr * 0.6 - ((f.t * 6 + i * 5) % 12); ctx.globalAlpha = 0.28 * k; ctx.fillStyle = i % 3 ? '#8ad04a' : '#c8ff90'; const sz = 3 + (i % 3) * 2; ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz); }
      ctx.globalAlpha = 0.12 * k; ctx.fillStyle = '#6ab030'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), f.r, f.r * 0.7, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; return;
    }
    ctx.save(); ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = f.kind === 'maw' ? '#7a62c8' : '#9af0ff';
    for (let r = 0; r < 4; r++) { ctx.beginPath(); const rad = f.r * (0.3 + r * 0.22); for (let a = 0; a < 5; a += 0.3) { const rr = rad * (0.6 + a / 12); ctx.lineTo(Math.round(x + Math.cos(a + f.t * (5 - r)) * rr), Math.round(y + Math.sin(a + f.t * (5 - r)) * rr * 0.7)); } ctx.stroke(); }
    ctx.restore();
    if (f.kind === 'maw') { ctx.globalAlpha = 0.4 * k; ctx.fillStyle = '#0a0414'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), f.r * 0.5, f.r * 0.35, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  }
  drawAtmosphere(ctx, cam) {
    const B = this.biome, z = this.zone, ph = clamp((this.player.y) / (z.h * TS), 0, 1);
    ctx.globalAlpha = B.tintA; ctx.fillStyle = B.tint; ctx.fillRect(0, 0, 480, 270);
    ctx.globalAlpha = B.fog * (0.15 + ph * 0.55) * 0.6; ctx.fillStyle = B.bottom; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1;
  }
  lightList() {
    const L = [], pl = this.player, st = pl.stats;
    const stage = pl.form.stage;
    L.push({ x: pl.x, y: pl.y, r: 66 + ((this.zone.dark ?? this.biome.dark) > 0.3 ? 22 : 0) + st.light + (stage >= 3 ? 26 : 0) + (stage >= 5 ? 40 : 0), a: 1 });
    for (const l of this.zone.lights) L.push(l);
    for (const d of this.decor) if (d.spr.glow) L.push({ x: d.x, y: d.y - 12, r: 38, a: 0.8, color: d.spr.glow });
    for (const e of this.enemies) if (e.def.glow || e.def.sprite.o?.glow || e.type === 'lanternfish') L.push({ x: e.x, y: e.y - 4, r: 34, a: 0.8 });
    for (const p of this.projectiles) L.push({ x: p.x, y: p.y, r: 22, a: 0.8 });
    for (const i of this.interactables) { if (i instanceof INTERACTABLES.shrine) L.push({ x: i.x, y: i.y - 6, r: 52, a: 1 }); else if (i.glowing) L.push({ x: i.x, y: i.y - 10, r: 60, a: 1, color: '#ffb060' }); }
    for (const f of this.fields) if (f.kind !== 'cloud') L.push({ x: f.x, y: f.y, r: f.r, a: 0.6 });
    for (const fn of this.extraLights || []) fn(L);
    return L;
  }
  drawLighting(ctx, cam) {
    const dark = (this.zone.dark ?? this.biome.dark) * (this.darkMul ?? 1);
    if (dark <= 0.02) { this.drawVignette(ctx, 0.25); return; }
    if (!this.lightCv) { this.lightCv = document.createElement('canvas'); this.lightCv.width = 480; this.lightCv.height = 270; }
    const g = this.lightCv.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 480, 270);
    g.fillStyle = this.biome.id === 'trench' ? 'rgba(10,2,16,1)' : 'rgba(2,4,14,1)'; g.globalAlpha = dark; g.fillRect(0, 0, 480, 270); g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    const flick = 1 + Math.sin(this.t * 7) * 0.02;
    for (const l of this.lightList()) {
      const x = Math.round(l.x - cam.x), y = Math.round(l.y - cam.y), R = l.r * flick;
      if (x < -R || x > 480 + R || y < -R || y > 270 + R) continue;
      const a = l.a ?? 1, gr = g.createRadialGradient(x, y, R * 0.08, x, y, R); // smooth falloff: solid core, long soft edge
      gr.addColorStop(0, `rgba(0,0,0,${0.95 * a})`); gr.addColorStop(0.45, `rgba(0,0,0,${0.62 * a})`); gr.addColorStop(0.8, `rgba(0,0,0,${0.2 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 6.3); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.lightCv, 0, 0);
    // coloured halo around lights for the glow feel
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lightList()) if (l.color) { const x = Math.round(l.x - cam.x), y = Math.round(l.y - cam.y), R = l.r * 0.75; if (x < -R || x > 480 + R || y < -R || y > 270 + R) continue; const gr = ctx.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, l.color); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.2; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.3); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    this.drawVignette(ctx, 0.3);
  }
  drawVignette(ctx, a) {
    if (!this._vig) { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d'); const gr = g.createRadialGradient(240, 135, 120, 240, 135, 300); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, 480, 270); this._vig = c; }
    ctx.globalAlpha = a; ctx.drawImage(this._vig, 0, 0); ctx.globalAlpha = 1;
  }
}
