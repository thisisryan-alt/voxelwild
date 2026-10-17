// Run history: every finished Tidal Rift, daily rift and Pearl Gauntlet is written to a short log in the save, with the
// fastest clear of each tier kept separately so it survives the log being trimmed. The Hall of Tides reads it back.
const KEEP = 40;

export class History {
  constructor(game) { this.g = game; game.systems.history = this; }
  get log() { const s = this.g.state; return s.runLog || (s.runLog = []); }
  get best() { const s = this.g.state; return s.runBest || (s.runBest = {}); }

  // s is the summary shown at the end of a run (see systems/rifts.js and arena.js)
  add(s) {
    const g = this.g, e = { at: Date.now(), day: Math.floor(Date.now() / 86400000), kind: s.kind || (s.daily ? 'daily' : 'rift'), tier: s.tier || 'Rift', depth: s.depth | 0, max: s.max | 0, success: !!s.success, secs: s.secs | 0, kills: s.kills | 0, relics: (s.relics || []).length, coins: s.rw?.coins | 0, oaths: (s.oaths || []).length };
    const L = this.log; L.push(e); while (L.length > KEEP) L.shift();
    if (e.success && e.secs > 0 && e.kind !== 'arena') { const b = this.best; if (!b[e.tier] || e.secs < b[e.tier]) b[e.tier] = e.secs; }
    g.events.emit('runlogged', e); return e;
  }
  recent(n = 8) { return this.log.slice(-n).reverse(); }

  stats() {
    const L = this.log, runs = L.length, wins = L.filter((r) => r.success).length;
    let streak = 0; for (let i = L.length - 1; i >= 0 && L[i].success; i--) streak++;
    let longest = 0, cur = 0; for (const r of L) { cur = r.success ? cur + 1 : 0; longest = Math.max(longest, cur); }
    const rifts = L.filter((r) => r.kind !== 'arena');
    return {
      runs, wins, rate: runs ? wins / runs : 0, streak, longest, kills: L.reduce((n, r) => n + r.kills, 0), secs: L.reduce((n, r) => n + r.secs, 0),
      deepest: rifts.reduce((n, r) => Math.max(n, r.depth), 0), bestWave: L.filter((r) => r.kind === 'arena').reduce((n, r) => Math.max(n, r.depth), 0), arena: L.filter((r) => r.kind === 'arena').length, daily: L.filter((r) => r.kind === 'daily' && r.success).length,
    };
  }
  // "today", "yesterday", "3 days ago"
  ago(e, now = Date.now()) { const d = Math.floor(now / 86400000) - e.day; return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; }
}
