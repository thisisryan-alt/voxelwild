// Pack tactics: foes take turns. Each world has a limited number of "attack tokens"; an enemy that is not mid-attack and
// has no token is kept on cooldown, so it circles and waits instead of piling onto the swimmer. The limit follows the
// difficulty tier, and the whole thing can be switched off in the options. Turrets, ambushers, mimics, healers and
// bosses are never held back.
import { setting, DIFFICULTIES } from './settings.js';

const ATTACKING = new Set(['windup', 'charge', 'dash', 'attack', 'lunge', 'peek', 'appear', 'burst', 'strike']);
const FREE_AI = new Set(['turret', 'ambush', 'mimic', 'noop', 'healer', 'summoner', 'drifter', 'cloudlayer', 'puffer']);
const TOKENS = [1, 2, 3, 3];       // calm .. maelstrom
const RANGE = 230;

export class Director {
  constructor(game) { this.g = game; game.systems.director = this; this.stats = { held: 0, attacking: 0 }; }

  tokens() {
    const idx = Math.max(0, DIFFICULTIES.indexOf(setting(this.g, 'difficulty')));
    return TOKENS[idx] + (this.g.world?.player?.stats?.maxHp > 140 ? 1 : 0);
  }
  update(world) {
    const st = this.stats; st.held = 0; st.attacking = 0;
    if (!setting(this.g, 'packTactics') || world.cinematic) return;
    const pl = world.player; if (!pl || !pl.alive) return;
    const foes = [];
    for (const e of world.enemies) {
      if (!e.alive || e.dying || e.def.boss || e.def.friendly || !e.a || e.a.cd === undefined || FREE_AI.has(e.def.ai) || e.state === 'hidden') continue;
      if (Math.abs(e.x - pl.x) > RANGE || Math.abs(e.y - pl.y) > RANGE) continue;
      foes.push(e);
    }
    if (foes.length < 3) return;                             // a pair of foes is already a fair fight
    const swarm = foes.filter((e) => e.def.ai === 'swarm'), rest = foes.filter((e) => e.def.ai !== 'swarm');
    this.grant(rest, pl, this.tokens()); this.grant(swarm, pl, this.tokens() + 2);
  }
  grant(list, pl, max) {
    const active = list.filter((e) => ATTACKING.has(e.state)); this.stats.attacking += active.length;
    let free = max - active.length;
    const waiting = list.filter((e) => !ATTACKING.has(e.state)).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
    for (const e of waiting) {
      if (free > 0) { free--; continue; }                    // this one has the next turn
      if (e.a.cd < 0.4) e.a.cd = 0.4; this.stats.held++;
    }
  }
}
