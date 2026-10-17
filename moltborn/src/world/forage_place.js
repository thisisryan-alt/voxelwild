// Decides where forage patches grow in a built zone. Spots are open floor the player can reach from an entry, away from
// entries, exits, shrines and each other. Deterministic from the zone seed, so a zone always has the same patches.
import { TS, isSolid } from './tiles.js';
import { rng } from '../core/util.js';
import { FORAGE, PATCHES_PER_ZONE } from '../data/forage.js';

const NEAR = new Set(['shrine', 'chest', 'npc', 'sign', 'mural', 'lockdoor', 'bulb', 'brazier', 'board']);

export function placeForage(zone) {
  const kinds = FORAGE[zone.biome]; if (!kinds || zone.safe || zone.rift || zone.arena) return zone;
  const g = zone.grid, W = g.w, r = rng((zone.seed | 0) * 57 + 29), open = (x, y) => g.in(x, y) && !isSolid(g.get(x, y));
  const seen = new Uint8Array(W * g.h), q = [];
  for (const e of Object.values(zone.entries)) { const x = Math.floor(e.x / TS), y = Math.floor((e.y - 4) / TS); if (open(x, y) && !seen[y * W + x]) { seen[y * W + x] = 1; q.push(x, y); } }
  for (let i = 0; i < q.length; i += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = q[i] + dx, ny = q[i + 1] + dy; if (!open(nx, ny) || seen[ny * W + nx]) continue; seen[ny * W + nx] = 1; q.push(nx, ny); }
  const fixed = zone.props.filter((p) => NEAR.has(p.type)).map((p) => [p.x / TS, p.y / TS]), placed = [];
  const far = (x, y, pts, d) => pts.every(([a, b]) => Math.hypot(a - x, b - y) >= d);
  const cand = [];
  for (let y = 5; y < g.h - 4; y++) for (let x = 5; x < W - 5; x++) {
    if (!seen[y * W + x] || !open(x, y) || !isSolid(g.get(x, y + 1)) || !isSolid(g.get(x - 1, y + 1)) || !isSolid(g.get(x + 1, y + 1)) || !open(x, y - 1) || !open(x, y - 2)) continue;
    cand.push([x, y]);
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const want = PATCHES_PER_ZONE[0] + Math.floor(r() * (PATCHES_PER_ZONE[1] - PATCHES_PER_ZONE[0] + 1));
  const entries = Object.values(zone.entries).map((e) => [e.x / TS, e.y / TS]);
  for (const [x, y] of cand) {
    if (placed.length >= want) break;
    if (!far(x, y, entries, 8) || !far(x, y, fixed, 5) || !far(x, y, placed, 14)) continue;
    if (zone.exits.some((e) => x >= e.x / TS - 5 && x <= (e.x + e.w) / TS + 5 && y >= e.y / TS - 5 && y <= (e.y + e.h) / TS + 5)) continue;
    if (zone.spawns.some((s) => s.boss && s.arena && x >= s.arena.x - 2 && x <= s.arena.x + s.arena.w + 2 && y >= s.arena.y - 2 && y <= s.arena.y + s.arena.h + 2)) continue;
    const kind = kinds[Math.floor(r() * kinds.length)];
    zone.props.push({ type: 'forage', kind: kind.id, x: (x + 0.5) * TS, y: (y + 1) * TS, key: `${zone.id}:forage:${x}:${y}` }); placed.push([x, y]);
  }
  return zone;
}
