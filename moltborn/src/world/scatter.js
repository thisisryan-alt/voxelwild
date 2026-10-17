// Drops extra enemies onto a finished zone. Spots are picked from open space the player can actually reach from an entry,
// with room to move, and kept clear of entries, exits, boss arenas, interactables and other spawns.
import { TS, isSolid } from './tiles.js';
import { rng } from '../core/util.js';

const NEAR = new Set(['shrine', 'chest', 'npc', 'sign', 'mural', 'lockdoor', 'bulb', 'brazier']);

export function scatter(zone, list) {
  const g = zone.grid, W = g.w, r = rng((zone.seed || 1) * 977 + 13), open = (x, y) => g.in(x, y) && !isSolid(g.get(x, y));
  // flood fill the open water from the entries so nothing lands in a sealed pocket
  const seen = new Uint8Array(W * g.h), q = [];
  for (const e of Object.values(zone.entries)) { const x = Math.floor(e.x / TS), y = Math.floor((e.y - 4) / TS); if (open(x, y) && !seen[y * W + x]) { seen[y * W + x] = 1; q.push(x, y); } }
  for (let i = 0; i < q.length; i += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = q[i] + dx, ny = q[i + 1] + dy; if (!open(nx, ny) || seen[ny * W + nx]) continue; seen[ny * W + nx] = 1; q.push(nx, ny); }
  const arenas = zone.spawns.filter((s) => s.boss).map((s) => s.trigger || s.arena).filter(Boolean);
  const fixed = zone.props.filter((p) => NEAR.has(p.type)).map((p) => [p.x / TS, p.y / TS]);
  const placed = zone.spawns.map((s) => [s.x / TS, s.y / TS]);
  const farFrom = (x, y, pts, d) => pts.every(([a, b]) => Math.hypot(a - x, b - y) >= d);
  const clear = (x, y, rad, floor) => {
    if (floor) { if (!open(x, y) || !isSolid(g.get(x, y + 1)) || !isSolid(g.get(x - 1, y + 1)) || !isSolid(g.get(x + 1, y + 1))) return false; for (let k = 1; k <= rad; k++) if (!open(x, y - k)) return false; return open(x - 1, y) && open(x + 1, y); }
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (!open(x + i, y + j)) return false; return true;
  };
  for (const o of list) {
    const floor = !!o.floor, rad = o.clear ?? (floor ? 3 : 2), sep = o.sep ?? 9, cand = [];
    for (let y = 4; y < g.h - 4; y++) for (let x = 4; x < W - 4; x++) if (seen[y * W + x] && clear(x, y, rad, floor)) cand.push([x, y]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    let n = o.n ?? 1;
    for (const [x, y] of cand) {
      if (n <= 0) break;
      if (!farFrom(x, y, Object.values(zone.entries).map((e) => [e.x / TS, e.y / TS]), 12)) continue;
      if (zone.exits.some((e) => x >= e.x / TS - 6 && x <= (e.x + e.w) / TS + 6 && y >= e.y / TS - 6 && y <= (e.y + e.h) / TS + 6)) continue;
      if (arenas.some((a) => x >= a.x - 3 && x <= a.x + a.w + 3 && y >= a.y - 3 && y <= a.y + a.h + 3)) continue;
      if (!farFrom(x, y, fixed, 6) || !farFrom(x, y, placed, sep)) continue;
      const s = { type: o.type, x: (x + 0.5) * TS, y: floor ? (y + 1) * TS : y * TS + TS / 2, floor };
      if (o.count) s.count = o.count; if (o.scale) { s.hpMult = o.scale; s.dmgMult = 1 + (o.scale - 1) * 0.6; s.xpMult = o.scale; } if (o.p) s.p = o.p;
      zone.spawns.push(s); placed.push([x, y]); n--;
    }
  }
  return zone;
}
