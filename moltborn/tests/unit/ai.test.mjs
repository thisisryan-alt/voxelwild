// Enemy behaviours run headlessly against a stub world: states advance, attacks fire, nothing throws.
import { test, ok, eq } from './harness.mjs';
import { AI } from '../../src/entities/ai.js';
import '../../src/entities/ai_rift.js';
import { blinkSpot } from '../../src/entities/ai_rift.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { RIFT_FOES } from '../../src/data/enemies_rift.js';
import { BEASTS } from '../../src/data/bestiary.js';
import { THEMES } from '../../src/world/rift_gen.js';

const open = { solid: () => false, solidPx: () => false, get: () => 0 };
function stubWorld(grid = open) {
  const log = { proj: [], areas: [], hits: [], text: [], strikes: [] };
  const fx = { burst() {}, text: (...a) => log.text.push(a[2]), ring() {}, add() {} };
  const player = { x: 100, y: 100, vx: 0, vy: 0, w: 14, h: 12, alive: true, locked: false, invulnT: 0, state: 'free', facing: 1, status: { apply() {} }, takeHit: (h) => log.hits.push(h) };
  return { grid, fx, player, zone: { areas: log.areas }, addProjectile: (p) => log.proj.push(p), shake() {}, log, game: {} };
}
function stubEnemy(type, x, y, w) {
  const def = ENEMIES[type], e = {
    def, type, p: { ...def.p }, x, y, vx: 0, vy: 0, w: def.w, h: def.h, hp: def.hp, maxHp: def.hp, facing: 1, state: '', st: 0, world: w, t: 0, alive: true, contactMult: 1, guardFront: false, losT: 0, los: true, hitX: false,
    setState(s) { this.state = s; this.st = 0; }, alertFx() {}, sfx() {}, stun() {}, dmgNow: () => def.dmg, strike(rel, dmg) { w.log.strikes.push({ rel, dmg }); },
    shoot() { w.log.proj.push({ from: type }); }, takeHit() {},
  };
  AI[def.ai].init(e); return e;
}
// walkers are pinned to their starting height, standing in for the floor
const run = (e, w, seconds, dt = 1 / 60, onStep) => { const seen = new Set(), y0 = e.y, floor = e.def.anchor === 'feet'; for (let t = 0; t < seconds; t += dt) { e.t += dt; e.st += dt; AI[e.def.ai].update(e, dt, w); e.x += e.vx * dt; e.y += e.vy * dt; if (floor) { e.y = y0; e.vy = 0; } seen.add(e.state); onStep?.(e, t); } return seen; };

test('every enemy names a behaviour that exists', () => { for (const [k, d] of Object.entries(ENEMIES)) ok(AI[d.ai], `${k} -> ${d.ai}`); });
test('rift creatures are complete definitions with bestiary notes', () => { for (const [k, d] of Object.entries(RIFT_FOES)) { ok(d.hp > 0 && d.dmg > 0 && d.sprite.plan && d.p, k); ok(BEASTS[k], k); ok(ENEMIES[k] === d, k); } });
test('rift creatures spawn in at least one realm', () => { for (const k of Object.keys(RIFT_FOES)) ok(Object.values(THEMES).some((t) => t.pool.includes(k)), k); });

test('a blinker fades, reappears within range and fires its burst', () => {
  const w = stubWorld(), e = stubEnemy('shardling', 160, 90, w), start = { x: e.x, y: e.y };
  const seen = run(e, w, 9);
  for (const s of ['drift', 'fade', 'appear', 'fire']) ok(seen.has(s), 'saw ' + s);
  ok(w.log.proj.filter((p) => p.from === 'shardling').length >= 3, 'fired a burst');
  ok(Math.hypot(e.x - w.player.x, e.y - w.player.y) < 400, 'stayed near the swimmer');
  ok(start.x !== e.x || start.y !== e.y);
});
test('a blinker never reappears inside rock', () => {
  const rock = { solid: (x, y) => x >= 7 && x <= 8, solidPx: (x) => Math.floor(x / 16) >= 7 && Math.floor(x / 16) <= 8, get: () => 0 }, w = stubWorld(rock);
  for (let i = 0; i < 60; i++) { const s = blinkSpot(w, w.player, 70, 130); if (s) ok(!rock.solidPx(s[0]) && !rock.solidPx(s[0] + 6) && !rock.solidPx(s[0] - 6), 'spot in rock'); }
});
test('blinkSpot gives up cleanly in a sealed pocket', () => { const w = stubWorld({ solid: () => true, solidPx: () => true, get: () => 1 }); eq(blinkSpot(w, w.player, 70, 130), null); });

