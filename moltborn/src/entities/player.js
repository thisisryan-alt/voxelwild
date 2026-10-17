// The player: underwater movement (buoyancy, strokes, free swimming by form), the combat state machine
// (combo, charged heavy, dash, block/parry, abilities, ultimate), damage intake and animation selection.
import { Entity, drawFrame, blobShadow } from './entity.js';
import { moveBody } from '../world/physics.js';
import { FORMS as FORM_DATA, BRANCHES } from '../data/forms.js';
import { computeStats } from '../systems/progression.js';
import { ABILITIES, ULTS } from '../combat/abilities.js';
import { playerFrame, ANIMS, variantFor } from '../gfx/sprites_player.js';
import { clamp, approach, rng } from '../core/util.js';
import { StatusSet, applyHitStatuses } from '../systems/status.js';
import { BodyFx } from './fx_body.js';
import { statusOverlay, statusFx } from './fx_status.js';

const rand = rng(555);

export class Player extends Entity {
  constructor(world, x, y, game) {
    super(world, x, y, 14, 10);
    this.game = game; this.st = game.state; this.state = 'free'; this.stateT = 0; this.anim = 'idle'; this.animT = 0;
    this.strokesLeft = 0; this.strokeT = 0; this.coyote = 0; this.dashCd = 0; this.dashT = 0; this.dashI = 0; this.dashDir = [1, 0];
    this.invulnT = 0; this.counterT = 0; this.blockT = 0; this.blockCd = 0; this.comboIdx = 0; this.comboT = 0; this.atk = null; this.chargeT = 0; this.queued = false;
    this.cool = {}; this.ultCd = 0; this.surge = 0; this.aegis = 0; this.aegisT = 0; this.rushT = 0; this.spin = null; this.dashAttack = null; this.locked = false; this.deathT = 0; this.respawnT = 0;
    this.images = []; this.imgT = 0; this.lastAttackAt = 0; this.pressureT = 0; this.fear = 0; this.interactT = 0; this.collectT = 0; this.castT = 0; this.stepT = 0; this.mood = '';
    this.alive = true; this.combatT = 0; this.evolveGlow = 0; this.hideSprite = false;
    this.status = new StatusSet(this); this.bodyFx = new BodyFx(this);
    this.recalc(true);
    if (this.st.hp == null) this.st.hp = this.stats.maxHp; if (this.st.tide == null) this.st.tide = this.stats.maxTide;
    this.hp = this.st.hp; this.tide = this.st.tide;
  }
  get form() { return FORM_DATA[this.st.form]; }
  get fury() { return this.st.fury; } set fury(v) { this.st.fury = clamp(v, 0, 100); }
  recalc(initial) {
    this.stats = computeStats(this.st);
    const F = this.form; this.w = F.hit[0]; this.h = F.hit[1];
    this.hp = clamp(this.hp ?? this.stats.maxHp, 0, this.stats.maxHp);
    this.tide = clamp(this.tide ?? this.stats.maxTide, 0, this.stats.maxTide);
    if (!initial) { this.st.hp = this.hp; this.st.tide = this.tide; }
  }
  setForm(id) { this.st.form = id; const keep = this.hp / this.stats.maxHp; this.recalc(); this.hp = this.stats.maxHp; this.tide = this.stats.maxTide; this.st.hp = this.hp; this.st.tide = this.tide; this.y -= 2; }
  sfx(n) { this.game.audio.sfx(n, { x: this.x, y: this.y }); }
  hurtBox() { return { x: this.x - this.w / 2 + 1, y: this.y - this.h / 2 + 1, w: this.w - 2, h: this.h - 2 }; }
  abDmg(m) { return Math.round(this.stats.atk * m * (1 + this.stats.abilityDmg) * (this.surge > 0 ? 1.3 : 1) * this.status.mult('dmgOut')); }
  onStatusApplied(id, s) { this.game.events.emit('statusapplied', this, id, s); }
  heal(n) { if (n <= 0) return; const before = this.hp; this.hp = Math.min(this.stats.maxHp, this.hp + n); if (this.hp > before) this.world.fx.text(this.x, this.y - this.h / 2 - 6, '+' + Math.round(this.hp - before), '#7aff9a'); }
  addTide(n) { this.tide = clamp(this.tide + n, 0, this.stats.maxTide); }
  addFury(n) { this.fury += n * (1 + this.stats.furyGain) * (this.stats.ultCharge ? 1 + this.stats.ultCharge : 1); }
  get inCombat() { return this.combatT > 0; }

  // ---- state helpers ----------------------------------------------------------------------
  setState(s) { this.state = s; this.stateT = 0; }
  face(d) { if (d) this.facing = d; }
  get free() { return this.form.move.free; }
  inputOk() { return !this.locked && this.alive; }

