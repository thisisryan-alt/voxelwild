// Procedural chambers: every seed, depth and run length must produce a cave the intended forms can cross.
// Checks reachability (entries, exits, chest) with the shared zone validator, that spawns stand in open water and that
// every realm theme is buildable. Usage: node tests/validate_rifts.mjs [seeds]
import { validate } from './validate_zones.mjs';
import { riftId, arenaId, setRiftThemes, THEME_ORDER, buildRift, buildArena } from '../src/world/rift_gen.js';
import { buildZone } from '../src/data/zones.js';
import { TS, isSolid } from '../src/world/tiles.js';

const SEEDS = +(process.argv[2] || 24);
setRiftThemes(THEME_ORDER);
let bad = 0, built = 0, spawns = 0;
const fail = (id, msg) => { bad++; if (bad < 25) console.log('✗', id, msg); };
for (let seed = 1; seed <= SEEDS; seed++) {
  for (const max of [4, 6, 8]) {
    for (let depth = 1; depth <= max; depth++) {
      const id = riftId(seed * 997, depth, max);
      let r; try { r = validate(id, depth <= 2 ? 's1' : 's2'); } catch (e) { fail(id, 'threw ' + e.message); continue; }
      built++; for (const p of r.probs) fail(id, p);
      const z = r.z;
      if (!z.entries.west || !z.entries.east) fail(id, 'missing entry');
      const quiet = z.rift.kind === 'treasure' || z.rift.kind === 'altar'; if (quiet === !!z.spawns.length) fail(id, `spawn presence wrong for ${z.rift.kind}`);
      if (quiet) { const want = z.rift.kind === 'altar' ? ['altar'] : ['relicstand']; for (const t of want) if (!z.props.some((p) => p.type === t)) fail(id, `missing ${t}`); }
      if (z.rift.kind === 'treasure' && z.props.filter((p) => p.type === 'chest').length < 3) fail(id, 'treasure vault needs its chests');
      const last = depth === max; if (last === !!z.exits.length) fail(id, `exit presence wrong (last=${last})`);
      for (const s of z.spawns) { spawns++; if (isSolid(z.grid.get(Math.floor(s.x / TS), Math.floor((s.y - (s.floor ? 2 : 0)) / TS)))) fail(id, `spawn ${s.type} inside rock`); }
      if (z.exits.length && typeof z.exits[0].cond !== 'function') fail(id, 'exit has no clearing condition');
      const again = buildZone(id); if (again.w !== z.w || again.spawns.length !== z.spawns.length) fail(id, 'not deterministic');
    }
  }
}
for (let seed = 1; seed <= 7; seed++) {
  const id = arenaId(seed); const r = validate(id, 's1'); built++; for (const p of r.probs) fail(id, p);
  const z = r.z; if (!z.arena || z.points.length < 6) fail(id, 'arena data missing');
}
console.log(`[rifts] ${built} chambers, ${spawns} spawns, problems ${bad}`);
process.exitCode = bad ? 1 : 0;
