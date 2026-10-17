// ASCII map of a zone: node tests/ascii.mjs <zoneId> [x0 y0 x1 y1]   (. open, # solid, = platform, X cracked, ^ spike, B barrier, o spawn, E entry, > exit)
import { buildZone } from '../src/data/zones.js';
import { T, isSolid, TS } from '../src/world/tiles.js';
const [id, a, b, c, d] = process.argv.slice(2); const z = buildZone(id), g = z.grid;
const x0 = +(a ?? 0), y0 = +(b ?? 0), x1 = +(c ?? g.w), y1 = +(d ?? g.h);
const ch = (x, y) => { const t = g.get(x, y); return t === T.AIR || t === T.CREVICE ? '.' : t === T.PLATFORM ? '=' : t === T.CRACKED ? 'X' : t === T.SPIKE ? '^' : t === T.SEAL ? 'S' : t === T.TIDEGATE ? 'G' : t === T.LOCKED ? 'L' : isSolid(t) ? '#' : '?'; };
const marks = new Map(); const put = (x, y, m) => marks.set(Math.floor(x) + ',' + Math.floor(y), m);
for (const s of z.spawns) put(s.x / TS, s.y / TS - (s.floor ? 0.5 : 0), s.boss ? 'B' : 'o');
for (const e of Object.values(z.entries)) put(e.x / TS, e.y / TS - 0.5, 'E');
for (const p of z.props) if (['chest', 'npc', 'shrine', 'item'].includes(p.type)) put(p.x / TS, p.y / TS - 0.5, p.type[0].toUpperCase());
let out = '';
for (let y = y0; y < y1; y++) { let row = String(y).padStart(3) + ' '; for (let x = x0; x < x1; x++) row += marks.get(x + ',' + y) || ch(x, y); out += row + '\n'; }
console.log(out);