  update(dt) {
    const g = this.game, inp = g.input, F = this.form, M = F.move, S = this.stats, w = this.world;
    this.t += dt; this.stateT += dt; this.animT += dt;
    if (this.comboLife > 0) { this.comboLife -= dt; if (this.comboLife <= 0) this.combo = 0; } this.comboPop = Math.max(0, (this.comboPop || 0) - dt * 6);
    if (this.aegisT > 0) { this.aegisT -= dt; if (this.aegisT <= 0) this.aegis = 0; } if (this.rushT > 0) this.rushT -= dt;
    this.dashCd -= dt; this.invulnT -= dt; this.counterT -= dt; this.blockCd -= dt; this.comboT -= dt; this.combatT -= dt; this.strokeT -= dt; this.surge -= dt;
    this.coyote -= dt; this.ultCd -= dt; this.evolveGlow = Math.max(0, this.evolveGlow - dt);
    for (const k in this.cool) this.cool[k] -= dt;
    if (!this.alive) return this.updateDead(dt);
    this.status.update(dt); this.bodyFx.update(dt); statusFx(this, dt); if (this.game.god) this.invulnT = Math.max(this.invulnT, 1);
    // regen
    this.tide = Math.min(S.maxTide, this.tide + S.tideRegen * this.status.mult('tideRegen') * dt * (this.inCombat ? 0.6 : 1));
    if (S.regen) this.hp = Math.min(S.maxHp, this.hp + S.regen * dt);
    if (this.onGround) { this.strokesLeft = S.strokes; this.coyote = 0.08; }
    // fields (currents, whirlpools) and pressure
    const cur = w.currentAt(this.x, this.y);
    if (cur) { const k = 1 - S.currentResist - (this.form.id === 'leviathan' ? 0.4 : 0) - (this.form.stage >= 5 ? 0.6 : 0); this.vx += cur.vx * Math.max(0.1, k) * dt * 2.5; this.vy += cur.vy * Math.max(0.1, k) * dt * 2.5; }
    this.pressureTick(dt);
    const inp_ok = this.inputOk();
    // afterimages
    this.imgT -= dt; if (this.state === 'dash' && this.imgT <= 0) { this.imgT = 0.03; this.images.push({ x: this.x, y: this.y, f: this.facing, life: 0.22, anim: 'dash', i: 0 }); }
    for (let i = this.images.length - 1; i >= 0; i--) { this.images[i].life -= dt; if (this.images[i].life <= 0) this.images.splice(i, 1); }

    switch (this.state) {
      case 'free': this.updateFree(dt, inp_ok); break;
      case 'attack': this.updateAttack(dt, inp_ok); break;
      case 'charge': this.updateCharge(dt, inp_ok); break;
      case 'dash': this.updateDash(dt); break;
      case 'block': this.updateBlock(dt, inp_ok); break;
      case 'hurt': this.updateHurt(dt); break;
      case 'cast': this.updateCast(dt); break;
      case 'ult': this.updateUlt(dt); break;
      case 'locked': this.vx *= Math.exp(-6 * dt); this.vy *= Math.exp(-6 * dt); this.applyWater(dt, 0, 0); break;
      default: this.setState('free');
    }
    if (this.spin) this.updateSpin(dt);
    moveBody(w.grid, this, dt, { step: !this.free && (this.state === 'free' || this.state === 'attack'), drop: inp_ok && inp.isDown('down') && !this.free });
    // bubbles & foam
    if (this.state !== 'locked' && Math.abs(this.vx) + Math.abs(this.vy) > 40 && rand() < 0.08) w.fx.bubble(this.x - this.facing * 6, this.y - 2, 1, 3, -16);
    if (this.onGround && Math.abs(this.vx) > 20 && rand() < 0.1) w.fx.add({ x: this.x - this.facing * 5, y: this.bottom - 1, vx: -this.facing * 6, vy: -8, life: 0.4, size: 2, color: '#f6d9a6', shrink: true });
    // state-keyed animation
    this.pickAnim();
    // low health
    this.st.hp = this.hp; this.st.tide = this.tide;
  }

  // damage that ignores invulnerability frames: burning, bleeding
  hurtDot(n, id, color = '#ff8a3a') {
    if (!this.alive || this.world.cinematic) return;
    this.hp -= n; this.world.fx.text(this.x + (rand() - 0.5) * 6, this.y - this.h / 2 - 2, n, color);
    this.game.events.emit('dot', id, n);
    if (this.hp <= 0) this.die();
  }

  pressureTick(dt) {
    const need = this.world.pressureAt(this.x, this.y), have = this.stats.pressure;
    if (need > have && this.alive && this.state !== 'locked') {
      this.pressureT += dt;
      if (this.pressureT > 1.1) { this.pressureT = 0; const d = Math.ceil((need - have) * 2.2); this.hp -= d; this.world.fx.text(this.x, this.y - 10, d, '#9a7aff'); this.sfx('pressure'); this.flashT = 0.1; if (this.hp <= 0) this.die(); }
      this.fear = Math.min(1, this.fear + dt);
    } else { this.pressureT = Math.max(0, this.pressureT - dt); this.fear = Math.max(0, this.fear - dt * 2); }
  }

  // ---- water physics --------------------------------------------------------------------------
  applyWater(dt, ax, ay) {
    const M = this.form.move, sp = this.stats.speed * this.status.mult('speed');
    if (this.free) {
      const target = M.swim * sp;
      if (ax || ay) {
        const n = Math.hypot(ax, ay), tx = ax / n * target, ty = ay / n * target;
        this.vx = approach(this.vx, tx, M.swimAccel * dt); this.vy = approach(this.vy, ty, M.swimAccel * dt);
      } else { const k = Math.exp(-M.drag * dt); this.vx *= k; this.vy *= k; if (this.onGround) this.vx *= Math.exp(-8 * dt); }
    } else {
      const max = (this.onGround ? M.ground : M.swim) * sp, acc = this.onGround ? M.groundAccel : M.swimAccel;
      if (ax) this.vx = approach(this.vx, ax * max, acc * dt);
      else this.vx = approach(this.vx, 0, (this.onGround ? M.groundFric : M.swimAccel * 0.5) * dt);
      if (!this.onGround) { this.vx *= Math.exp(-0.35 * dt); }
      this.vy += M.gravity * dt; if (this.vy > M.maxSink) this.vy = approach(this.vy, M.maxSink, 400 * dt);
      this.vy *= Math.exp(-0.5 * dt);
    }
  }

