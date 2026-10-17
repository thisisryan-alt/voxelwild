// Zone validator (Node, no DOM): checks every key object in every zone is reachable for the intended form size.
// Usage: node tests/validate_zones.mjs [zoneId]
import { buildZone } from '../src/data/zones.js';
import { ZONE_INFO } from '../src/data/zoneinfo.js';
import { TS, T, isSolid } from '../src/world/tiles.js';
import { bodyBlocked } from '../src/world/physics.js';

const SIZE = { s1: [14, 10, 9], s2: [14, 12, 16], s3: [22, 14, Infinity], s4: [40, 22, Infinity], s5: [34, 20, Infinity] };
const STEP = 8;

function reach(zone, sz, starts) {
  const [bw, bh, budget] = SIZE[sz], g = (() => { const c = Object.create(zone.grid); const rank = { s1: 1, s2: 2, s3: 3, s4: 4, s5: 5 }[sz]; c.t = zone.grid.t.map((t) => (t === T.LOCKED || t === T.BARRIER || (t === T.SEAL && rank >= 4) || (t === T.TIDEGATE && rank >= 5) || (t === T.CRACKED && rank >= 2 && false) ? T.AIR : t)); return c; })(), W = zone.w * TS / STEP, H = zone.h * TS / STEP, free = budget === Infinity;
  const body = { w: bw, h: bh, x: 0, y: 0 };
  const open = (ix, iy) => { body.x = ix * STEP; body.y = iy * STEP; return ix > 0 && iy > 0 && ix < W && iy < H && !bodyBlocked(g, body); };
  const grounded = (ix, iy) => {
    body.x = ix * STEP; body.y = iy * STEP + 5; if (bodyBlocked(g, body)) return true;
    const by = iy * STEP + bh / 2 + 5, ty = Math.floor(by / TS);
    for (let tx = Math.floor((ix * STEP - bw / 2) / TS); tx <= Math.floor((ix * STEP + bw / 2 - 0.01) / TS); tx++) if (g.get(tx, ty) === T.PLATFORM && by - ty * TS <= 8) return true;
    return false;
  };
  const B = free ? 1 : budget + 1; const seen = new Uint8Array(W * H * B); const idx = (x, y, b) => (y * W + x) * B + b;
  const q = []; const ok = new Uint8Array(W * H);
  for (const s of starts) { const ix = Math.round(s.x / STEP), iy = Math.round((s.y - bh / 2) / STEP); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (open(ix + dx, iy + dy)) { const b = free ? 0 : budget; if (!seen[idx(ix + dx, iy + dy, b)]) { seen[idx(ix + dx, iy + dy, b)] = 1; q.push([ix + dx, iy + dy, b]); } } }
  while (q.length) {
    const [x, y, b] = q.pop(); ok[y * W + x] = 1;
    const gr = !free && grounded(x, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!open(nx, ny)) continue;
      let nb = b;
      if (!free) { if (dy < 0) { if (!gr && b <= 0) continue; nb = gr ? budget - 1 : b - 1; if (nb < 0) continue; } else if (grounded(nx, ny)) nb = budget; }
      if (seen[idx(nx, ny, nb)]) continue; seen[idx(nx, ny, nb)] = 1; q.push([nx, ny, nb]);
    }
  }
  return (px, py, tol = 14) => { const ix = Math.round(px / STEP), iy = Math.round(py / STEP), r = Math.ceil(tol / STEP); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = ix + dx, y = iy + dy; if (x > 0 && y > 0 && x < W && y < H && ok[y * W + x]) return true; } return false; };
}

export function validate(id, sz) {
  const z = buildZone(id), probs = [];
  const starts = Object.values(z.entries);
  if (!starts.length) return { id, probs: ['no entries'] };
  const can = reach(z, sz, starts);
  const chk = (label, x, y, tol) => { if (!can(x, y, tol)) probs.push(`${label} @(${Math.round(x / TS)},${Math.round(y / TS)}) unreachable for ${sz}`); };
  for (const [k, e] of Object.entries(z.entries)) chk('entry ' + k, e.x, e.y - 6, 10);
  for (const ex of z.exits) chk('exit->' + ex.to, ex.x + ex.w / 2, ex.y + ex.h / 2, 24);
  for (const p of z.props) if (['chest', 'shrine', 'npc', 'mural', 'item', 'pearl', 'brazier', 'bulb', 'sign'].includes(p.type) && !p.secret) { if (p.type === 'chest' && p.small) continue; chk(p.type + (p.npc || p.kind || p.id || ''), p.x, p.y - 8, 26); }
  return { id, probs, z };
}
export function dump(id, x0, y0, x1, y1) {
  const z = buildZone(id); let out = '';
  for (let y = y0; y <= y1; y++) { let l = String(y).padStart(3) + ' '; for (let x = x0; x <= x1; x++) { const t = z.grid.get(x, y); l += t === 0 ? '.' : t === T.PLATFORM ? '=' : t === T.CRACKED ? 'x' : t === T.SPIKE ? '^' : t === T.SEAL ? 'S' : t === T.LOCKED ? 'L' : t === T.BARRIER ? 'B' : t === T.GROUND ? ':' : '#'; } out += l + '\n'; }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[3] === '--dump') { console.log(dump(process.argv[2], ...process.argv.slice(4).map(Number))); process.exit(0); }
  const only = process.argv[2]; const SZ = { reef: 's1', forest: 's2', kingdom: 's2', graveyard: 's3', abyss: 's3', trench: 's4', domain: 's5' };
  let bad = 0;
  for (const id of Object.keys(ZONE_INFO)) {
    if (only && id !== only) continue;
    try { const r = validate(id, process.env.SZ || SZ[ZONE_INFO[id].biome]); if (r.probs.length) { bad += r.probs.length; console.log('✗', id, '\n   ' + r.probs.join('\n   ')); } else console.log('✓', id); }
    catch (e) { if (String(e).includes('unknown zone')) console.log('·', id, '(not built yet)'); else { console.log('!', id, e.message); bad++; } }
  }
  process.exitCode = bad ? 1 : 0;
}