test('a latcher leaps, clings, drains health and lets go when the swimmer dashes', () => {
  const w = stubWorld(), e = stubEnemy('latchleech', 150, 100, w); let latched = 0, dashed = false;
  const seen = run(e, w, 12, 1 / 60, (en, t) => {
    if (en.state === 'attached') { latched++; if (latched > 140 && !dashed) { w.player.state = 'dash'; dashed = true; } }
    en.x = en.state === 'attached' ? en.x : en.x; w.player.x += 0; en.lastHp ??= en.hp;
  });
  ok(seen.has('leap') && seen.has('attached') && seen.has('recover'), [...seen].join());
  ok(w.log.hits.length >= 3, 'ticks of damage: ' + w.log.hits.length); ok(w.log.hits.every((h) => h.unblockable && h.kb === 0));
  ok(!e.attached, 'let go');
});
test('a latcher gives up after holding too long', () => {
  const w = stubWorld(), e = stubEnemy('latchleech', 100, 100, w); e.p.hold = 2; let run1 = 0, longest = 0;
  run(e, w, 12, 1 / 60, (en) => { if (en.state === 'attached') { run1 += 1 / 60; longest = Math.max(longest, run1); } else run1 = 0; });
  ok(longest > 0.5 && longest < 2.2, 'longest hold ' + longest.toFixed(2));
});
test('a latcher is shaken off by two solid hits', () => {
  const w = stubWorld(), e = stubEnemy('latchleech', 100, 100, w); let n = 0, off = false;
  run(e, w, 8, 1 / 60, (en) => { if (en.state === 'attached') { n++; if (n === 30 || n === 60) en.hp -= 3; } if (en.state === 'recover') off = true; });
  ok(off && n < 120, 'detached after ' + n + ' frames');
});

test('a caller winds up, raises a timed gust and then waits to call again', () => {
  const w = stubWorld(), e = stubEnemy('tidecaller', 60, 50, w), seen = run(e, w, 10);
  ok(seen.has('windup') && seen.has('call'));
  const gusts = w.log.areas.filter((a) => a.kind === 'current'); ok(gusts.length >= 1);
  for (const g of gusts) { ok(g.ttl > 0 && g.ttl < 4, 'gusts expire'); ok(Math.abs(g.vx) > 50 && g.vy === 0); }
});
test('a gust points toward the swimmer from where the caller stood', () => {
  const w = stubWorld(), e = stubEnemy('tidecaller', 60, 100, w); let side = 0, n = 0, wrong = 0;
  run(e, w, 12, 1 / 60, (en) => { if (en.state === 'windup') side = Math.sign(w.player.x - en.x) || 1; if (w.log.areas.length > n) { n = w.log.areas.length; if (Math.sign(w.log.areas[n - 1].vx) !== side) wrong++; } });
  ok(n >= 1 && wrong === 0, `${n} gusts, ${wrong} wrong`);
});

test('a bulwark guards, winds up, slams and throws shards along the ground', () => {
  const w = stubWorld(), e = stubEnemy('glassgolem', 130, 100, w); const seen = run(e, w, 8);
  for (const s of ['advance', 'windup', 'attack', 'recover']) ok(seen.has(s), s);
  ok(w.log.strikes.length >= 1 && w.log.strikes[0].dmg === ENEMIES.glassgolem.dmg);
  ok(w.log.proj.filter((p) => p.kind === 'shard').length >= 2, 'shards');
});
test('a bulwark drops its guard while winding up', () => { const w = stubWorld(), e = stubEnemy('glassgolem', 130, 100, w); let down = false, up = false; run(e, w, 8, 1 / 60, (en) => { if (en.state === 'windup' && !en.guardFront) down = true; if (en.state === 'advance' && en.guardFront) up = true; }); ok(down && up); });
test('the golem splits into shardlings that exist', () => { const s = ENEMIES.glassgolem.splits; ok(s && ENEMIES[s.type] && s.n >= 2); });
