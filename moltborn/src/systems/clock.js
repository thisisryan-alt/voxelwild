// The tide clock: derives the time of day from play time (so it needs nothing in the save but an optional shift), announces
// each new phase, keeps the matching status on the swimmer, and answers what the hour changes: experience and coin
// multipliers, how alert foes are, and how much sky the current realm lets through.
import { CYCLE, START, PHASES, phaseAt, gradeAt, OPENNESS } from '../data/clock.js';
import { setting } from './settings.js';

export class Clock {
  constructor(game) { this.g = game; game.systems.clock = this; this.last = null; this.shift = 0; }

  // fraction of the day, 0..1
  frac() { const st = this.g.state; return ((((st.playtime || 0) / CYCLE) + START + (st.clockShift || 0)) % 1 + 1) % 1; }
  get mode() { return setting(this.g, 'dayNight'); }
  get on() { return this.mode !== 'off'; }
  get phase() { return phaseAt(this.frac()); }
  // seconds until the phase after this one begins
  untilNext() { const f = this.frac(), p = phaseAt(f); return Math.max(0, (p.to - f) * CYCLE); }

  // multipliers folded into Difficulty.scale()
  mult() { if (!this.on) return null; return this.phase.mods; }
  aggro() { return this.on ? this.phase.mods.aggro : 1; }
  // how strongly the sky colours this realm
  openness(biome) { return OPENNESS[biome] ?? 0.5; }
  grade() { return gradeAt(this.frac()); }
  // 0 in full day, 1 in deep night: used by things that glow
  nightness() { const g = this.grade(); return Math.min(1, g.dark / 0.36); }

  // an exit condition for passages that only open at night; says why, but not too often
  gate(message) {
    if (!this.on || this.phase.id === 'night' || this.phase.id === 'dusk' && this.nightness() > 0.4) return true;
    if (this.gateT === undefined || this.g.state.playtime - this.gateT > 3) { this.gateT = this.g.state.playtime; this.g.toast(message, '#9ab0ff'); this.g.audio.sfx('deny'); }
    return false;
  }

  jump(to) {
    // to: a phase id or a fraction; moves the clock by changing the shift
    const target = typeof to === 'number' ? to : (() => { const p = PHASES.find((x) => x.id === to) || PHASES[0]; return p.from + (p.to - p.from) * 0.4; })(), st = this.g.state;
    st.clockShift = (((target - ((st.playtime || 0) / CYCLE + START)) % 1) + 1) % 1;
  }

  update(dt = 0) {
    const w = this.g.world; if (!w) return;
    const p = this.on ? this.phase : null;
    this.syncT = (this.syncT || 0) - dt; if (this.syncT <= 0) { this.syncT = 1; this.syncStatus(w.player, p); }
    if (p !== this.last) {
      const first = this.last === null; this.last = p;
      if (p && !first) { this.g.toast(`${p.name} - ${p.line}`, p.id === 'night' ? '#9ab0ff' : p.id === 'dusk' ? '#ffa8c0' : '#ffe9a8'); this.g.events.emit('phase', p.id); }
      this.syncStatus(w.player, p);
    }
  }
  syncStatus(pl, p) {
    if (!pl?.status) return;
    for (const id of ['sunlit', 'moonlit']) if ((!p || p.status !== id) && pl.status.has(id)) pl.status.remove(id);
    if (p?.status && !pl.status.has(p.status)) pl.status.apply(p.status, { dur: 1e6 });
  }
  // a freshly built world (new zone, respawn) has a new player: give it the right status
  onWorld(world) { this.syncStatus(world.player, this.on ? this.phase : null); }
}
