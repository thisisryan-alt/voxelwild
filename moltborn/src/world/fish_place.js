// Decides where fishing spots stand in a built zone: on open floor with deep water above it (at least six tiles of clear
// water, so there is room for the line), reachable from an entry, away from entries, exits, shrines, forage and each other.
// Deterministic from the zone seed.
import { TS, isSolid } from './tiles.js';
import { rng } from '../core/util.js';
import { FISH_BIOMES, SPOTS_PER_ZONE } from '../data/fish.js';

const NEAR = new Set(['shrine', 'chest', 'npc', 'sign', 'mural', 'lockdoor', 'bulb', 'brazier', 'board', 'forage']);

export function placeFishing(zone) {
  if (!FISH_BIOMES.includes(zone.biome) || zone.safe || zone.rift || zone.arena) return zone;
  if (zone.props.some((p) => p.type === 'fishspot')) return zone;      // a zone that places its own spots keeps them
  const g = zone.grid, W = g.w, r = rng((zone.seed | 0) * 71 + 43), open = (x, y) => g.in(x, y) && !isSolid(g.get(x, y));
  const seen = new Uint8Array(W * g.h), q = [];
  for (const e of Object.values(zone.entries)) { const x = Math.floor(e.x / TS), y = Math.floor((e.y - 4) / TS); if (open(x, y) && !seen[y * W + x]) { seen[y * W + x] = 1; q.push(x, y); } }
  for (let i = 0; i < q.length; i += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = q[i] + dx, ny = q[i + 1] + dy; if (!open(nx, ny) || seen[ny * W + nx]) continue; seen[ny * W + nx] = 1; q.push(nx, ny); }
  const fixed = zone.props.filter((p) => NEAR.has(p.type)).map((p) => [p.x / TS, p.y / TS]), placed = [], entries = Object.values(zone.entries).map((e) => [e.x / TS, e.y / TS]);
  const far = (x, y, pts, d) => pts.every(([a, b]) => Math.hypot(a - x, b - y) >= d), cand = [];
  for (let y = 8; y < g.h - 4; y++) for (let x = 6; x < W - 6; x++) {
    if (!seen[y * W + x] || !open(x, y) || !isSolid(g.get(x, y + 1)) || !isSolid(g.get(x - 1, y + 1)) || !isSolid(g.get(x + 1, y + 1))) continue;
    let deep = true; for (let k = 1; k <= 6 && deep; k++) for (const c of [x - 1, x, x + 1, x + 2]) if (!open(c, y - k)) deep = false;
    if (deep) cand.push([x, y]);
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const want = SPOTS_PER_ZONE[0] + Math.floor(r() * (SPOTS_PER_ZONE[1] - SPOTS_PER_ZONE[0] + 1));
  for (const [x, y] of cand) {
    if (placed.length >= want) break;
    if (!far(x, y, entries, 9) || !far(x, y, fixed, 6) || !far(x, y, placed, 20)) continue;
    if (zone.exits.some((e) => x >= e.x / TS - 5 && x <= (e.x + e.w) / TS + 5 && y >= e.y / TS - 5 && y <= (e.y + e.h) / TS + 5)) continue;
    if (zone.spawns.some((s) => s.boss && s.arena && x >= s.arena.x - 2 && x <= s.arena.x + s.arena.w + 2 && y >= s.arena.y - 2 && y <= s.arena.y + s.arena.h + 2)) continue;
    zone.props.push({ type: 'fishspot', x: (x + 0.5) * TS, y: (y + 1) * TS, key: `${zone.id}:fish:${x}:${y}` }); placed.push([x, y]);
  }
  return zone;
}
