// Elite creatures: rolls affixes onto a zone's enemies as it is built and runs their effects. Elites are tougher but
// pay out more experience, coins and ingredients, and are marked on the sprite with a coloured aura and a pip per affix.
import { AFFIXES, AFFIX_IDS, ELITE_BASE, ELITE_NG, ELITE_CAP, ELITE_REWARD, NO_AFFIX } from '../data/affixes.js';
import { DIFFICULTIES } from './settings.js';
import { applyHitStatuses } from './status.js';
import { rng, clamp } from '../core/util.js';
import { text, textWidth } from '../ui/ui.js';

export class Elites {
  constructor(game) { this.g = game; game.systems.elites = this; }

  chance(world) {
    const g = this.g, idx = Math.max(0, DIFFICULTIES.indexOf(g.state.settings.difficulty || 'tide'));
    const depth = g.systems.rifts?.run?.depth || 0;
    return clamp(ELITE_BASE[idx] + (g.state.ng || 0) * ELITE_NG + depth * 0.03 + (g.systems.rifts?.eliteBonus() || 0), 0, ELITE_CAP);
  }

  // called by World once its enemies exist; deterministic per zone seed so a zone's elites are stable between visits
  roll(world) {
    if (world.zone.safe) return;
    const p = this.chance(world); if (p <= 0) return;
    const r = rng((world.zone.seed | 0) * 31 + 7), depth = this.g.systems.rifts?.run?.depth || 0;
    for (const e of world.enemies) {
      if (e.def.boss || e.def.friendly || !(e.def.dmg > 0) || NO_AFFIX.has(e.type) || e.affixes) continue;
      if (r() >= p) continue;
      const n = r() < 0.15 + (depth >= 3 ? 0.3 : 0) ? 2 : 1, picked = [];
      while (picked.length < n) { const id = AFFIX_IDS[Math.floor(r() * AFFIX_IDS.length)]; if (!picked.includes(id)) picked.push(id); }
      this.apply(e, picked);
    }
  }

  apply(e, ids) {
    e.affixes = ids; e.elite = true; e.shield = 0;
    for (const id of ids) {
      const A = AFFIXES[id];
      if (A.hp) { e.maxHp = Math.round(e.maxHp * A.hp); e.hp = e.maxHp; }
      for (const [st, power] of A.status || []) e.status.apply(st, { dur: 1e6, power });
      if (A.shield) e.shield += A.shield;
    }
    e.xpMult = (e.xpMult || 1) * ids.reduce((m, id) => m * (AFFIXES[id].xp || 1), 1) * ELITE_REWARD.xp / 1.4;
    e.name = ids.map((id) => AFFIXES[id].name).join(' ') + ' ' + e.def.name;
    return e;
  }
}

// ---- hooks called from Enemy ------------------------------------------------------------------------------------------------------
export const Affix = {
  // returns the damage to apply, or false when the blow is swallowed (a shield pops one charge)
  beforeHit(e, hit, dmg) {
    if (e.shield > 0 && !hit.guardBreak && !hit.fromDot) {
      e.shield--; e.world.fx.ring(e.x, e.y, 6, 20, 0.25, '#c8f0ff', 2); e.world.fx.text(e.x, e.y - e.h / 2 - 6, e.shield ? 'SHIELD' : 'SHIELD DOWN', '#c8f0ff', true);
      e.sfx('clang'); e.flash = 0.06; return false;
    }
    for (const id of e.affixes) if (AFFIXES[id].dmgIn) dmg *= hit.heavy ? Math.min(1, AFFIXES[id].dmgIn + 0.2) : AFFIXES[id].dmgIn;
    return dmg;
  },
  afterHit(e, hit, player, dmg) {
    if (!player || hit.ranged || hit.thorn) return;
    for (const id of e.affixes) { const t = AFFIXES[id].thorns; if (t) player.takeHit({ dmg: Math.max(1, Math.round(dmg * t)), x: e.x, y: e.y, kb: 30, thorn: true }); }
  },
  // the creature's blow landed on the player for `final` damage
  onHitPlayer(e, player, final) {
    for (const id of e.affixes) {
      const A = AFFIXES[id];
      if (A.hitStatus) applyHitStatuses(player.status, A.hitStatus, e);
      if (A.leech) { const n = Math.max(1, Math.round(final * A.leech)); e.hp = Math.min(e.maxHp, e.hp + n); e.world.fx.text(e.x, e.y - e.h / 2 - 4, '+' + n, '#d03a6a'); }
    }
  },
  onDeath(e) {
    const w = e.world;
    for (const id of e.affixes) {
      const A = AFFIXES[id];
      if (A.onDeath === 'blast') {
        const R = 44; w.fx.ring(e.x, e.y, 4, R, 0.35, '#ff8a3a', 3); w.fx.burst(e.x, e.y, ['#ffd070', '#ff8a3a', '#ff5a2a'], 120, 0.5, 3); w.shake(3); e.sfx('boom');
        w.spawnHitbox({ team: 'enemy', x: e.x - R, y: e.y - R, w: R * 2, h: R * 2, dmg: Math.round(Math.max(6, e.def.dmg * 1.1)), life: 0.12, kb: 130, owner: e });
      } else if (A.onDeath === 'brood') {
        for (let i = 0; i < 3; i++) w.spawnMinion('spawnling', e.x + (i - 1) * 8, e.y, { vx: (i - 1) * 70, vy: -50 });
      }
    }
  },
  // aura and pips; drawn after the sprite
  draw(ctx, e, cam) {
    const x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y), r = Math.max(e.w, e.h) * 0.62 * (e.scale || 1) + 3, t = e.world.t;
    ctx.save();
    e.affixes.forEach((id, i) => {
      const col = AFFIXES[id].color; ctx.strokeStyle = col; ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 4 + i * 2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, r + i * 2, (r + i * 2) * 0.9, 0, 0, 6.3); ctx.stroke();
    });
    if (e.shield > 0) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#c8f0ff'; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, r - 1, (r - 1) * 0.9, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; for (let i = 0; i < e.shield; i++) ctx.fillRect(x - 4 + i * 4, y - r - 2, 2, 2); }
    ctx.globalAlpha = 1;
    const n = e.affixes.length, by = y - Math.round(e.h / 2 * (e.scale || 1)) - 12 - (e.def.barLift || 0);
    e.affixes.forEach((id, i) => { ctx.fillStyle = '#05030a'; ctx.fillRect(x - n * 4 + i * 8 - 1, by - 1, 7, 5); ctx.fillStyle = AFFIXES[id].color; ctx.fillRect(x - n * 4 + i * 8, by, 5, 3); });
    // the name appears when the swimmer is close enough to read it
    const p = e.world.player;
    if (Math.hypot(p.x - e.x, p.y - e.y) < 110) { const s = e.affixes.map((id) => AFFIXES[id].name.toUpperCase()).join(' '); ctx.globalAlpha = 0.9; text(ctx, s, x - textWidth(s) / 2, by - 9, AFFIXES[e.affixes[0]].color, { shadow: '#000' }); }
    ctx.restore();
  },
  reward: ELITE_REWARD,
};