  stroke() {
    const M = this.form.move, S = this.stats;
    if (this.free) return;
    if (this.onGround || this.coyote > 0) { this.vy = M.stroke.vy * 1.08; this.coyote = 0; this.strokeT = 0.25; this.afterStroke(); return; }
    if (this.strokesLeft > 0 && this.strokeT <= -M.stroke.cd + 0.0) { this.strokesLeft--; this.vy = M.stroke.vy; this.strokeT = 0.25; this.afterStroke(); }
  }
  afterStroke() { this.game.events.emit('stroke'); this.world.fx.bubble(this.x, this.bottom - 2, 5, 8, -30); this.sfx('stroke'); this.animT = 0; this.strokeFlag = 0.25; this.game.input.consume('jump'); }

  updateFree(dt, ok) {
    const inp = this.game.input, M = this.form.move, F = this.form;
    let ax = 0, ay = 0;
    if (ok) {
      ax = inp.axisX();
      if (this.free) { ay = (inp.isDown('jump') || inp.isDown('up') ? -1 : 0) + (inp.isDown('down') ? 1 : 0); }
      if (ax) this.face(ax);
      if (!this.free && inp.buffered('jump', 5) && this.strokeT < 0.1) { this.stroke(); }
      if (this.free && inp.pressed('jump') && this.strokeT <= 0) { this.vy -= 40; this.strokeT = 0.2; this.world.fx.bubble(this.x, this.bottom - 2, 3, 6, -20); }
    }
    this.applyWater(dt, ax, ay);
    if (ok) this.readCombatInput(dt);
  }

  readCombatInput(dt) {
    const inp = this.game.input, F = this.form, S = this.stats;
    if (inp.buffered('dash', 6) && this.dashCd <= 0) { inp.consume('dash'); this.startDash(false, 1); return; }
    if (inp.buffered('attack', 7)) { inp.consume('attack'); this.startAttack(this.comboT > 0 ? this.comboIdx : 0); return; }
    if (inp.buffered('heavy', 7)) { inp.consume('heavy'); if (F.heavy.charge > 0) { this.setState('charge'); this.chargeT = 0; this.sfx('charge'); } else this.startHeavy(1); return; }
    if (inp.isDown('block') && this.blockCd <= 0) { this.setState('block'); this.blockT = 0; this.vx *= 0.3; return; }
    if (inp.pressed('ult')) { if (this.fury >= 100 && this.ultCd <= 0) { this.castUlt(); return; } else if (this.fury < 100) { this.world.fx.text(this.x, this.y - 14, 'FURY ' + Math.floor(this.fury) + '%', '#ff9a6a'); } }
    for (let i = 0; i < 3; i++) {
      const key = 'ab' + (i + 1);
      if (inp.pressed(key)) { const id = this.st.slots[i]; if (id && i < F.abilitySlots) this.castAbility(id); else if (!id) this.world.fx.text(this.x, this.y - 14, 'empty', '#888'); }
    }
  }

