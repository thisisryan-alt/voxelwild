// Cross-checks data: every spawn/NPC/lore/item referenced by a zone, quest or dialogue exists.
import { buildZone } from '../src/data/zones.js';
import { ZONE_INFO } from '../src/data/zoneinfo.js';
import { ENEMIES } from '../src/data/enemies.js';
import { ITEMS } from '../src/data/items.js';
import { LORE } from '../src/data/lore.js';
import { NPCS } from '../src/data/npcs.js';
import { DIALOGUE } from '../src/data/dialogue.js';
import { QUESTS } from '../src/data/quests.js';
import { SKILLS } from '../src/data/skills.js';
import { ABILITIES } from '../src/combat/abilities.js';
import { BRANCHES, FORMS, EVOLUTIONS } from '../src/data/forms.js';
import { INTERACTABLES_KEYS } from './interactable_keys.mjs';

let bad = 0; const err = (m) => { console.log('✗', m); bad++; };
const bossKeys = ['grumbold', 'mother_moray', 'aurelia', 'captain_rust', 'lurelord', 'krael', 'kyros', 'hollow_maw', 'poseidon', 'pearl_tyrant', 'hermit_king', 'sporemother', 'brass_colossus', 'magmaw'];
const propKnown = new Set(['coin', 'pearl', 'item', 'orb', 'npc', ...INTERACTABLES_KEYS]);
for (const id of Object.keys(ZONE_INFO)) {
  const z = buildZone(id);
  for (const s of z.spawns) { if (s.boss) { if (!bossKeys.includes(s.boss)) err(`${id}: unknown boss ${s.boss}`); } else if (!ENEMIES[s.type]) err(`${id}: unknown enemy ${s.type}`); }
  for (const p of z.props) {
    if (p.type === 'npc') { if (!NPCS[p.npc]) err(`${id}: unknown npc ${p.npc}`); if (!DIALOGUE[p.npc]) err(`${id}: npc ${p.npc} has no dialogue`); }
    if (p.type === 'mural' && !LORE[p.codex]) err(`${id}: unknown lore ${p.codex}`);
    if ((p.type === 'item' || p.type === 'pearl') && p.id && !ITEMS[p.id] && p.id !== 'pearl' && p.id !== 'mp2_dummy') err(`${id}: unknown item ${p.id}`);
    if (p.type === 'chest') { const l = p.loot || {}; for (const k of [l.item, ...(l.items ? Object.keys(l.items) : [])]) if (k && !ITEMS[k]) err(`${id}: chest item ${k}`); }
    if (p.type === 'lockdoor' && p.key_item && !ITEMS[p.key_item]) err(`${id}: lock key ${p.key_item}`);
  }
}
for (const [id, q] of Object.entries(QUESTS)) { if (q.giver && !NPCS[q.giver]) err(`quest ${id}: giver ${q.giver}`); }
for (const [id, s] of Object.entries(SKILLS)) { if (s.ability && !ABILITIES[s.ability]) err(`skill ${id}: ability ${s.ability}`); for (const r of s.req) if (!SKILLS[r]) err(`skill ${id}: req ${r}`); }
for (const [id, b] of Object.entries(BRANCHES)) if (!ABILITIES[b.ability]) err(`branch ${id}: ability ${b.ability}`);
for (const [id, e] of Object.entries(EVOLUTIONS)) { if (!ITEMS[e.item]) err(`evolution ${id}: item ${e.item}`); for (const b of e.branches) if (!BRANCHES[b]) err(`evolution ${id}: branch ${b}`); }
// every loot / reward item exists
for (const [k, it] of Object.entries(ITEMS)) if (!it.name) err('item without name ' + k);
// the 7 memory pearls are all placed somewhere
const placed = new Set(); for (const id of Object.keys(ZONE_INFO)) { const z = buildZone(id); for (const p of z.props) { if (p.type === 'item' && p.id) placed.add(p.id); if (p.type === 'chest') { const l = p.loot || {}; if (l.item) placed.add(l.item); for (const k of Object.keys(l.items || {})) placed.add(k); } } }
for (let n = 1; n <= 7; n++) if (!placed.has('mp' + n)) err(`memory pearl mp${n} is not placed in any zone`);
for (const k of ['crew_token', 'map_fragment', 'lantern_stone', 'tithe_ledger', 'stolen_regalia', 'spiral_shell']) if (!placed.has(k)) err(`quest item ${k} not placed`);
console.log(bad ? `${bad} content problems` : 'content OK'); process.exitCode = bad ? 1 : 0;
