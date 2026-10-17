// Bounties: four a day on the Tide Board, generated from the real calendar (like kitchen orders, so everyone sees the same
// board on the same day). Each one watches a lifetime counter in the save's records and is complete once that counter has
// grown by the asked amount. Completed bounties are claimed at the board for coins, experience and, now and then, a pearl;
// clearing the whole board keeps a streak going that pays more pearls.
import { ENEMIES } from '../data/enemies.js';
import { STAT_BOUNTIES, HUNT, STREAK_BONUS, REROLL_COST, BOARD_SIZE } from '../data/bounties.js';
import { today } from '../world/rift_gen.js';
import { rng } from '../core/util.js';

// 'kills.pinchling' style paths into the records
export function readStat(rec, path) { return path.split('.').reduce((o, k) => (o ? o[k] : 0), rec) || 0; }
const dayNumber = (d) => Math.floor(Date.UTC(Math.floor(d / 10000), Math.floor((d % 10000) / 100) - 1, d % 100) / 86400000);

export class Bounties {
  constructor(game) { this.g = game; game.systems.bounties = this; this.checkT = 0; this.ready = new Set(); }
  get state() { const s = this.g.state; return s.bounties || (s.bounties = { day: 0, list: [], streak: 0, lastFull: 0, claimed: 0, rerolls: 0 }); }
  get rec() { return this.g.state.records; }

  // creatures worth hunting: met before, hostile, ordinary
  huntable() {
    const kills = this.rec.kills || {}, met = Object.keys(kills).filter((k) => kills[k] > 0 && ENEMIES[k] && !ENEMIES[k].boss && !ENEMIES[k].friendly && !ENEMIES[k].noop && ENEMIES[k].dmg > 0 && !ENEMIES[k].noHunt);
    return met.length >= 3 ? met : [...new Set([...met, ...HUNT.starters])];
  }

  // the n-th bounty of a day, built from a seed so a reroll can ask for a different one
  make(day, slot, salt = 0, taken = []) {
    const r = rng(day * 131 + slot * 17 + salt * 7919 + 3), s = this.g.state, lvl = s.level || 1;
    const usable = Object.keys(STAT_BOUNTIES).filter((k) => !STAT_BOUNTIES[k].needs || STAT_BOUNTIES[k].needs(s));
    const pickHunt = slot % 2 === 0 || r() < 0.3;
    let b;
    if (pickHunt) {
      const pool = this.huntable().filter((k) => !taken.includes('hunt:' + k)), type = (pool.length ? pool : this.huntable())[Math.floor(r() * (pool.length || this.huntable().length))], d = ENEMIES[type];
      const toughness = Math.max(1, Math.min(6, Math.sqrt((d.hp || 10) / 12))), n = Math.max(HUNT.minN, Math.min(HUNT.maxN, Math.round(14 / toughness) + Math.floor(r() * 3)));
      b = { kind: 'hunt', target: type, stat: `kills.${type}`, n, pay: HUNT.pay * (0.8 + toughness * 0.18) * (n / 9) };
    } else {
      const pool = usable.filter((k) => !taken.includes('stat:' + k)), k = (pool.length ? pool : usable)[Math.floor(r() * (pool.length || usable.length))], T = STAT_BOUNTIES[k];
      const n = T.range[0] + Math.floor(r() * (T.range[1] - T.range[0] + 1));
      b = { kind: 'stat', target: k, stat: k, n, pay: T.pay * (0.8 + 0.4 * (n / T.range[1])) };
    }
    b.id = `${day}:${slot}:${salt}`; b.base = readStat(this.rec, b.stat); b.done = false; b.claimed = false;
    b.coins = Math.round((22 + lvl * 5.5) * b.pay); b.xp = Math.round((12 + lvl * 4) * b.pay); b.pearl = b.pay >= 1.9 ? 1 : 0;
    delete b.pay; return b;
  }

  refresh() {
    const st = this.state, day = today(); if (st.day === day && st.list.length) return st.list;
    // a missed day (or an unfinished board) breaks the streak
    if (st.day && st.day !== day) { const gap = dayNumber(day) - dayNumber(st.day); if (gap > 1 || !st.list.every((b) => b.claimed)) st.streak = 0; }
    st.day = day; st.list = []; const taken = [];
    for (let i = 0; i < BOARD_SIZE; i++) { const b = this.make(day, i, 0, taken); taken.push(b.kind === 'hunt' ? 'hunt:' + b.target : 'stat:' + b.target); st.list.push(b); }
    this.ready.clear(); return st.list;
  }

  progress(b) { return Math.max(0, Math.min(b.n, readStat(this.rec, b.stat) - b.base)); }
  complete(b) { return this.progress(b) >= b.n; }
  label(b) {
    if (b.kind === 'hunt') { const n = ENEMIES[b.target]?.name || b.target; return `Defeat ${b.n} ${n}${b.n > 1 && !n.endsWith('s') ? 's' : ''}`; }
    return STAT_BOUNTIES[b.target].label(b.n);
  }
  readyCount() { return this.state.list.filter((b) => this.complete(b) && !b.claimed).length; }

  claim(b) {
    const g = this.g, st = this.state; if (b.claimed || !this.complete(b)) return false;
    b.claimed = true; st.claimed++; g.state.coins += b.coins; g.state.stats.coinsEarned += b.coins; g.giveXp(b.xp, g.world.player.x, g.world.player.y);
    if (b.pearl) g.grantItem('pearl', b.pearl, true);
    g.audio.sfx('coin'); g.toast(`Bounty paid: ${b.coins} coins`, '#ffd84a'); g.events.emit('bounty', b);
    if (st.list.every((x) => x.claimed) && st.lastFull !== st.day) {
      st.lastFull = st.day; st.streak++; st.best = Math.max(st.best || 0, st.streak); const bonus = this.streakBonus(); g.events.emit('bountyboard', st.streak);
      if (bonus) { g.grantItem('pearl', bonus, true); g.toast(`Board cleared! ${st.streak}-day streak: +${bonus} pearl${bonus > 1 ? 's' : ''}`, '#ff9ad8'); } else g.toast(`Board cleared! ${st.streak}-day streak`, '#ff9ad8');
    }
    return true;
  }
  streakBonus() { return STREAK_BONUS[Math.min(STREAK_BONUS.length - 1, this.state.streak)]; }

  // swap an unclaimed bounty for a different one, for a few coins
  reroll(i) {
    const g = this.g, st = this.state, b = st.list[i]; if (!b || b.claimed) return false;
    if (g.state.coins < REROLL_COST) return false;
    g.state.coins -= REROLL_COST; st.rerolls++;
    const taken = st.list.filter((_, j) => j !== i).map((x) => (x.kind === 'hunt' ? 'hunt:' + x.target : 'stat:' + x.target));
    st.list[i] = this.make(st.day, i, st.rerolls, taken); return true;
  }

  // announce a bounty the moment its counter is reached
  update(dt) {
    this.checkT -= dt; if (this.checkT > 0 || !this.g.world) return; this.checkT = 1;
    for (const b of this.state.list) if (!b.claimed && this.complete(b) && !this.ready.has(b.id)) { this.ready.add(b.id); this.g.toast('Bounty ready: ' + this.label(b), '#9aff9a'); this.g.audio.sfx('quest'); }
  }
}