  // ---- attacks ----------------------------------------------------------------------------------------
  startAttack(i) {
    const F = this.form, list = F.combo; if (!list) return;
    const def = list[i % list.length]; this.comboIdx = i % list.length;
    this.atk = { def, t: 0, i: this.comboIdx, hit: false, fired: false, heavy: false, mult: 1 }; this.setState('attack'); this.queued = false;
    this.face(this.game.input.axisX() || this.facing); this.animT = 0;
  }
  startHeavy(chargeRatio) {
    const def = this.form.heavy; const mult = 0.75 + 0.5 * chargeRatio;
    this.atk = { def, t: 0, i: -1, hit: false, fired: false, heavy: true, mult, full: chargeRatio >= 0.98 }; this.setState('attack'); this.queued = false; this.animT = 0;
  }
  fxColor() { const v = variantFor(this.st); return v.glow || v.ramp.hex[4] || '#fff0c8'; }
  attackSpeed() { return (1 + this.stats.atkSpeed + (this.rushT > 0 ? 0.3 : 0)) * this.status.mult('atkSpeed'); }
  updateAttack(dt, ok) {
    const a = this.atk, d = a.def, w = this.world, inp = this.game.input, sp = this.attackSpeed();
    a.t += dt * sp;
    const wind = d.wind, act = d.act, rec = d.rec, tt = a.t;
    this.applyWater(dt, 0, 0);
    this.vx *= Math.exp(-4 * dt); if (this.free) this.vy *= Math.exp(-4 * dt);
    if (ok && inp.buffered('attack', 8) && !a.heavy) this.queued = true;
    if (ok && inp.buffered('dash', 5) && this.dashCd <= 0 && tt > wind + act * 0.5) { inp.consume('dash'); this.atk = null; this.startDash(false, 1); return; }
    if (tt >= wind && !a.fired) {
      a.fired = true;
      this.vx += this.facing * d.lunge * (a.heavy ? 1 : 1);
      const hbx = d.hb[0] * (1 + (this.stats.reach)), hw = d.hb[2] * (1 + this.stats.reach);
      const ox = this.facing > 0 ? hbx : -(hbx + hw);
      let dmg = this.stats.atk * d.dmg * (a.heavy ? (1 + this.stats.heavyDmg) * a.mult : 1);
      this.world.spawnHitbox({ team: 'player', owner: this, follow: this, ox, oy: d.hb[1], w: hw, h: d.hb[3], dmg, life: act, kb: d.kb, poise: d.poise * (a.heavy ? 1 : 1), stop: d.stop, shake: d.shake || 0, guardBreak: !!d.guardBreak, heavy: a.heavy, breaks: !!d.breaks, seals: !!d.seals, gates: !!d.gates, pierce: !!d.pierce, crit: true, form: this.form.id, multi: false, status: this.stats.poison ? { poison: 1 + Math.floor(this.stats.atk / 10) } : null });
      if (a.heavy && d.shock) { this.world.fx.ring(this.x + this.facing * 14, this.y + 4, 4, 50 + (d.hb[2] * 0.4), 0.3, '#ffe0b0', 2); this.world.fx.foam(this.x + this.facing * 14, this.y + 4, this.facing, 10); if (a.full && this.form.stage >= 2) this.world.fx.burst(this.x + this.facing * 18, this.y, ['#ffe0b0', '#fff'], 120, 0.4, 3); }
      this.sfx(a.heavy ? 'heavy' : 'claw'); this.world.fx.foam(this.x + this.facing * 12, this.y, this.facing, 4);
      { // the claw leaves a crescent in the water; combo steps alternate the sweep, heavy strikes carve a wide arc
        const col = this.fxColor(), R = Math.max(16, Math.min(52, (hbx + hw) * 0.95)) * (a.heavy ? 1.2 : 1), i = a.heavy ? 3 : a.i;
        this.world.fx.slash(this.x + this.facing * 2, this.y + d.hb[1] + d.hb[3] / 2, this.facing, R, col, { sweep: i % 2 ? -1 : 1, tilt: [-0.32, 0.32, -0.5, 0][i] ?? 0, th: a.heavy ? 9 : 5 + (i === 2 ? 1 : 0), arc: a.heavy ? 1.3 : 1.0, life: a.heavy ? 0.24 : 0.17, rim: a.heavy ? '#ffffff' : '#fff8e8' });
        if (a.heavy && this.onGround) this.world.fx.groundWave(this.x + this.facing * 12, this.bottom, 12, 80);
        this.world.kickCam(this.facing * (a.heavy ? 3 : 1.2), 0);
      }
      this.lastAttackAt = this.t; this.combatT = 3;
      // heavy attacks with the Ancient Molt carry super armour
    }
    const total = wind + act + rec;
    if (!a.heavy && this.queued && tt >= wind + act + rec * 0.35) { const nxt = (a.i + 1) % this.form.combo.length; this.startAttack(nxt); return; }
    if (tt >= total) { this.comboT = this.stats.comboWindow; this.comboIdx = a.heavy ? 0 : (a.i + 1) % this.form.combo.length; if (a.i === this.form.combo.length - 1) this.comboIdx = 0; this.atk = null; this.setState('free'); }
  }
  updateCharge(dt, ok) {
    const F = this.form, inp = this.game.input, need = F.heavy.charge / (1 + this.stats.chargeSpeed);
    this.chargeT += dt; this.applyWater(dt, 0, 0); this.vx *= Math.exp(-6 * dt);
    if (this.chargeT > need && !this.chargedFx) { this.chargedFx = true; this.world.fx.ring(this.x, this.y, 20, 4, 0.25, '#ffd84a', 2); this.sfx('charged'); }
    if (this.chargeT < need) this.chargedFx = false;
    if (this.chargeT > 0.1 && Math.random() < 0.3) this.world.fx.add({ x: this.x + (Math.random() - 0.5) * 30, y: this.y + (Math.random() - 0.5) * 20, vx: 0, vy: 0, life: 0.3, size: 1, color: '#ffd88a', shrink: true });
    if (!inp.isDown('heavy') || !ok) { const r = clamp(this.chargeT / need, 0, 1); this.chargedFx = false; if (r < 0.25) { this.startHeavy(0.2); } else this.startHeavy(r); }
  }
  castAbility(id) {
    const ab = ABILITIES[id]; if (!ab) return;
    if ((this.cool[id] || 0) > 0) { return; }
    const cost = Math.round(ab.cost * (1 + this.stats.tideCost));
    if (this.tide < cost) { this.world.fx.text(this.x, this.y - 14, 'NO TIDE', '#6ab0ff'); this.sfx('deny'); return; }
    this.tide -= cost; this.cool[id] = ab.cd * (1 + this.stats.cooldown) * (this.surge > 0 ? 0.3 : 1);
    this.ab = ab; this.setState('cast'); this.castT = ab.time; this.castFired = false; this.animT = 0; this.combatT = 3;
    this.abAnim = ab.anim || 'cast';
    this.face(this.game.input.axisX() || this.facing);
  }
  updateCast(dt) {
    this.applyWater(dt, 0, 0); this.vx *= Math.exp(-5 * dt);
    if (!this.castFired && this.stateT > 0.08) { this.castFired = true; this.ab.cast(this, this.world); }
    if (this.stateT >= this.ab.time && this.state === 'cast') this.setState('free');
  }
  castUlt() {
    const u = ULTS[this.st.form] || ULTS.shore; this.fury = 0; this.ultCd = 1; this.setState('ult'); this.ultDef = u; this.ultFired = false; this.abAnim = 'cast'; this.animT = 0; this.combatT = 5;
    this.world.fx.text(this.x, this.y - 20, u.name.toUpperCase(), '#ffd84a', true, { life: 1.1 });
  }
  updateUlt(dt) {
    this.applyWater(dt, 0, 0); this.vx *= Math.exp(-5 * dt);
    if (!this.ultFired && this.stateT > 0.18) { this.ultFired = true; this.ultDef.cast(this, this.world); this.game.hitstop(8); }
    if (this.stateT >= this.ultDef.time) this.setState('free');
  }
  updateSpin(dt) {
    const s = this.spin; s.t -= dt; s.next -= dt;
    if (s.next <= 0) { s.next = 0.18; this.world.spawnHitbox({ team: 'player', owner: this, follow: this, ox: -42, oy: -30, w: 84, h: 60, dmg: this.abDmg(1.6), life: 0.1, kb: 160, poise: 30, stop: 3, shake: 2, heavy: true }); this.world.fx.ring(this.x, this.y, 8, 44, 0.2, '#a8d8ff', 2); this.sfx('claw'); }
    if (s.t <= 0) this.spin = null;
  }

