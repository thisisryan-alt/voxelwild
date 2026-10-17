// Shrine travel: every Pearl Shrine the swimmer has rested at is remembered, and while standing at one the world map
// lets them swim straight to another. There is no cost, but travel is refused in rifts, boss fights and mid-combat.
import { ZONE_INFO } from '../data/zoneinfo.js';
import { Shrine } from '../entities/interactables.js';

export class Travel {
  constructor(game) { this.g = game; game.systems.travel = this; }
  get shrines() { const s = this.g.state; return s.shrines || (s.shrines = {}); }
  remember(zoneId, entry) { if (ZONE_INFO[zoneId]) this.shrines[zoneId] = entry || 'rest'; }

  // unlocked destinations ordered along the map, west to east
  list() {
    return Object.keys(this.shrines).filter((z) => ZONE_INFO[z]).sort((a, b) => ZONE_INFO[a].map.x - ZONE_INFO[b].map.x || ZONE_INFO[a].map.y - ZONE_INFO[b].map.y);
  }
  // null when travel is allowed, otherwise the reason it is not
  blocked() {
    const g = this.g, w = g.world, p = w?.player; if (!w || !p) return 'Not now';
    if (g.systems.rifts?.active || g.systems.arena?.active) return 'Not inside a run';
    if (w.boss && w.boss.engaged && w.boss.alive) return 'Not during a boss fight';
    if (!(w.near instanceof Shrine) || w.near.kind !== 'rest') return 'Stand at a Pearl Shrine to travel';
    if (p.combatT > 0) return 'Not while in combat';
    return null;
  }
  go(zoneId) {
    const g = this.g, entry = this.shrines[zoneId]; if (!entry) return false;
    const why = this.blocked(); if (why) { g.toast(why, '#ffb070'); return false; }
    if (g.world.zone.id === zoneId) { g.toast('You are already here', '#9ad8ff'); return false; }
    g.engine.pop(); g.audio.sfx('travel');
    g.playScene.fadeOut(0.5, () => {
      const p = g.world.player; g.state.hp = p.hp; g.state.tide = p.tide;
      g.state.checkpoint.last = { zone: zoneId, entry };
      g.buildWorld(zoneId, entry, { silentBanner: false });
      const rec = g.state.records; if (rec) rec.travels++;
      g.saveGame(true); g.playScene.fadeIn(0.6); g.events.emit('travel', zoneId);
    });
    return true;
  }
}
