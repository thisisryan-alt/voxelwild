// Prints cumulative XP/EP/coins available per zone vs level thresholds, to check progression pacing.
import { buildZone } from '../src/data/zones.js';
import { ZONE_INFO } from '../src/data/zoneinfo.js';
import { ENEMIES } from '../src/data/enemies.js';
import { xpToNext } from '../src/data/forms.js';
const bossXp = { grumbold: 160, mother_moray: 320, aurelia: 520, captain_rust: 700, lurelord: 900, krael: 1100, kyros: 1300, hollow_maw: 2000, poseidon: 5000, pearl_tyrant: 220, hermit_king: 240, sporemother: 260, brass_colossus: 420, magmaw: 520 };
const questXp = { reef_garden: 20, forest_heart: 140 };
const lvAt = (xp) => { let l = 1; while (xp >= xpToNext(l)) { xp -= xpToNext(l); l++; } return l; };
let cum = 0, ep = 0, coins = 0;
for (const id of Object.keys(ZONE_INFO)) {
  const z = buildZone(id); let xp = 0, e = 0, c = 0;
  for (const s of z.spawns) { if (s.boss) { xp += bossXp[s.boss] || 0; continue; } const d = ENEMIES[s.type]; const n = s.count || 1; xp += (d.xp || 0) * n; if (d.coins) c += (d.coins[0] + d.coins[1]) / 2 * n; if (d.ep) e += d.ep * n; }
  for (const p of z.props) { if (p.type === 'chest' && p.loot) { e += p.loot.ep || 0; const co = p.loot.coins; if (co) c += Array.isArray(co) ? (co[0] + co[1]) / 2 : co; } if (p.type === 'coin') c += 1; }
  cum += xp; ep += e; coins += c;
  console.log(id.padEnd(16), 'xp', String(Math.round(xp)).padStart(5), 'cum', String(Math.round(cum)).padStart(6), 'lvl', String(lvAt(cum * 0.75)).padStart(2), '(75% kills)', 'coins', String(Math.round(coins)).padStart(5), 'ep(chests+elites)', e);
}