  // ---- dash / block ---------------------------------------------------------------------------------------
  startDash(attack = false, distMult = 1) {
    const M = this.form.move, inp = this.game.input, S = this.stats;
    let dx = inp.axisX(), dy = 0;
    if (M.dash.any || this.free) dy = inp.axisY() + ((inp.isDown('jump') && !dx) ? -0 : 0);
    if (!dx && !dy) dx = this.facing;
    if (!M.dash.any && !this.free) dy = 0;
    const n = Math.hypot(dx, dy) || 1; this.dashDir = [dx / n, dy / n]; if (dx) this.face(Math.sign(dx));
    this.setState('dash'); this.dashT = M.dash.time * (1 + S.dashDist) * distMult; this.dashI = M.dash.iframes * (1 + S.iframes);
    this.dashCd = M.dash.cd * (1 + S.dashCd); this.dashSpeed = M.dash.speed * (attack ? 1.15 : 1) * S.speed * this.status.mult('speed'); this.animT = 0;
    this.game.events.emit('dash', attack); this.sfx('dash'); this.world.fx.foam(this.x - this.dashDir[0] * 6, this.y, -this.dashDir[0] || -this.facing, 6);
    this.dashHit = new Set();
    if (S.dashStrike && !this.dashAttack) this.dashAttack = { dmg: S.atk * 0.8, t: this.dashT };
  }
  updateDash(dt) {
    this.dashT -= dt; this.dashI -= dt;
    this.vx = this.dashDir[0] * this.dashSpeed; this.vy = this.dashDir[1] * this.dashSpeed;
    if (this.dashAttack) {
      this.world.spawnHitbox({ team: 'player', owner: this, follow: this, ox: -this.w / 2 - 4, oy: -this.h / 2 - 5, w: this.w + 8, h: this.h + 10, dmg: this.dashAttack.dmg, life: 0.04, kb: 140, poise: 24, stop: 3, pierce: true, once: this.dashHit, shake: 2 });
    }
    if (this.dashT <= 0 || this.hitX) { this.dashAttack = null; this.vx *= 0.4; this.vy *= 0.4; this.setState('free'); }
    if (Math.random() < 0.5) this.world.fx.bubble(this.x - this.dashDir[0] * 6, this.y, 1, 4, 0);
  }
  updateBlock(dt, ok) {
    const inp = this.game.input; this.blockT += dt;
    this.applyWater(dt, 0, 0); this.vx *= Math.exp(-8 * dt);
    if (ok && inp.axisX()) { this.face(0); }
    if (!ok || !inp.isDown('block')) { this.blockCd = this.blockT < 0.3 ? 0.3 : 0.1; this.setState('free'); }
    if (ok && inp.buffered('dash', 4) && this.dashCd <= 0) { inp.consume('dash'); this.blockCd = 0.15; this.startDash(false, 1); }
  }

