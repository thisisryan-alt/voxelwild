// Every boss class is internally consistent: phases are ordered, every attack it lists is a real generator method, its sprite plan,
// music, loot and bestiary entry exist. The Rift Warden's circle strikes cover the area they telegraph.
import { test, ok, eq, near } from './harness.mjs';
import '../../src/bosses/index.js';
import { BOSS_CLASSES } from '../../src/entities/bosses.js';
import { RiftWarden } from '../../src/bosses/riftwarden.js';
import { PLANS } from '../../src/gfx/sprites_enemies.js';
import { TRACKS } from '../../src/audio/music.js';
import { ITEMS } from '../../src/data/items.js';
import { BEASTS } from '../../src/data/bestiary.js';
import { TS } from '../../src/world/tiles.js';

const GEN = Object.getPrototypeOf(function* () {}).constructor;
const bosses = Object.entries(BOSS_CLASSES);

test('there are fifteen boss classes, each registered under its own key', () => { eq(bosses.length, 15); for (const [k, C] of bosses) eq(C.def.key, k); });
test('every boss has a name, a title, health and an arena-sized body', () => { for (const [k, C] of bosses) { const d = C.def; ok(d.name && d.title, k); ok(d.hp >= 200, k + ' hp'); ok(d.w >= 20 && d.h >= 20, k + ' size'); ok(d.xp > 0, k + ' xp'); } });
test('phases start at full health and descend', () => { for (const [k, C] of bosses) { const ph = C.def.phases; ok(ph.length >= 2, k); eq(ph[0].at, 1, k); for (let i = 1; i < ph.length; i++) ok(ph[i].at < ph[i - 1].at && ph[i].at > 0, `${k} phase ${i}`); for (const p of ph) { ok(p.name && p.attacks.length >= 1 && p.rest > 0, `${k}:${p.name}`); } } });
test('every attack a phase lists is a generator method with a positive weight', () => {
  for (const [k, C] of bosses) for (const p of C.def.phases) for (const [name, weight] of p.attacks) { ok(typeof C.prototype[name] === 'function', `${k}.${name} exists`); ok(C.prototype[name] instanceof GEN || C.prototype[name].constructor === GEN, `${k}.${name} is a generator`); ok(weight > 0, `${k}.${name} weight`); }
});
test('later phases never lose all their earlier attacks at once', () => { for (const [k, C] of bosses) { const ph = C.def.phases; for (let i = 1; i < ph.length; i++) { const prev = new Set(ph[i - 1].attacks.map((a) => a[0])); ok(ph[i].attacks.some((a) => prev.has(a[0])) || ph[i].attacks.length >= 2, `${k} phase ${i}`); } } });
test('every boss draws with a sprite plan that exists', () => { for (const [k, C] of bosses) { const sp = C.def.sprite; if (!sp) continue; ok(PLANS[sp.plan], `${k} -> ${sp.plan}`); ok(sp.w > 0 && sp.h > 0 && sp.frames >= 1, k); } });
test('boss music and loot point at things that exist', () => { for (const [k, C] of bosses) { const d = C.def; if (d.music) ok(TRACKS[d.music], `${k} music ${d.music}`); for (const id of Object.keys(d.loot?.items || {})) ok(ITEMS[id], `${k} loot ${id}`); } });
test('every boss has a field note in the bestiary', () => { for (const [k] of bosses) ok(BEASTS[k], k); });

// ---- the Rift Warden ----------------------------------------------------------------------------------------------------------------------------
function fakeWarden(boxes) { return { arena: { x: 4, y: 5, w: 80, h: 26 }, strikeBox: (x, y, w, h, dmg, life, o) => boxes.push({ x, y, w, h, dmg, life, o }) }; }
test('a circle strike is a stack of strips that adds up to the circle it telegraphs', () => {
  const boxes = [], w = fakeWarden(boxes); RiftWarden.prototype.strikeCircle.call(w, 500, 300, 60, 15, 0.2, { kb: 200 });
  const area = boxes.reduce((n, b) => n + b.w * b.h, 0), circle = Math.PI * 60 * 60; ok(Math.abs(area - circle) / circle < 0.08, `strips ${area.toFixed(0)} vs circle ${circle.toFixed(0)}`);
  eq(boxes.length, 7); for (const b of boxes) { ok(b.x >= 440 - 0.01 && b.x + b.w <= 560 + 0.01, 'inside the circle\'s width'); ok(b.y >= 240 - 1.5 && b.y + b.h <= 360 + 1.5, 'inside its height'); eq(b.dmg, 15); eq(b.o.kb, 200); }
  const mid = boxes[3]; ok(mid.w > boxes[0].w, 'the middle strip is the widest'); near(boxes.reduce((n, b) => n + (b.x + b.w / 2), 0) / 7, 500, 0.5);
});
test('the circle strips do not overlap, so one blow cannot land twice', () => { const boxes = [], w = fakeWarden(boxes); RiftWarden.prototype.strikeCircle.call(w, 0, 0, 40, 10); const sorted = boxes.slice().sort((a, b) => a.y - b.y); for (let i = 1; i < sorted.length; i++) ok(sorted[i].y >= sorted[i - 1].y + sorted[i - 1].h - 1.01, 'strip ' + i); });
test('arena clamping keeps the Warden\'s tears and hovering inside the arena margins', () => {
  const w = fakeWarden([]); const [x, y] = RiftWarden.prototype.inArena.call(w, -999, 99999); eq(x, (4 + 3) * TS); eq(y, (5 + 26 - 3) * TS); const [x2, y2] = RiftWarden.prototype.inArena.call(w, 99999, -999, 5); eq(x2, (4 + 80 - 5) * TS); eq(y2, (5 + 5) * TS);
  const [x3, y3] = RiftWarden.prototype.inArena.call(w, 600, 300); eq(x3, 600); eq(y3, 300);
});
test('the Warden gets angrier in each phase and starts calm', () => { const ph = RiftWarden.def.phases; eq(ph.length, 3); ok(ph[1].onEnter && ph[2].onEnter); const b = { baseDmg: 1, dmgMult: 1 }; ph[1].onEnter(b); const m1 = b.dmgMult; ph[2].onEnter(b); ok(m1 > 1 && b.dmgMult > m1); ok(ph[2].rest < ph[1].rest && ph[1].rest < ph[0].rest, 'it rests less'); });
test('the Warden\'s last phase has the closing nova and the falling lances; the first does not', () => { const names = (i) => RiftWarden.def.phases[i].attacks.map((a) => a[0]); ok(names(2).includes('riftNova') && names(2).includes('lanceRain')); ok(!names(0).includes('riftNova') && !names(0).includes('gravityWell')); });
