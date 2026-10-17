// Checks every zone exit points at an existing zone + entry, and the map graph matches the real exits.
import { buildZone } from '../src/data/zones.js';
import { ZONE_INFO, ZONE_LINKS } from '../src/data/zoneinfo.js';
let bad = 0;
const zones = {};
for (const id of Object.keys(ZONE_INFO)) { try { zones[id] = buildZone(id); } catch (e) { console.log('missing zone', id, e.message); bad++; } }
const edges = new Set();
for (const [id, z] of Object.entries(zones)) {
  for (const ex of z.exits) {
    const t = zones[ex.to];
    if (!t) { console.log(`✗ ${id} exit -> unknown zone ${ex.to}`); bad++; continue; }
    if (!t.entries[ex.entry]) { console.log(`✗ ${id} exit -> ${ex.to}:${ex.entry} (no such entry)`); bad++; }
    edges.add([id, ex.to].sort().join('|'));
  }
  if (!Object.keys(z.entries).length) { console.log('✗ no entries', id); bad++; }
}
for (const [a, b] of ZONE_LINKS) if (!edges.has([a, b].sort().join('|'))) console.log(`· map link ${a} <-> ${b} has no matching exit (fine for secret/one-way)`);
for (const e of edges) { const [a, b] = e.split('|'); if (!ZONE_LINKS.some(([x, y]) => [x, y].sort().join('|') === e)) console.log(`· exit ${a} <-> ${b} not on the map graph`); }
console.log(bad ? `${bad} problems` : 'links OK');
process.exitCode = bad ? 1 : 0;
