// Companion bookkeeping: adoption (the Hatchling Egg), experience, naming and creating the entity for each world.
import { Companion, COMPANION_MAX, killsForLevel, TRICKS, tricksAt, hasTrick, XP_BOND } from '../entities/companion.js';
import { rng } from '../core/util.js';

const NAMES = ['Bub', 'Nip', 'Clack', 'Scuttle', 'Pebble', 'Snap', 'Mote', 'Tide', 'Pinch', 'Barnacle', 'Limpet', 'Skitter'];

export class CompanionSys {
  constructor(game) {
    this.g = game; game.systems.companion = this;
    game.events.on('kill', () => this.addKill());
  }
  get data() { return this.g.state.companion || null; }
  adopt() {
    const g = this.g; if (this.data) return 'You already have a companion';
    const r = rng(Math.floor(g.state.playtime) + 11); g.state.companion = { kind: 'crab', name: NAMES[Math.floor(r() * NAMES.length)], level: 1, kills: 0, flash: 0 };
    const w = g.world; if (w) w.companion = new Companion(w, g.state.companion);
    g.toast(`${g.state.companion.name} hatches and scuttles after you!`, '#ffd8f0'); g.audio.sfx('revive'); g.events.emit('companion', 'adopt');
    return null;
  }
  make(world) { return this.data ? new Companion(world, this.data) : null; }
  addKill() {
    const d = this.data; if (!d || d.level >= COMPANION_MAX) return;
    d.kills++;
    if (d.kills >= killsForLevel(d.level)) { d.level++; d.flash = 3; this.g.toast(`${d.name} grew to level ${d.level}`, '#ffd8f0'); this.g.audio.sfx('levelup'); this.g.events.emit('companion', 'level', d.level); }
  }
  // the tricks the hatchling knows now, and the next one to look forward to
  tricks() { const d = this.data; return d ? tricksAt(d.level) : []; }
  nextTrick() { const d = this.data; return d ? TRICKS.find((t) => t.lv > d.level) || null : null; }
  has(id) { const d = this.data; return !!d && hasTrick(d.level, id); }
  // experience multiplier from the bond trick
  xpBonus() { return this.has('bond') ? 1 + XP_BOND : 1; }
  describe() { const d = this.data; if (!d) return null; return `${d.name}  Lv ${d.level}  (${d.level >= COMPANION_MAX ? 'max' : d.kills + '/' + killsForLevel(d.level)})`; }
}
