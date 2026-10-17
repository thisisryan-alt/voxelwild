// The dive log: a short, readable record of the moments worth remembering, stamped with play time. It listens to the same
// events the trophies and stories do and keeps only the ones a person would tell a friend about (a guardian falling, a
// molt, a quest finished, a rare fish, a hard-won trophy), each at most once.
import { BOSS_CLASSES } from '../entities/bosses.js';
import { QUESTS } from '../data/quests.js';
import { FORMS } from '../data/forms.js';
import { FISH_BY_ID } from '../data/fish.js';
import { BY_ID } from '../data/achievements.js';

export const KEEP = 150;                 // entries kept; the oldest go first
export const KINDS = {
  boss:     { label: 'Guardian', color: '#ff7a6a' },
  molt:     { label: 'Molt', color: '#ff9ad8' },
  quest:    { label: 'Quest', color: '#ffd84a' },
  level:    { label: 'Level', color: '#9ad8ff' },
  rift:     { label: 'Rift', color: '#c07aff' },
  fish:     { label: 'Catch', color: '#7aff9a' },
  trophy:   { label: 'Trophy', color: '#ffd84a' },
  friend:   { label: 'Friend', color: '#ffd8f0' },
  surge:    { label: 'Sea', color: '#cfeeff' },
};

export class Journal {
  constructor(game) {
    this.g = game; game.systems.journal = this;
    const on = (ev, fn) => game.events.on(ev, fn);
    on('boss', (key) => this.add('boss', `Defeated ${BOSS_CLASSES[key]?.def?.name || key}.`, 'boss:' + key));
    on('evolved', (to) => this.add('molt', `Molted into the ${FORMS[to]?.name || to}.`, 'molt:' + to));
    on('questdone', (id) => this.add('quest', `Finished "${QUESTS[id]?.name || id}".`, 'quest:' + id));
    on('levelup', (lv) => { if (lv % 5 === 0) this.add('level', `Reached level ${lv}.`, 'level:' + lv); });
    on('runlogged', (e) => { if (e.kind === 'arena') { if (e.depth >= 10) this.add('rift', `Survived ${e.depth} waves of the Pearl Gauntlet.`); } else if (e.success) this.add('rift', `Cleared a ${e.tier} in ${Math.floor(e.secs / 60)}:${String(e.secs % 60).padStart(2, '0')}.`); });
    on('fish', (id, len, o) => {
      const f = FISH_BY_ID[id]; if (!f) return;
      if (f.rarity === 'legendary') this.add('fish', `Landed the ${f.name}: ${len} cm.`, 'fish:' + id);
      else if (o?.fresh && (f.rarity === 'rare')) this.add('fish', `Caught a ${f.name} for the first time.`, 'fish:' + id);
    });
    on('trophy', (id) => { const a = BY_ID[id]; if (a && (a.tier === 'gold' || a.tier === 'mythic')) this.add('trophy', `Earned the trophy "${a.name}".`, 'trophy:' + id); });
    on('companion', (what) => { if (what === 'adopt') this.add('friend', 'A hatchling hatched and chose to follow you.', 'friend:adopt'); });
    on('surge', (what) => { if (what === 'calm' && (game.state.records?.surges || 0) === 1) this.add('surge', 'Rode out your first tidal surge.', 'surge:first'); });
  }

  get log() { const s = this.g.state; return s.journal || (s.journal = []); }
  // keys make an entry unique: the same guardian can only fall once in the log
  add(kind, text, key = null) {
    const L = this.log; if (key && L.some((e) => e.key === key)) return null;
    const e = { t: Math.round(this.g.state.playtime || 0), kind, text }; if (key) e.key = key;
    L.push(e); while (L.length > KEEP) L.shift();
    return e;
  }
  recent(n = 12, offset = 0) { return this.log.slice().reverse().slice(offset, offset + n); }
  count() { return this.log.length; }
  // "2h 14m", "47m", "3m"
  static stamp(t) { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${Math.max(1, m)}m`; }
}