  // ---- damage intake ------------------------------------------------------------------------------------------
  takeHit(src) {
    if (!this.alive) return false;
    if (this.invulnT > 0 || this.dashI > 0) return false;
    if (this.state === 'locked' || this.world.cinematic) return false;
    const w = this.world, S = this.stats, F = this.form;
    if (this.counterT > 0 && !src.thorn && !src.unblockable) { this.counterT = 0; this.invulnT = 0.6; this.riposte(src); return 'parried'; }
    if (this.aegis > 0 && !src.thorn) { // the bubble eats the blow whole
      this.aegis--; this.invulnT = 0.45; w.fx.ring(this.x, this.y, 8, 30, 0.3, '#c8f0ff', 2); w.fx.burst(this.x, this.y, ['#ffffff', '#c8f0ff'], 60, 0.3, 2);
      w.fx.text(this.x, this.y - this.h / 2 - 8, this.aegis ? 'AEGIS' : 'AEGIS BREAKS', '#c8f0ff', true); this.sfx('clang'); this.game.hitstop(3); if (!this.aegis) this.aegisT = 0;
      return 'blocked';
    }
    let dmg = src.dmg * this.status.mult('dmgIn') * (src.thorn ? 1 : this.game.systems.difficulty?.scale().dmg ?? 1), blocked = false;
    if (src.vent) dmg *= this.status.mult('heat');
    if (src.vent && S.heatResist) dmg *= 1 - S.heatResist;
    if (this.state === 'block' && !src.unblockable && !src.thorn) {
      const frontal = ((src.x ?? this.x) - this.x) * this.facing >= -3;
      if (frontal) {
        if (F.block === 'parry' && this.blockT <= S.parryWindow) { this.parry(src); return 'parried'; }
        blocked = true; dmg *= F.block === 'parry' ? 0.3 : 0.55;
        this.sfx('clang'); w.fx.burst(this.x + this.facing * this.w / 2, this.y, ['#ffffff', '#cfe4ff'], 50, 0.25, 2); this.vx -= this.facing * 40; this.fury += 2; w.fx.text(this.x, this.y - 12, 'BLOCK', '#9ab8e0');
      }
    }
    const red = S.def / (S.def + 25);
    let final = Math.max(1, Math.round(dmg * (1 - red)));
    if (src.status?.poison && S.poisonResist) src.status = { ...src.status, poison: Math.max(1, Math.round(src.status.poison * (1 - S.poisonResist))) };
    this.hp -= final; this.lastHurtBy = { type: src.source?.type || src.source?.key || (src.vent ? 'vent' : src.thorn ? 'thorns' : src.field ? 'cloud' : src.kind || null) }; this.game.events.emit('hurt', final, src, blocked);
    w.fx.text(this.x, this.y - this.h / 2 - 4, final, '#ff5a4a', true);
    w.fx.burst(this.x, this.y, ['#ff7a6a', '#ffd0a0', '#ffffff'], 70, 0.35, 2);
    if (!blocked) { // chips of shell fly off the way the blow came from
      const kd = Math.sign(this.x - (src.x ?? this.x - 1)) || -this.facing, sh = this.fxColor();
      w.fx.impact(this.x - kd * this.w * 0.35, this.y - 2, -kd, { color: '#ffb0a0', size: 8, sparks: 8 });
      for (let i = 0; i < 6; i++) w.fx.add({ x: this.x, y: this.y - 3, vx: kd * (40 + rand() * 80), vy: -30 - rand() * 50, life: 0.6 + rand() * 0.4, size: rand() < 0.3 ? 2 : 1, color: i % 2 ? sh : '#ffd0a0', grav: 160, drag: 0.6, fade: true });
      this.combo = 0; this.comboLife = 0;
    }
    this.invulnT = blocked ? 0.35 : 1.0; this.combatT = 4; this.fury += blocked ? 0 : 3;
    this.game.hitstop(blocked ? 3 : 5); w.shake(blocked ? 1 : (final > this.stats.maxHp * 0.2 ? 5 : 3)); w.hurtFlash = 0.25; this.sfx(blocked ? 'clang' : 'hurt');
    if (S.thorns && src.source) { src.source.takeHit({ dmg: Math.max(1, Math.round(final * S.thorns * 3)), dir: this.x < src.source.x ? 1 : -1, kb: 20, poise: 0, ranged: true }, this); }
    if (src.status?.poison) { this.poisonT = 3; this.poisonDps = src.status.poison; }
    applyHitStatuses(this.status, src.status, src.source);
    src.source?.onHitPlayer?.(this, final);
    const kx = Math.sign(this.x - (src.x ?? this.x - 1)) || -this.facing;
    if (!blocked && !(F.stage >= 4 && this.state === 'attack' && this.atk?.heavy && F.heavy.armor)) { this.vx = kx * (src.kb || 80) * (F.stage >= 4 ? 0.5 : 1); this.vy = -30; if (!this.free) this.vy = -50; this.atk = null; this.charge = 0; this.setState('hurt'); this.animT = 0; }
    if (this.hp <= 0) {
      if (S.secondWind && !this.st.flags.secondWindUsed) { this.st.flags.secondWindUsed = true; this.hp = Math.round(S.maxHp * 0.4); this.invulnT = 1.8; w.fx.ring(this.x, this.y, 4, 80, 0.5, '#ffd84a', 3); w.fx.text(this.x, this.y - 18, 'SECOND WIND', '#ffd84a', true); this.sfx('revive'); }
      else this.die();
    }
    return true;
  }
  updateHurt(dt) {
    this.applyWater(dt, 0, 0);
    if (this.stateT > 0.28) this.setState('free');
    if (this.poisonT > 0) { this.poisonT -= dt; this.poisonAcc = (this.poisonAcc || 0) + dt; if (this.poisonAcc > 0.8) { this.poisonAcc = 0; this.hp -= this.poisonDps; this.world.fx.text(this.x, this.y - 8, this.poisonDps, '#8aff8a'); if (this.hp <= 0) this.die(); } }
  }
  parry(src) {
    const w = this.world, S = this.stats; this.st.stats.parries++;
    this.invulnT = 0.5; this.blockT = 99; this.addFury(18); this.addTide(8 + S.parryTide); this.combatT = 3;
    w.fx.ring(this.x + this.facing * 12, this.y, 2, 34, 0.25, '#ffffff', 2); w.fx.burst(this.x + this.facing * 12, this.y, ['#ffffff', '#ffe890', '#a8d8ff'], 120, 0.3, 2);
    w.fx.impact(this.x + this.facing * 14, this.y, this.facing, { crit: true, color: '#ffffff', size: 13, spikes: 12, sparks: 16 });
    w.fx.text(this.x, this.y - this.h / 2 - 8, 'PARRY!', '#ffe890', true); this.sfx('parry'); this.game.hitstop(9); w.flash = 0.12; w.kickCam(-this.facing * 2.5, 0);
    if (src.proj && src.proj.reflectable) src.proj.reflect();
    else if (src.source) { src.source.stun?.(0.9); src.source.poise = 0; if (src.source.takeParried) src.source.takeParried(); }
    else if (src.owner) { src.owner.stun?.(0.9); if (src.owner.takeParried) src.owner.takeParried(); }
    this.parryAnim = 0.2; this.animT = 0;
    this.game.events.emit('parry');
  }
  riposte(src) {
    const w = this.world, tgt = src.source || src.owner;
    w.fx.ring(this.x, this.y, 4, 40, 0.3, '#ff90a8', 2); this.sfx('riposte');
    if (tgt) w.fx.slash(tgt.x, tgt.y, Math.sign(tgt.x - this.x) || 1, 30, '#ffb0c0', { life: 0.24, tilt: -0.5, th: 8 });
    if (tgt && tgt.alive) { this.x = tgt.x - Math.sign(tgt.x - this.x) * (tgt.w / 2 + this.w / 2 + 4); this.y = tgt.y; this.face(Math.sign(tgt.x - this.x)); tgt.takeHit({ dmg: this.abDmg(3.2), dir: this.facing, kb: 180, poise: 80, stop: 8, shake: 4, crit: true, guardBreak: true }, this); }
    this.game.hitstop(8);
  }
  onBlockedHit(enemy, hit) { this.vx -= this.facing * 70; this.atk = null; this.setState('free'); this.comboT = 0; this.addFury(1); }
  onHitLanded(enemy, hb, dmg, crit) {
    const S = this.stats, st = enemy.status;
    if (st) { // weapon procs: burn, chill and bleed chances from gear and mutations
      if (S.hitBurn && rand() < S.hitBurn) st.apply('burn', { power: 1 + S.hitBurn });
      if (S.hitChill && rand() < S.hitChill) st.apply('chill');
      if (S.hitBleed && rand() < S.hitBleed * (hb.heavy ? 1.6 : 1)) st.apply('bleed');
    }
    this.game.events.emit('hitdealt', enemy, dmg, crit, hb);
    this.combo = (this.combo || 0) + 1; this.comboLife = 2.4; this.comboBest = Math.max(this.comboBest || 0, this.combo); this.comboPop = 1;
    if (this.combo > 0 && this.combo % 10 === 0) { this.addFury(8); this.world.fx.text(this.x, this.y - this.h / 2 - 16, `${this.combo} HITS`, '#ffe08a', true, { life: 1 }); this.sfx('charged'); }
    this.combatT = 4; this.addFury((hb.heavy ? 6 : 3) + (crit ? 2 : 0)); this.addTide(hb.heavy ? 2.5 : 1.2);
    if (this.form.stage >= 5 && this.surge > 0) this.hp = Math.min(this.stats.maxHp, this.hp + 0.5);
  }
  die() {
    if (!this.alive) return;
    this.hp = 0; this.alive = false; this.state = 'dead'; this.deathT = 0; this.vx *= 0.3; this.atk = null; this.spin = null;
    this.sfx('death'); this.world.fx.burst(this.x, this.y, ['#ff7a6a', '#ffffff', '#ffd0a0'], 200, 0.7, 3); this.world.fx.ring(this.x, this.y, 4, 60, 0.6, '#ff7a6a', 2);
    this.game.hitstop(12); this.world.shake(6);
    this.st.stats.deaths++; this.animT = 0; this.game.events.emit('playerdied', this.lastHurtBy || null);
  }
  updateDead(dt) {
    this.deathT += dt; this.vx *= Math.exp(-4 * dt); this.vy = Math.min(this.vy + (this.free ? 12 : 160) * dt, 80);
    moveBody(this.world.grid, this, dt, {}); this.anim = 'death'; this.animT += dt;
    if (this.deathT > 1.5 && !this.reported) { this.reported = true; this.game.onPlayerDeath(); }
  }

  // ---- animation -----------------------------------------------------------------------------------------------
  pickAnim() {
    let anim = 'idle';
    if (this.state === 'hurt') anim = 'hurt';
    else if (this.state === 'attack') anim = this.atk.def.anim;
    else if (this.state === 'charge') anim = 'heavy_charge';
    else if (this.state === 'dash') anim = 'dash';
    else if (this.state === 'block') anim = this.blockT < 0.12 && this.form.block === 'parry' ? 'parry' : 'block';
    else if (this.state === 'cast') anim = this.abAnim || 'cast';
    else if (this.state === 'ult') anim = 'cast';
    else if (this.parryAnim > 0) { this.parryAnim -= 1 / 60; anim = 'parry'; }
    else if (this.collectT > 0) { this.collectT -= 1 / 60; anim = 'collect'; }
    else if (this.interactT > 0) { this.interactT -= 1 / 60; anim = 'interact'; }
    else if (this.strokeFlag > 0 && !this.onGround) { this.strokeFlag -= 1 / 60; anim = 'stroke'; }
    else if (this.onGround) anim = Math.abs(this.vx) > 12 ? 'walk' : 'idle';
    else if (this.free) anim = Math.hypot(this.vx, this.vy) > 18 ? 'swim' : 'idle';
    else anim = this.vy > 30 ? 'fall' : 'swim';
    if (anim !== this.anim) { this.anim = anim; if (!['walk', 'swim', 'idle', 'fall', 'heavy_charge', 'block'].includes(anim)) this.animT = 0; else if (this.anim !== anim) this.animT = 0; }
  }
  frameIndex() {
    const A = ANIMS[this.anim] || ANIMS.idle, n = A.n;
    if (this.state === 'attack' && this.atk) {
      const a = this.atk, d = a.def, t = a.t;
      if (t < d.wind) return Math.min(1, Math.floor((t / d.wind) * 2));
      if (t < d.wind + d.act) return 2 + Math.min(1, Math.floor(((t - d.wind) / d.act) * 2));
      return Math.min(n - 1, 4 + Math.min(1, Math.floor(((t - d.wind - d.act) / d.rec) * 2)));
    }
    if (this.anim === 'walk') return Math.floor(this.animT * A.fps * Math.max(0.5, Math.abs(this.vx) / 60)) % n;
    if (A.loop) return Math.floor(this.animT * A.fps) % n;
    return Math.min(n - 1, Math.floor(this.animT * A.fps));
  }
  frame() { return playerFrame(this.st.form, variantFor(this.st), this.anim, this.frameIndex()); }
  draw(ctx, cam) {
    if (this.hideSprite) return;
    const f = this.frame(), flip = this.facing < 0;
    const x = this.x - cam.x, y = this.bottom - cam.y + (this.form.stage >= 3 ? 0 : 1);
    const oy = this.free || this.form.stage >= 3 ? (this.h / 2 - (this.form.id === 'shore' ? 0 : 0)) : 0;
    // after-images
    for (const im of this.images) { const ff = playerFrame(this.st.form, variantFor(this.st), 'dash', 0); ctx.globalAlpha = (im.life / 0.22) * 0.35; drawFrame(ctx, ff, im.x - cam.x, im.y + this.h / 2 - cam.y, im.f < 0); }
    ctx.globalAlpha = 1;
    let alpha = 1; if (this.invulnT > 0 && this.state !== 'dash' && Math.floor(this.invulnT * 16) % 2) alpha = 0.35;
    if (this.state === 'dash') alpha = 0.7;
    if (this.onGround && !this.free && this.alive) blobShadow(ctx, x, this.bottom - cam.y, Math.round(this.w * 0.75));
    if (this.alive || this.deathT < 1.4) {
      this.bodyFx.begin(ctx, x, this.free || this.form.stage >= 3 ? this.y - cam.y : this.bottom - cam.y);
      drawFrame(ctx, f, x, y, flip, false, alpha * (this.alive ? 1 : Math.max(0, 1 - Math.max(0, this.deathT - 0.8) / 0.6)));
      statusOverlay(ctx, this, f, x, y, flip);
      this.bodyFx.end(ctx);
    }
    if (this.aegis > 0) { // a faint shimmering bubble; one pip per blow left
      const bx = Math.round(x), by = Math.round(this.y - cam.y), R = Math.round(Math.max(this.w, this.h) * 0.62) + 5;
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.12; ctx.strokeStyle = '#c8f0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(bx + 0.5, by + 0.5, R, R * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#c8f0ff'; ctx.fill(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - R * 0.6, by - R * 0.6, 2, 1); ctx.fillRect(bx - R * 0.6, by - R * 0.6 + 1, 1, 1);
      for (let i = 0; i < this.aegis; i++) ctx.fillRect(bx - 4 + i * 4, by - R - 4, 2, 2); ctx.globalAlpha = 1;
    }
    if (this.state === 'charge') { const r = clamp(this.chargeT / (this.form.heavy.charge / (1 + this.stats.chargeSpeed)), 0, 1); ctx.fillStyle = '#170d1c'; ctx.fillRect(Math.round(x) - 11, Math.round(this.y - this.h / 2 - cam.y) - 12, 22, 4); ctx.fillStyle = r >= 1 ? '#ffd84a' : '#ff9a4a'; ctx.fillRect(Math.round(x) - 10, Math.round(this.y - this.h / 2 - cam.y) - 11, Math.round(20 * r), 2); }
    if (this.counterT > 0) { ctx.strokeStyle = '#ff90a8'; ctx.beginPath(); ctx.arc(Math.round(x) + 0.5, Math.round(this.y - cam.y) + 0.5, 14 + Math.sin(this.t * 30) * 2, 0, 6.3); ctx.stroke(); }
    if (this.surge > 0) { ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.t * 12); ctx.strokeStyle = '#9af0ff'; ctx.beginPath(); ctx.arc(Math.round(x) + 0.5, Math.round(this.y - cam.y) + 0.5, 22, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
  }
}
